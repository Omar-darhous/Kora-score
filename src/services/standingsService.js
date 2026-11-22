import { cachedJson } from './requestCache.js';
import { resolveTeamLogo } from './logoUtils.js';
import { getMockEgyptianStandings } from './egyptianMockService.js';
import { parseNationsLeagueGroup } from './tournamentRules.js';

const normalizeSeasonParam = (season) => {
  if (season === undefined || season === null || season === '') return null;
  const year = Number(season);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return Number.NaN;
  return year;
};

export const parseSeasonQueryParam = (rawSeason) => {
  if (rawSeason === undefined || rawSeason === null || rawSeason === '') {
    return { valid: true, season: null, raw: '' };
  }
  const trimmed = String(rawSeason).trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, season: null, raw: trimmed };
  }
  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { valid: false, season: null, raw: trimmed };
  }
  return { valid: true, season: year, raw: trimmed };
};

export const buildSeasonSearchParams = (prevParams, { leagueId, season, leagueChanged = false } = {}) => {
  const next = new URLSearchParams(prevParams);
  if (leagueId !== undefined) {
    next.set('league', leagueId);
  }
  if (leagueChanged || season === null || season === undefined || season === '') {
    next.delete('season');
  } else {
    next.set('season', String(season));
  }
  return next;
};

export const isHistoricalSeasonSelected = (selectedSeason, availableSeasons = [], currentSeasonYear = null) => {
  const normalizedSelected = normalizeSeasonParam(selectedSeason);
  if (normalizedSelected === null || Number.isNaN(normalizedSelected)) return false;

  const normalizedCurrent = normalizeSeasonParam(currentSeasonYear);
  if (normalizedCurrent !== null && !Number.isNaN(normalizedCurrent)) {
    return normalizedSelected !== normalizedCurrent;
  }

  if (Array.isArray(availableSeasons) && availableSeasons.length > 0) {
    const flaggedCurrent = availableSeasons.find(s => s?.isCurrent === true);
    if (flaggedCurrent) return normalizedSelected !== flaggedCurrent.year;
    const latestYear = Math.max(...availableSeasons.map(s => Number(s?.year)).filter(Number.isFinite));
    if (Number.isFinite(latestYear)) return normalizedSelected !== latestYear;
  }

  return true;
};

const formatSeasonLabel = (year, displayName = '', leagueId = '') => {
  const isCompactSplitLeague = leagueId === 'uefa.nations' || /nations league/i.test(String(displayName || ''));
  if (typeof displayName === 'string') {
    const shortSpan = displayName.match(/\b(\d{4})-(\d{2})\b/);
    if (shortSpan) {
      const startYear = Number(shortSpan[1]);
      if (Number.isInteger(startYear)) {
        return isCompactSplitLeague
          ? `${startYear}/${String(startYear + 1).slice(-2)}`
          : `${startYear}/${startYear + 1}`;
      }
    }
    const fullSpan = displayName.match(/\b(\d{4})[/-](\d{4})\b/);
    if (fullSpan) {
      return isCompactSplitLeague
        ? `${fullSpan[1]}/${fullSpan[2].slice(-2)}`
        : `${fullSpan[1]}/${fullSpan[2]}`;
    }
    const singleYear = displayName.match(/\b(19\d{2}|20\d{2})\b/);
    if (singleYear) {
      if (isCompactSplitLeague && Number.isInteger(Number(singleYear[1]))) {
        const sy = Number(singleYear[1]);
        return `${sy}/${String(sy + 1).slice(-2)}`;
      }
      return singleYear[1];
    }
  }
  if (isCompactSplitLeague && Number.isInteger(Number(year))) {
    const sy = Number(year);
    return `${sy}/${String(sy + 1).slice(-2)}`;
  }
  return String(year);
};

export const parseAvailableSeasons = (rawSeasons, { currentSeasonYear = null, leagueId = '' } = {}) => {
  if (!Array.isArray(rawSeasons) || rawSeasons.length === 0) return [];
  const seenYears = new Set();
  const normalizedCurrent = normalizeSeasonParam(currentSeasonYear);
  const parsed = [];

  for (const item of rawSeasons) {
    if (!item || typeof item !== 'object') continue;
    const year = normalizeSeasonParam(item.year);
    if (year === null || Number.isNaN(year) || seenYears.has(year)) continue;
    seenYears.add(year);

    const displayName = typeof item.displayName === 'string' && item.displayName.trim()
      ? item.displayName.trim()
      : String(year);

    const entry = {
      year,
      label: formatSeasonLabel(year, displayName, leagueId),
      displayName,
      isCurrent: normalizedCurrent !== null && !Number.isNaN(normalizedCurrent)
        ? year === normalizedCurrent
        : Boolean(item.isCurrent)
    };

    if (typeof item.startDate === 'string') entry.startDate = item.startDate;
    if (typeof item.endDate === 'string') entry.endDate = item.endDate;

    parsed.push(entry);
  }

  return parsed.sort((a, b) => b.year - a.year);
};

// استخراج وحفظ البيانات الوصفية للموسم الرياضي إن وجدت دون افتراضات
export const parseSeasonMetadata = (rawSeason) => {
  if (!rawSeason || typeof rawSeason !== 'object') {
    return null;
  }

  const season = {};
  if (rawSeason.year !== undefined && rawSeason.year !== null) {
    season.year = rawSeason.year;
  }
  if (typeof rawSeason.startDate === 'string') {
    season.startDate = rawSeason.startDate;
  }
  if (typeof rawSeason.endDate === 'string') {
    season.endDate = rawSeason.endDate;
  }
  if (typeof rawSeason.displayName === 'string') {
    season.displayName = rawSeason.displayName;
  }

  return Object.keys(season).length > 0 ? season : null;
};

export const parseStandingsEntries = (entries) => {
  const parsed = entries.map(item => {
    const stats = item.stats || [];
    const getStatVal = (name) => stats.find(s => s.name === name)?.value ?? 0;

    // استخراج معرف الفريق الثابت بنمط مطابق لـ homeTeamId و awayTeamId
    const teamId = item.team?.id !== undefined && item.team?.id !== null
      ? String(item.team.id)
      : (item.teamId ? String(item.teamId) : null);

    return {
      teamId,
      qualificationNote: item.note?.description || '',
      rank: getStatVal('rank') || item.rank || 0,
      team: item.team?.displayName || 'فريق كروي',
      logo: resolveTeamLogo(item.team),
      played: getStatVal('gamesPlayed'),
      win: getStatVal('wins'),
      draw: getStatVal('ties'),
      loss: getStatVal('losses'),
      goalsFor: getStatVal('pointsFor'),
      goalsAgainst: getStatVal('pointsAgainst'),
      points: getStatVal('points')
    };
  });

  return parsed.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    const gdA = (a.goalsFor || 0) - (a.goalsAgainst || 0);
    const gdB = (b.goalsFor || 0) - (b.goalsAgainst || 0);
    if (gdB !== gdA) {
      return gdB - gdA;
    }
    return (b.goalsFor || 0) - (a.goalsFor || 0);
  });
};

// جلب ترتيب الدوري الحقيقي (الدوري المصري الحالي المحدث لموسم 2025/2026 بدون شعارات أندية)
export const getStandings = async (leagueId = 'eng.1', { strict = false, forceRefresh = false, season: requestedSeasonRaw } = {}) => {
  const requestedSeason = normalizeSeasonParam(requestedSeasonRaw);
  if (Number.isNaN(requestedSeason)) {
    const err = new Error(`Invalid season parameter: ${requestedSeasonRaw}`);
    if (strict) throw err;
    return [];
  }

  if (leagueId === 'egypt.1') {
    if (requestedSeason !== null) {
      const err = new Error(`Historical season ${requestedSeason} is not available for mock league egypt.1`);
      if (strict) throw err;
      return [];
    }
    return getMockEgyptianStandings();
  }

  try {
    const baseUrl = `https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`;
    const url = requestedSeason !== null ? `${baseUrl}?season=${requestedSeason}` : baseUrl;
    const ttl = requestedSeason !== null ? 300000 : 60000;
    const data = await cachedJson(url, { ttl, forceRefresh });

    const season = parseSeasonMetadata(data.season);
    if (requestedSeason !== null) {
      const returnedYear = normalizeSeasonParam(season?.year);
      if (returnedYear === null || Number.isNaN(returnedYear) || returnedYear !== requestedSeason) {
        throw new Error(`Season ${requestedSeason} unavailable for league ${leagueId}`);
      }
    }

    let children = Array.isArray(data.children) ? [...data.children] : [];

    // In the 2018/19 UEFA Nations League edition, ESPN stores League A/B/C/D under separate seasontype=1..4 endpoints.
    if (leagueId === 'uefa.nations' && Number(season?.year) === 2018) {
      const presentLevels = new Set(
        children.map(c => parseNationsLeagueGroup(c?.name)?.level).filter(Boolean)
      );
      if (presentLevels.size < 4) {
        const divisionPages = await Promise.all(
          [1, 2, 3, 4].map(async (st) => {
            try {
              return await cachedJson(`${baseUrl}?season=2018&seasontype=${st}`, { ttl, forceRefresh });
            } catch {
              return null;
            }
          })
        );
        const merged = [];
        for (const page of divisionPages) {
          if (Array.isArray(page?.children)) {
            merged.push(...page.children);
          }
        }
        if (merged.length > 0) {
          children = [...merged, ...children];
        }
      }
    }

    let result = [];
    if (leagueId === 'uefa.nations') {
      const seenGroups = new Set();
      const formattedGroups = [];
      for (const group of children) {
        const entries = parseStandingsEntries(group?.standings?.entries || []);
        if (entries.length === 0) continue;
        const meta = parseNationsLeagueGroup(group?.name || '');
        const dedupeKey = meta ? meta.key : String(group?.name || '').trim().toUpperCase();
        if (dedupeKey && seenGroups.has(dedupeKey)) continue;
        if (dedupeKey) seenGroups.add(dedupeKey);
        const groupName = meta ? meta.arabicName : (group?.name || 'المجموعة');
        formattedGroups.push({
          name: groupName,
          rawName: group?.name || groupName,
          leagueLevel: meta?.level || null,
          levelOrder: meta?.levelOrder ?? 99,
          groupNumber: meta?.number ?? 99,
          season,
          entries: entries.map(entry => ({ ...entry, groupName, leagueLevel: meta?.level || null }))
        });
      }
      formattedGroups.sort((a, b) => {
        if (a.levelOrder !== b.levelOrder) return a.levelOrder - b.levelOrder;
        if (a.groupNumber !== b.groupNumber) return a.groupNumber - b.groupNumber;
        return String(a.name).localeCompare(String(b.name));
      });
      result = formattedGroups.map(({ levelOrder: _lo, groupNumber: _gn, ...rest }) => rest);
    } else if (children.length === 1) {
      const entries = children[0]?.standings?.entries || [];
      result = [{
        name: data.name || 'ترتيب الدوري',
        season,
        entries: parseStandingsEntries(entries)
      }];
    } else {
      result = children.map(group => ({
        name: group.name || 'المجموعة',
        season,
        entries: parseStandingsEntries(group.standings?.entries || [])
      }));
    }

    result = result.filter(group => Array.isArray(group.entries) && group.entries.length > 0);

    if (season) {
      result.season = season;
    }

    const availableSeasons = parseAvailableSeasons(data.seasons, {
      currentSeasonYear: requestedSeason === null ? season?.year ?? null : null,
      leagueId
    });
    if (availableSeasons.length > 0) {
      result.availableSeasons = availableSeasons;
    }

    return result;
  } catch (e) {
    console.error(`Failed to fetch standings for league ${leagueId}:`, e);
    if (strict) throw e;
    return [];
  }
};

export const createStandingsController = ({
  fetcher = getStandings,
  onStateChange
} = {}) => {
  let activeLeagueId = null;
  let activeSeason = null;
  let standings = [];
  let availableSeasons = [];
  let loading = false;
  let error = null;
  let isStale = false;
  let mounted = true;
  let requestId = 0;

  const emit = () => {
    if (!mounted) return;
    onStateChange?.({
      leagueId: activeLeagueId,
      season: activeSeason,
      standings,
      availableSeasons,
      loading,
      error,
      isStale
    });
  };

  const load = async (leagueId, { isRetry = false, season } = {}) => {
    if (!mounted || !leagueId) return;
    if (isRetry && loading) return;

    const leagueChanged = activeLeagueId !== leagueId;
    const rawTargetSeason = season !== undefined
      ? season
      : (leagueChanged ? null : activeSeason);
    const targetSeason = normalizeSeasonParam(rawTargetSeason);
    if (Number.isNaN(targetSeason)) return;

    const seasonChanged = activeSeason !== targetSeason;
    if (leagueChanged || seasonChanged) {
      activeLeagueId = leagueId;
      activeSeason = targetSeason;
      standings = [];
      isStale = false;
      if (leagueChanged) {
        availableSeasons = [];
      }
    }

    const currentRequestId = ++requestId;
    loading = true;
    error = null;
    emit();

    try {
      const fetchOptions = {
        strict: true,
        forceRefresh: isRetry
      };
      if (targetSeason !== null) {
        fetchOptions.season = targetSeason;
      }
      const data = await fetcher(leagueId, fetchOptions);
      if (!mounted || currentRequestId !== requestId) return;
      standings = Array.isArray(data) ? data : [];
      if (Array.isArray(data?.availableSeasons) && data.availableSeasons.length > 0) {
        availableSeasons = data.availableSeasons;
      }
      error = null;
      isStale = false;
    } catch (err) {
      if (!mounted || currentRequestId !== requestId) return;
      console.error('Error fetching league data:', err);
      error = 'تعذر جلب بيانات البطولة، يرجى المحاولة مرة أخرى.';
      isStale = standings.length > 0;
    } finally {
      if (mounted && currentRequestId === requestId) {
        loading = false;
        emit();
      }
    }
  };

  const retry = () => {
    if (!mounted || loading || !activeLeagueId) return Promise.resolve();
    return load(activeLeagueId, { isRetry: true, season: activeSeason });
  };

  const dispose = () => {
    mounted = false;
  };

  return {
    load,
    retry,
    dispose,
    getState: () => ({
      leagueId: activeLeagueId,
      season: activeSeason,
      standings,
      availableSeasons,
      loading,
      error,
      isStale
    })
  };
};
