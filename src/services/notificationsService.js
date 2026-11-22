import { isHalfTimePhase } from './matchResult.js';

/**
 * خدمة إشعارات الأندية المفضلة المباشرة (أثناء بقاء الموقع مفتوحاً).
 * - تعتمد حصرياً على الأندية المفضلة (لا تعامل البطولات المفضلة كأندية).
 * - تكتشف الأحداث الموثقة فقط: انطلاق المباراة، الأهداف (للفريق وضده)، نهاية المباراة، البطاقات الحمراء،
 *   ركلات الجزاء المسجّلة والضائعة والمتصدى لها، ونهاية الشوط الأول (اختيارياً).
 * - تمنع التكرار عبر التحديثات وإعادة تحميل الصفحة وتعدد التبويبات باستخدام BroadcastChannel + localStorage.
 * - تحفظ سجل الأحداث المرصودة بحجم محدود (MAX_SEEN_EVENTS) لمنع تضخم التخزين المحلي.
 */

export const NOTIFICATION_PREFS_KEY = 'kora_score_notification_prefs_v1';
export const NOTIFICATION_SEEN_KEY = 'kora_score_notification_seen_v1';
export const NOTIFICATION_CLAIM_KEY = 'kora_score_notification_claim_v1';
export const NOTIFICATION_CHANNEL_NAME = 'kora_score_notifications_v1';
export const MAX_SEEN_EVENTS = 250;
export const MAX_DETAIL_FETCHES_PER_POLL = 6;
export const STALE_GAP_RESEED_MS = 180000; // 3 دقائق: يمنع سيل الإشعارات بعد السكون أو انقطاع طويل

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  enabled: false,
  soundEnabled: false,
  events: Object.freeze({
    goals: true,
    kickoff: true,
    fullTime: true,
    redCards: true,
    penalties: true,
    halfTime: false
  })
});

let memoryPrefs = null;
let memorySeen = [];

const getSafeStorage = (storageOverride) => {
  if (storageOverride !== undefined) return storageOverride;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
};

export const sanitizeNotificationPrefs = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawEvents = src.events && typeof src.events === 'object' ? src.events : {};
  return {
    enabled: Boolean(src.enabled),
    soundEnabled: Boolean(src.soundEnabled),
    events: {
      goals: rawEvents.goals !== undefined ? Boolean(rawEvents.goals) : DEFAULT_NOTIFICATION_PREFS.events.goals,
      kickoff: rawEvents.kickoff !== undefined ? Boolean(rawEvents.kickoff) : DEFAULT_NOTIFICATION_PREFS.events.kickoff,
      fullTime: rawEvents.fullTime !== undefined ? Boolean(rawEvents.fullTime) : DEFAULT_NOTIFICATION_PREFS.events.fullTime,
      redCards: rawEvents.redCards !== undefined ? Boolean(rawEvents.redCards) : DEFAULT_NOTIFICATION_PREFS.events.redCards,
      penalties: rawEvents.penalties !== undefined ? Boolean(rawEvents.penalties) : DEFAULT_NOTIFICATION_PREFS.events.penalties,
      halfTime: rawEvents.halfTime !== undefined ? Boolean(rawEvents.halfTime) : DEFAULT_NOTIFICATION_PREFS.events.halfTime
    }
  };
};

export const loadNotificationPrefs = (storageOverride) => {
  const storage = getSafeStorage(storageOverride);
  try {
    if (storage) {
      const raw = storage.getItem(NOTIFICATION_PREFS_KEY);
      if (raw) {
        const sanitized = sanitizeNotificationPrefs(JSON.parse(raw));
        if (storageOverride === undefined) memoryPrefs = sanitized;
        return sanitized;
      }
    }
  } catch {
    // Fallback safely to defaults / memory
  }
  return sanitizeNotificationPrefs(storageOverride === undefined ? memoryPrefs : null);
};

export const saveNotificationPrefs = (prefs, storageOverride) => {
  const sanitized = sanitizeNotificationPrefs(prefs);
  if (storageOverride === undefined) memoryPrefs = sanitized;
  const storage = getSafeStorage(storageOverride);
  try {
    if (storage) {
      storage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(sanitized));
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  return sanitized;
};

export const loadSeenEventIds = (storageOverride) => {
  const storage = getSafeStorage(storageOverride);
  try {
    if (storage) {
      const raw = storage.getItem(NOTIFICATION_SEEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(item => typeof item === 'string' && item.trim() !== '').slice(-MAX_SEEN_EVENTS);
          if (storageOverride === undefined) memorySeen = clean;
          return clean;
        }
      }
    }
  } catch {
    // Safe fallback
  }
  return storageOverride === undefined ? memorySeen.slice(-MAX_SEEN_EVENTS) : [];
};

export const saveSeenEventIds = (ids, storageOverride) => {
  const unique = [];
  const seen = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id !== 'string' || !id.trim()) continue;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  const bounded = unique.slice(-MAX_SEEN_EVENTS);
  if (storageOverride === undefined) memorySeen = bounded;
  const storage = getSafeStorage(storageOverride);
  try {
    if (storage) {
      storage.setItem(NOTIFICATION_SEEN_KEY, JSON.stringify(bounded));
    }
  } catch {
    // Ignore storage failures
  }
  return bounded;
};

export const normalizeFollowedTeamId = (teamId) => {
  if (teamId === null || teamId === undefined || typeof teamId === 'boolean') return null;
  const clean = String(teamId).trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'nan') return null;
  return clean;
};

export const getFollowedTeamIds = (favoriteTeams = []) => {
  const ids = new Set();
  if (!Array.isArray(favoriteTeams)) return ids;
  for (const item of favoriteTeams) {
    const id = typeof item === 'object' && item !== null
      ? normalizeFollowedTeamId(item.id ?? item.teamId)
      : normalizeFollowedTeamId(item);
    if (id) ids.add(id);
  }
  return ids;
};

export const getFollowedMatchContext = (match, followedTeamIds) => {
  const homeId = normalizeFollowedTeamId(match?.homeTeamId);
  const awayId = normalizeFollowedTeamId(match?.awayTeamId);
  const homeFollowed = Boolean(homeId && followedTeamIds?.has(homeId));
  const awayFollowed = Boolean(awayId && followedTeamIds?.has(awayId));

  return {
    homeId,
    awayId,
    homeFollowed,
    awayFollowed,
    involvesFollowed: homeFollowed || awayFollowed,
    matchedTeamIds: [
      ...(homeFollowed ? [homeId] : []),
      ...(awayFollowed ? [awayId] : [])
    ]
  };
};

export const isHalfTimeMatch = (match = {}) => isHalfTimePhase(match);

export const buildMatchNotificationKey = (match) => `${String(match?.leagueId || 'unknown')}:${String(match?.id || '')}`;

export const buildDetailEventStableId = (matchKey, evt) => {
  if (evt?.id !== null && evt?.id !== undefined && String(evt.id).trim() !== '') {
    return `evt:${matchKey}:${String(evt.id).trim()}`;
  }
  const minuteKey = evt?.minute !== null && evt?.minute !== undefined ? `${evt.minute}+${evt.addedTime || 0}` : String(evt?.time || '');
  const teamKey = String(evt?.teamId || evt?.team || 'neutral');
  const playerKey = String(evt?.playerId || evt?.player || '').toLowerCase().trim();
  return `evt:${matchKey}:${evt?.eventType || evt?.type || 'unknown'}:${minuteKey}:${teamKey}:${playerKey}`;
};

export const getNotificationPermissionState = (NotificationCtor = typeof Notification !== 'undefined' ? Notification : undefined) => {
  if (!NotificationCtor || typeof NotificationCtor !== 'function') {
    return 'unsupported';
  }
  const perm = NotificationCtor.permission;
  if (perm === 'granted' || perm === 'denied' || perm === 'default') {
    return perm;
  }
  return 'unsupported';
};

export const requestBrowserNotificationPermission = async (NotificationCtor = typeof Notification !== 'undefined' ? Notification : undefined) => {
  const current = getNotificationPermissionState(NotificationCtor);
  if (current === 'unsupported') return 'unsupported';
  if (current === 'granted' || current === 'denied') return current;
  try {
    const result = await NotificationCtor.requestPermission();
    return result === 'granted' || result === 'denied' || result === 'default' ? result : 'default';
  } catch {
    return getNotificationPermissionState(NotificationCtor);
  }
};

export const buildMatchUrl = (match) => {
  const leagueId = String(match?.leagueId || '').trim();
  const matchId = String(match?.id || '').trim();
  if (!leagueId || !matchId) return '/matches';
  return `/match/${encodeURIComponent(leagueId)}/${encodeURIComponent(matchId)}`;
};

const formatScoreSnippet = (match) => {
  if (Number.isFinite(match?.homeScore) && Number.isFinite(match?.awayScore)) {
    return `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam}`;
  }
  return `${match?.homeTeam || ''} ضد ${match?.awayTeam || ''}`.trim();
};

const formatMinuteSuffix = (minuteStr) => {
  const clean = String(minuteStr ?? '').replace(/['"’`\u2032]/g, '').trim();
  return clean ? ` (${clean} د)` : '';
};

const buildGoalNotification = ({ match, context, scoringSide, scorerName, isPenalty, isOwnGoal, minute }) => {
  const scoreText = formatScoreSnippet(match);
  const scoringTeamName = scoringSide === 'home' ? match.homeTeam : match.awayTeam;
  const followedScored = (scoringSide === 'home' && context.homeFollowed) || (scoringSide === 'away' && context.awayFollowed);
  const followedConceded = !followedScored && context.involvesFollowed;
  const followedTeamName = context.homeFollowed ? match.homeTeam : match.awayTeam;

  let title;
  if (isPenalty) {
    title = followedConceded
      ? `⚽ ركلة جزاء في مرمى ${followedTeamName}!`
      : `⚽ هدف من ركلة جزاء لـ ${scoringTeamName}!`;
  } else if (isOwnGoal) {
    title = followedConceded
      ? `⚽ هدف عكسي في مرمى ${followedTeamName}!`
      : `⚽ هدف عكسي لصالح ${scoringTeamName}!`;
  } else if (followedConceded) {
    title = `⚽ هدف في مرمى ${followedTeamName}!`;
  } else {
    title = `⚽ هدف لـ ${scoringTeamName}!`;
  }

  const scorerPart = scorerName ? ` — ${scorerName}${formatMinuteSuffix(minute)}` : formatMinuteSuffix(minute);
  const body = `${scoreText}${scorerPart}`;

  return { title, body };
};

/**
 * منسّق منع التكرار عبر التبويبات المفتوحة باستخدام BroadcastChannel مع بديل localStorage.
 * ملاحظة معمارية: بدون خادم دفع مركزي، يوفّر هذا التنسيق + وسم `tag` الموحد للمتصفح
 * أفضل حماية ممكنة لمنع تكرار الإشعارات عبر التبويبات المتعددة.
 */
export const createCrossTabCoordinator = ({
  tabId = `tab-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`,
  storage: storageOverride,
  BroadcastChannelCtor = typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null,
  windowObj = typeof window !== 'undefined' ? window : null,
  now = () => Date.now()
} = {}) => {
  const storage = getSafeStorage(storageOverride);
  const seenSet = new Set(loadSeenEventIds(storage));
  const recentClaims = new Map();
  let channel = null;

  const persistSeen = () => {
    const bounded = saveSeenEventIds(Array.from(seenSet), storage);
    seenSet.clear();
    bounded.forEach(id => seenSet.add(id));
  };

  const ingestRemoteSeen = (eventKey, remoteTabId) => {
    if (!eventKey || remoteTabId === tabId) return;
    seenSet.add(eventKey);
    recentClaims.set(eventKey, { tabId: remoteTabId, ts: now() });
  };

  if (typeof BroadcastChannelCtor === 'function') {
    try {
      channel = new BroadcastChannelCtor(NOTIFICATION_CHANNEL_NAME);
      channel.onmessage = (msgEvent) => {
        const data = msgEvent?.data;
        if (!data || data.tabId === tabId) return;
        if ((data.type === 'CLAIM' || data.type === 'SEEN') && data.eventKey) {
          ingestRemoteSeen(data.eventKey, data.tabId);
        }
      };
    } catch {
      channel = null;
    }
  }

  const handleStorageEvent = (e) => {
    if (!e || (e.key !== NOTIFICATION_SEEN_KEY && e.key !== NOTIFICATION_CLAIM_KEY)) return;
    if (e.key === NOTIFICATION_SEEN_KEY) {
      loadSeenEventIds(storage).forEach(id => seenSet.add(id));
    } else if (e.key === NOTIFICATION_CLAIM_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.eventKey && parsed.tabId !== tabId) {
          ingestRemoteSeen(parsed.eventKey, parsed.tabId);
        }
      } catch {
        // Ignore malformed cross-tab claim
      }
    }
  };

  if (windowObj && typeof windowObj.addEventListener === 'function') {
    windowObj.addEventListener('storage', handleStorageEvent);
  }

  const hasSeen = (eventKey) => {
    if (!eventKey) return true;
    if (seenSet.has(eventKey)) return true;
    const stored = loadSeenEventIds(storage);
    if (stored.includes(eventKey)) {
      stored.forEach(id => seenSet.add(id));
      return true;
    }
    return false;
  };

  const markSeen = (eventKey, { broadcast = true } = {}) => {
    if (!eventKey) return;
    seenSet.add(eventKey);
    persistSeen();
    if (broadcast && channel) {
      try {
        channel.postMessage({ type: 'SEEN', eventKey, tabId, ts: now() });
      } catch {
        // Ignore closed channel
      }
    }
  };

  const tryClaim = (eventKey) => {
    if (!eventKey) return false;
    if (hasSeen(eventKey)) return false;

    const existingClaim = recentClaims.get(eventKey);
    if (existingClaim && existingClaim.tabId !== tabId && now() - existingClaim.ts < 30000) {
      return false;
    }

    // فحص آخر حجز مسجل في localStorage لمنع السباق بين التبويبات
    if (storage) {
      try {
        const rawClaim = storage.getItem(NOTIFICATION_CLAIM_KEY);
        if (rawClaim) {
          const parsed = JSON.parse(rawClaim);
          if (parsed?.eventKey === eventKey && parsed.tabId !== tabId && now() - Number(parsed.ts || 0) < 30000) {
            seenSet.add(eventKey);
            return false;
          }
        }
        storage.setItem(NOTIFICATION_CLAIM_KEY, JSON.stringify({ eventKey, tabId, ts: now() }));
      } catch {
        // Continue with in-memory + BroadcastChannel
      }
    }

    recentClaims.set(eventKey, { tabId, ts: now() });
    seenSet.add(eventKey);
    persistSeen();

    if (channel) {
      try {
        channel.postMessage({ type: 'CLAIM', eventKey, tabId, ts: now() });
      } catch {
        // Ignore closed channel
      }
    }

    return true;
  };

  const destroy = () => {
    if (channel && typeof channel.close === 'function') {
      try {
        channel.close();
      } catch {
        // Ignore
      }
      channel = null;
    }
    if (windowObj && typeof windowObj.removeEventListener === 'function') {
      windowObj.removeEventListener('storage', handleStorageEvent);
    }
  };

  return {
    tabId,
    hasSeen,
    markSeen,
    tryClaim,
    getSeenCount: () => seenSet.size,
    destroy
  };
};

/**
 * محرك كشف أحداث الأندية المفضلة القابل للاختبار الحتمي.
 */
export const createNotificationEngine = ({
  getMatchDetailsFn,
  coordinator,
  storage,
  now = () => Date.now(),
  maxDetailFetchesPerPoll = MAX_DETAIL_FETCHES_PER_POLL,
  staleGapReseedMs = STALE_GAP_RESEED_MS
} = {}) => {
  const internalCoordinator = coordinator || createCrossTabCoordinator({ storage, now });
  const matchBaselines = new Map();
  const seededTeamIds = new Set();
  let initialized = false;
  let lastProcessAt = 0;

  const seedMatchBaseline = async (match, { fetchLiveDetails = true } = {}) => {
    const matchKey = buildMatchNotificationKey(match);
    const snapshot = {
      status: match.status,
      isHalfTime: isHalfTimeMatch(match),
      homeScore: Number.isFinite(match.homeScore) ? match.homeScore : 0,
      awayScore: Number.isFinite(match.awayScore) ? match.awayScore : 0
    };
    matchBaselines.set(matchKey, snapshot);

    // تسجيل الحالات القائمة حالياً كمرصودة مسبقاً حتى لا يُعاد تشغيلها عند التحديث أو إضافة فريق جديد
    if (match.status === 'LIVE') {
      internalCoordinator.markSeen(`kickoff:${matchKey}`, { broadcast: false });
      if (snapshot.isHalfTime) {
        internalCoordinator.markSeen(`halftime:${matchKey}`, { broadcast: false });
      }
      if (snapshot.homeScore > 0) {
        internalCoordinator.markSeen(`goal:${matchKey}:home:${snapshot.homeScore}`, { broadcast: false });
      }
      if (snapshot.awayScore > 0) {
        internalCoordinator.markSeen(`goal:${matchKey}:away:${snapshot.awayScore}`, { broadcast: false });
      }
      if (fetchLiveDetails && typeof getMatchDetailsFn === 'function') {
        try {
          const details = await getMatchDetailsFn(match.leagueId, match.id);
          for (const evt of details?.events || []) {
            internalCoordinator.markSeen(buildDetailEventStableId(matchKey, evt), { broadcast: false });
          }
        } catch {
          // Do not block seeding if details request fails temporarily
        }
      }
    } else if (match.status === 'FT') {
      internalCoordinator.markSeen(`kickoff:${matchKey}`, { broadcast: false });
      internalCoordinator.markSeen(`fulltime:${matchKey}`, { broadcast: false });
    }
  };

  const syncFavoriteTeams = (followedTeamIds) => {
    // إزالة الفرق المحذوفة من المفضلة فوراً
    for (const id of Array.from(seededTeamIds)) {
      if (!followedTeamIds.has(id)) {
        seededTeamIds.delete(id);
      }
    }
    const newlyAdded = [];
    for (const id of followedTeamIds) {
      if (!seededTeamIds.has(id)) {
        newlyAdded.push(id);
      }
    }
    return newlyAdded;
  };

  const processMatches = async (matches = [], favoriteTeams = [], prefsInput = DEFAULT_NOTIFICATION_PREFS, options = {}) => {
    const prefs = sanitizeNotificationPrefs(prefsInput);
    const currentTs = now();
    const followedTeamIds = getFollowedTeamIds(favoriteTeams);

    if (followedTeamIds.size === 0) {
      seededTeamIds.clear();
      matchBaselines.clear();
      lastProcessAt = currentTs;
      return [];
    }

    const followedMatches = (Array.isArray(matches) ? matches : []).filter(
      (m) => m && m.id !== undefined && m.id !== null && getFollowedMatchContext(m, followedTeamIds).involvesFollowed
    );

    const newlyAddedTeams = syncFavoriteTeams(followedTeamIds);
    const isStaleRecovery = Boolean(
      initialized &&
      lastProcessAt > 0 &&
      (currentTs - lastProcessAt > staleGapReseedMs || options.forceReseed === true)
    );

    // 1. التهيئة الأولية أو العودة بعد سكون/انقطاع طويل: تأسيس Baseline بدون إطلاق سيل إشعارات قديمة
    if (!initialized || options.isInitialBaseline === true || isStaleRecovery) {
      let seededLiveDetails = 0;
      for (const match of followedMatches) {
        const shouldFetch = match.status === 'LIVE' && seededLiveDetails < maxDetailFetchesPerPoll;
        if (shouldFetch) seededLiveDetails += 1;
        await seedMatchBaseline(match, { fetchLiveDetails: shouldFetch });
      }
      followedTeamIds.forEach(id => seededTeamIds.add(id));
      initialized = true;
      lastProcessAt = currentTs;
      return [];
    }

    // 2. إذا أضاف المستخدم نادياً جديداً للمفضلة أثناء التصفح، نؤسس مبارياته الحالية أولاً قبل إرسال أي إشعار لاحق
    const newlyAddedSet = new Set(newlyAddedTeams);
    const newlySeededMatchKeys = new Set();
    if (newlyAddedSet.size > 0) {
      let seededCount = 0;
      for (const match of followedMatches) {
        const ctx = getFollowedMatchContext(match, followedTeamIds);
        const alreadyFollowedByExistingTeam = ctx.matchedTeamIds.some(id => seededTeamIds.has(id));
        if (!alreadyFollowedByExistingTeam) {
          const matchKey = buildMatchNotificationKey(match);
          const shouldFetch = match.status === 'LIVE' && seededCount < maxDetailFetchesPerPoll;
          if (shouldFetch) seededCount += 1;
          await seedMatchBaseline(match, { fetchLiveDetails: shouldFetch });
          newlySeededMatchKeys.add(matchKey);
        }
      }
      newlyAddedTeams.forEach(id => seededTeamIds.add(id));
    }

    if (!prefs.enabled) {
      // تحديث خط الأساس بصمت أثناء الإيقاف لمنع تراكم إشعارات قديمة عند إعادة التفعيل
      for (const match of followedMatches) {
        const matchKey = buildMatchNotificationKey(match);
        matchBaselines.set(matchKey, {
          status: match.status,
          isHalfTime: isHalfTimeMatch(match),
          homeScore: Number.isFinite(match.homeScore) ? match.homeScore : 0,
          awayScore: Number.isFinite(match.awayScore) ? match.awayScore : 0
        });
      }
      lastProcessAt = currentTs;
      return [];
    }

    const notifications = [];
    let detailFetchCount = 0;

    const pushIfClaimed = (eventKey, payload) => {
      if (!internalCoordinator.tryClaim(eventKey)) return false;
      notifications.push({
        eventKey,
        tag: eventKey,
        url: buildMatchUrl(payload.match),
        ...payload
      });
      return true;
    };

    for (const match of followedMatches) {
      const matchKey = buildMatchNotificationKey(match);
      if (newlySeededMatchKeys.has(matchKey)) continue;

      const context = getFollowedMatchContext(match, followedTeamIds);
      const prev = matchBaselines.get(matchKey);
      const currHalfTime = isHalfTimeMatch(match);
      const currHomeScore = Number.isFinite(match.homeScore) ? match.homeScore : 0;
      const currAwayScore = Number.isFinite(match.awayScore) ? match.awayScore : 0;

      // مباراة جديدة لم تكن ضمن خط الأساس (مثلاً بعد منتصف الليل أو تبدّل الجدول)
      if (!prev) {
        const shouldFetch = match.status === 'LIVE' && detailFetchCount < maxDetailFetchesPerPoll;
        if (shouldFetch) detailFetchCount += 1;
        await seedMatchBaseline(match, { fetchLiveDetails: shouldFetch });
        continue;
      }

      // أ) انطلاق المباراة (NS -> LIVE)
      if (prefs.events.kickoff && prev.status === 'NS' && match.status === 'LIVE') {
        pushIfClaimed(`kickoff:${matchKey}`, {
          kind: 'KICKOFF',
          match,
          title: '⚽ انطلقت المباراة!',
          body: `${match.homeTeam} ضد ${match.awayTeam} — ${match.leagueName || 'كورة سكور'}`
        });
      }

      // ب) نهاية الشوط الأول (اختياري)
      if (prefs.events.halfTime && !prev.isHalfTime && currHalfTime) {
        pushIfClaimed(`halftime:${matchKey}`, {
          kind: 'HALF_TIME',
          match,
          title: '⏱️ نهاية الشوط الأول',
          body: formatScoreSnippet(match)
        });
      }

      // ج) جلب الأحداث التفصيلية الموثقة فقط للمباريات المباشرة (أو التي انتهت لتوها) للأندية المفضلة
      const justFinished = prev.status === 'LIVE' && match.status === 'FT';
      const needsDetails = (match.status === 'LIVE' || justFinished) && (
        prefs.events.goals || prefs.events.redCards || prefs.events.penalties
      );
      const emittedGoalSides = new Set();

      if (needsDetails && typeof getMatchDetailsFn === 'function' && detailFetchCount < maxDetailFetchesPerPoll) {
        detailFetchCount += 1;
        try {
          const details = await getMatchDetailsFn(match.leagueId, match.id);
          const detailEvents = Array.isArray(details?.events) ? details.events : [];

          for (const evt of detailEvents) {
            const stableId = buildDetailEventStableId(matchKey, evt);
            const eventType = evt.eventType;

            if (eventType === 'PENALTY_GOAL' && (prefs.events.penalties || prefs.events.goals)) {
              const side = evt.team === 'home' || evt.team === 'away' ? evt.team : null;
              if (side) {
                const { title, body } = buildGoalNotification({
                  match,
                  context,
                  scoringSide: side,
                  scorerName: evt.player,
                  isPenalty: true,
                  isOwnGoal: false,
                  minute: evt.time
                });
                if (pushIfClaimed(stableId, { kind: 'PENALTY_GOAL', match, title, body })) {
                  emittedGoalSides.add(side);
                  const sideScore = side === 'home' ? currHomeScore : currAwayScore;
                  if (sideScore > 0) {
                    internalCoordinator.markSeen(`goal:${matchKey}:${side}:${sideScore}`);
                  }
                }
              }
            } else if ((eventType === 'GOAL' || eventType === 'OWN_GOAL') && prefs.events.goals) {
              const side = evt.team === 'home' || evt.team === 'away' ? evt.team : null;
              if (side) {
                const { title, body } = buildGoalNotification({
                  match,
                  context,
                  scoringSide: side,
                  scorerName: evt.player,
                  isPenalty: false,
                  isOwnGoal: eventType === 'OWN_GOAL',
                  minute: evt.time
                });
                if (pushIfClaimed(stableId, { kind: eventType, match, title, body })) {
                  emittedGoalSides.add(side);
                  const sideScore = side === 'home' ? currHomeScore : currAwayScore;
                  if (sideScore > 0) {
                    internalCoordinator.markSeen(`goal:${matchKey}:${side}:${sideScore}`);
                  }
                }
              }
            } else if ((eventType === 'PENALTY_MISSED' || eventType === 'PENALTY_SAVED') && prefs.events.penalties) {
              const eventTeamName = evt.team === 'home'
                ? match.homeTeam
                : evt.team === 'away'
                  ? match.awayTeam
                  : (context.homeFollowed ? match.homeTeam : match.awayTeam);
              const title = eventType === 'PENALTY_SAVED'
                ? `🧤 ركلة جزاء متصدى لها في مباراة ${eventTeamName}`
                : `❌ ركلة جزاء ضائعة لـ ${eventTeamName}`;
              const playerPart = evt.player ? `${evt.player}${formatMinuteSuffix(evt.time)} — ` : '';
              const body = `${playerPart}${formatScoreSnippet(match)}`;
              pushIfClaimed(stableId, { kind: eventType, match, title, body });
            } else if ((eventType === 'RED_CARD' || eventType === 'SECOND_YELLOW_RED') && prefs.events.redCards) {
              const followedTeamName = context.homeFollowed ? match.homeTeam : match.awayTeam;
              const cardTeamName = evt.team === 'home' ? match.homeTeam : evt.team === 'away' ? match.awayTeam : '';
              const title = `🔴 بطاقة حمراء في مباراة ${followedTeamName}!`;
              const playerPart = evt.player ? `${evt.player}${cardTeamName ? ` (${cardTeamName})` : ''}${formatMinuteSuffix(evt.time)} — ` : '';
              const body = `${playerPart}${formatScoreSnippet(match)}`;
              pushIfClaimed(stableId, { kind: eventType, match, title, body });
            }
          }
        } catch {
          // Safe fallback: if details fail, still check verified score delta for goals only
        }
      }

      // د) احتياط الأهداف من تغيّر النتيجة الموثق فقط إذا لم يصل حدث الهدف التفصيلي بعد (لا يُستنتج منه أي بطاقة أو ركلة جزاء!)
      if (prefs.events.goals && (match.status === 'LIVE' || justFinished)) {
        if (currHomeScore > prev.homeScore && !emittedGoalSides.has('home')) {
          const { title, body } = buildGoalNotification({
            match,
            context,
            scoringSide: 'home',
            scorerName: '',
            isPenalty: false,
            isOwnGoal: false,
            minute: match.minute
          });
          pushIfClaimed(`goal:${matchKey}:home:${currHomeScore}`, { kind: 'GOAL', match, title, body });
        }
        if (currAwayScore > prev.awayScore && !emittedGoalSides.has('away')) {
          const { title, body } = buildGoalNotification({
            match,
            context,
            scoringSide: 'away',
            scorerName: '',
            isPenalty: false,
            isOwnGoal: false,
            minute: match.minute
          });
          pushIfClaimed(`goal:${matchKey}:away:${currAwayScore}`, { kind: 'GOAL', match, title, body });
        }
      }

      // هـ) نهاية المباراة (LIVE -> FT)
      if (prefs.events.fullTime && justFinished) {
        let suffix = '';
        if (match.finishType === 'penalties' && Number.isFinite(match.homePenalties) && Number.isFinite(match.awayPenalties)) {
          suffix = ` (ركلات الترجيح ${match.homePenalties} - ${match.awayPenalties})`;
        } else if (match.finishType === 'extra-time') {
          suffix = ' (بعد الوقت الإضافي)';
        }
        pushIfClaimed(`fulltime:${matchKey}`, {
          kind: 'FULL_TIME',
          match,
          title: `🏁 انتهت المباراة: ${formatScoreSnippet(match)}`,
          body: `${match.leagueName || 'كورة سكور'}${suffix}`
        });
      }

      matchBaselines.set(matchKey, {
        status: match.status,
        isHalfTime: currHalfTime,
        homeScore: currHomeScore,
        awayScore: currAwayScore
      });
    }

    lastProcessAt = currentTs;
    return notifications;
  };

  const resetBaselines = () => {
    matchBaselines.clear();
    seededTeamIds.clear();
    initialized = false;
    lastProcessAt = 0;
  };

  return {
    processMatches,
    resetBaselines,
    coordinator: internalCoordinator,
    isInitialized: () => initialized
  };
};

/**
 * إرسال إشعار المتصفح مع تفضيل Service Worker showNotification عند توفره،
 * والرجوع الآمن إلى window.Notification مع منع تكرار التنقل عند النقر.
 */
export const deliverBrowserNotification = async (
  payload,
  {
    NotificationCtor = typeof Notification !== 'undefined' ? Notification : undefined,
    serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
    windowObj = typeof window !== 'undefined' ? window : undefined,
    onNavigate,
    icon = '/favicon.svg'
  } = {}
) => {
  if (getNotificationPermissionState(NotificationCtor) !== 'granted') {
    return { delivered: false, method: 'none', reason: 'permission-not-granted' };
  }

  const options = {
    body: payload.body || '',
    icon,
    badge: icon,
    tag: payload.tag || payload.eventKey || undefined,
    dir: 'rtl',
    lang: 'ar',
    silent: false,
    data: {
      url: payload.url || '/matches'
    }
  };

  // 1. تفضيل Service Worker عند وجود تسجيل نشط
  if (serviceWorker && typeof serviceWorker.getRegistration === 'function') {
    try {
      const reg = await serviceWorker.getRegistration('/sw-notifications.js');
      if (reg && reg.active && typeof reg.showNotification === 'function') {
        await reg.showNotification(payload.title || 'كورة سكور', options);
        return { delivered: true, method: 'service-worker', reason: 'ok' };
      }
    } catch {
      // Fallback to open-page Notification constructor
    }
  }

  // 2. البديل المباشر في الصفحة المفتوحة
  try {
    const notification = new NotificationCtor(payload.title || 'كورة سكور', options);
    let navigated = false;
    notification.onclick = (evt) => {
      if (evt && typeof evt.preventDefault === 'function') {
        evt.preventDefault();
      }
      if (windowObj && typeof windowObj.focus === 'function') {
        windowObj.focus();
      }
      if (typeof notification.close === 'function') {
        notification.close();
      }
      if (!navigated && typeof onNavigate === 'function') {
        navigated = true;
        onNavigate(payload.url || '/matches', payload.match || null);
      }
    };
    return { delivered: true, method: 'window-notification', notification, reason: 'ok' };
  } catch {
    return { delivered: false, method: 'none', reason: 'delivery-failed' };
  }
};

export const registerNotificationServiceWorker = async (
  serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  locationObj = typeof window !== 'undefined' ? window.location : undefined
) => {
  if (!serviceWorker || typeof serviceWorker.register !== 'function') return null;
  const protocol = locationObj?.protocol || '';
  const hostname = locationObj?.hostname || '';
  const isSecureContext = protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isSecureContext) return null;

  try {
    return await serviceWorker.register('/sw-notifications.js', { scope: '/' });
  } catch {
    return null;
  }
};
