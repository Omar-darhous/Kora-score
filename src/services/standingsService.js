import { cachedJson } from './requestCache.js';
import { resolveTeamLogo } from './logoUtils.js';
import { getMockEgyptianStandings } from './egyptianMockService.js';

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
export const getStandings = async (leagueId = 'eng.1', { strict = false, forceRefresh = false } = {}) => {
  if (leagueId === 'egypt.1') {
    return getMockEgyptianStandings();
  }

  try {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`;
    const data = await cachedJson(url, { ttl: 60000, forceRefresh });

    const season = parseSeasonMetadata(data.season);
    const children = data.children || [];

    let result = [];
    if (children.length === 1) {
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
  let standings = [];
  let loading = false;
  let error = null;
  let isStale = false;
  let mounted = true;
  let requestId = 0;

  const emit = () => {
    if (!mounted) return;
    onStateChange?.({
      leagueId: activeLeagueId,
      standings,
      loading,
      error,
      isStale
    });
  };

  const load = async (leagueId, { isRetry = false } = {}) => {
    if (!mounted || !leagueId) return;
    if (isRetry && loading) return;

    if (activeLeagueId !== leagueId) {
      activeLeagueId = leagueId;
      standings = [];
      isStale = false;
    }

    const currentRequestId = ++requestId;
    loading = true;
    error = null;
    emit();

    try {
      const data = await fetcher(leagueId, {
        strict: true,
        forceRefresh: isRetry
      });
      if (!mounted || currentRequestId !== requestId) return;
      standings = Array.isArray(data) ? data : [];
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
    return load(activeLeagueId, { isRetry: true });
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
      standings,
      loading,
      error,
      isStale
    })
  };
};
