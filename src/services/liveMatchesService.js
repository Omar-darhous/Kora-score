import { getLeagues } from './logoUtils.js';
import { getMockEgyptianMatches } from './egyptianMockService.js';
import { fetchLeagueMatches } from './matchesService.js';

// الاحتفاظ بآخر نسخة صالحة معروفة لكل بطولة وتاريخ لمنع فقدان المباريات عند تعثر طلب بطولة واحدة مؤقتاً
const leagueMatchesSnapshot = new Map();
const latestSnapshotVersion = new Map();
let snapshotSequence = 0;

// جلب المباريات الحقيقية لجميع الدوريات في تاريخ معين (تنسيق YYYYMMDD)
export const getMatches = async (dateStr, { strict = false, onPartial, forceRefresh = false, signal } = {}) => {
  if (!dateStr) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateStr = `${yyyy}${mm}${dd}`;
  }

  const activeLeagues = getLeagues();
  let failedRequests = 0;

  try {
    const promises = activeLeagues.map(async (league) => {
      if (league.id === 'egypt.1') {
        // الدوري المصري انتهى يوم 29 مايو 2026، لذا نعرض مبارياته فقط في ذلك التاريخ لمنع التشويش على مباريات اليوم المباشرة الحالية
        if (dateStr === '20260529') {
          return getMockEgyptianMatches();
        }
        return [];
      }

      const snapshotKey = `${league.id}:${dateStr}`;
      const requestVersion = ++snapshotSequence;
      try {
        const mappedMatches = await fetchLeagueMatches(league, dateStr, { forceRefresh, signal });

        const completedVersion = latestSnapshotVersion.get(snapshotKey) || 0;
        if (requestVersion < completedVersion && leagueMatchesSnapshot.has(snapshotKey)) {
          return structuredClone(leagueMatchesSnapshot.get(snapshotKey));
        }

        while (leagueMatchesSnapshot.size >= 100 && !leagueMatchesSnapshot.has(snapshotKey)) {
          const oldestKey = leagueMatchesSnapshot.keys().next().value;
          leagueMatchesSnapshot.delete(oldestKey);
          latestSnapshotVersion.delete(oldestKey);
        }
        latestSnapshotVersion.set(snapshotKey, requestVersion);
        leagueMatchesSnapshot.set(snapshotKey, structuredClone(mappedMatches));
        return mappedMatches;
      } catch (err) {
        if (signal?.aborted || err?.name === 'AbortError') {
          throw err;
        }
        failedRequests += 1;
        console.error(`Error fetching matches for league ${league.id}:`, err);
        if (leagueMatchesSnapshot.has(snapshotKey)) {
          return structuredClone(leagueMatchesSnapshot.get(snapshotKey));
        }
        return [];
      }
    });

    const results = await Promise.all(promises);
    if (strict && failedRequests === activeLeagues.filter(league => league.id !== 'egypt.1').length) {
      throw new Error("Match schedule unavailable");
    }
    if (failedRequests > 0) onPartial?.();

    const seenMatches = new Set();
    const allMatches = results.flat().filter(match => {
      if (!match || match.id === undefined || match.id === null) return false;
      const matchKey = `${match.leagueId}:${match.id}`;
      if (seenMatches.has(matchKey)) return false;
      seenMatches.add(matchKey);
      return true;
    });

    return allMatches.sort((a, b) => {
      const statusOrder = { 'LIVE': 1, 'NS': 2, 'FT': 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error('Failed to load matches:', e);
    }
    if (strict) throw e;
    return [];
  }
};

// الاشتراك في تحديثات المباريات المباشرة
let liveRefreshInterval = null;
let clearLiveRefreshInterval = clearInterval;
let subscribers = [];
let lastNotifiedSignature = null;
let isLivePolling = false;
let lastPollCompletedAt = 0;
let activeVisibilityCleanup = null;

export const subscribeToLiveMatches = (
  callback,
  {
    intervalMs = 30000,
    dateStr: fixedDateStr,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    documentObj = typeof document !== 'undefined' ? document : null,
    windowObj = typeof window !== 'undefined' ? window : null,
    now = () => Date.now(),
    visibilityCooldownMs = 5000
  } = {}
) => {
  if (typeof callback === 'function' && !subscribers.includes(callback)) {
    subscribers.push(callback);
    lastNotifiedSignature = null;
  }

  const runLivePoll = async () => {
    if (isLivePolling || subscribers.length === 0) return;
    isLivePolling = true;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = fixedDateStr || `${yyyy}${mm}${dd}`;

    try {
      const currentMatches = await getMatches(dateStr, {
        strict: true,
        forceRefresh: true
      });
      lastPollCompletedAt = now();
      const signature = JSON.stringify(currentMatches);
      if (signature !== lastNotifiedSignature) {
        lastNotifiedSignature = signature;
        subscribers.slice().forEach(sub => sub(structuredClone(currentMatches)));
      }
    } catch {
      // Keep the last successful snapshot when all competitions fail.
    } finally {
      isLivePolling = false;
    }
  };

  if (!liveRefreshInterval) {
    clearLiveRefreshInterval = clearIntervalFn;
    liveRefreshInterval = setIntervalFn(runLivePoll, intervalMs);

    const handleResumeRefresh = () => {
      if (documentObj && documentObj.visibilityState === 'hidden') return;
      if (lastPollCompletedAt > 0 && now() - lastPollCompletedAt < visibilityCooldownMs) return;
      runLivePoll();
    };

    const handleVisibilityChange = () => {
      if (documentObj?.visibilityState === 'visible') {
        handleResumeRefresh();
      }
    };

    if (documentObj && typeof documentObj.addEventListener === 'function') {
      documentObj.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (windowObj && typeof windowObj.addEventListener === 'function') {
      windowObj.addEventListener('online', handleResumeRefresh);
    }

    activeVisibilityCleanup = () => {
      if (documentObj && typeof documentObj.removeEventListener === 'function') {
        documentObj.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (windowObj && typeof windowObj.removeEventListener === 'function') {
        windowObj.removeEventListener('online', handleResumeRefresh);
      }
    };
  }

  return () => {
    subscribers = subscribers.filter(sub => sub !== callback);
    if (subscribers.length === 0 && liveRefreshInterval !== null) {
      clearLiveRefreshInterval(liveRefreshInterval);
      liveRefreshInterval = null;
      lastNotifiedSignature = null;
      isLivePolling = false;
      lastPollCompletedAt = 0;
      if (activeVisibilityCleanup) {
        activeVisibilityCleanup();
        activeVisibilityCleanup = null;
      }
    }
  };
};
