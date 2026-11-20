import { cachedJson } from './requestCache.js';
import { normalizeScoreboardMatches } from './matchesService.js';
import { getLeagues } from './logoUtils.js';

const SINGLE_CALENDAR_YEAR_LEAGUES = new Set(['fifa.world', 'usa.1']);

export const getSeasonCalendarYears = (leagueId, seasonYear) => {
  const year = Number(seasonYear);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return [];
  }
  if (SINGLE_CALENDAR_YEAR_LEAGUES.has(leagueId)) {
    return [year];
  }
  return [year, year + 1];
};

const formatMatchDateKey = (isoDate) => {
  if (typeof isoDate !== 'string' || !isoDate) return '';
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return '';
  return new Date(ts).toISOString().slice(0, 10);
};

export const formatArabicMatchDate = (isoDate) => {
  if (typeof isoDate !== 'string' || !isoDate) return 'تاريخ غير محدد';
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return 'تاريخ غير محدد';
  try {
    return new Date(ts).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return isoDate.slice(0, 10);
  }
};

const extractReliableRoundNumber = (rawEvent) => {
  const weekNum = rawEvent?.week?.number ?? rawEvent?.week;
  if (Number.isInteger(Number(weekNum)) && Number(weekNum) > 0) {
    return Number(weekNum);
  }
  const comp = rawEvent?.competitions?.[0];
  const compRound = comp?.round?.number ?? rawEvent?.round?.number;
  if (Number.isInteger(Number(compRound)) && Number(compRound) > 0) {
    return Number(compRound);
  }
  const noteText = (comp?.notes || []).map(n => n?.text || '').join(' ');
  const noteMatch = noteText.match(/\b(?:matchday|round|week|jornada|giornata)\s+(\d{1,2})\b/i);
  if (noteMatch) {
    const parsed = Number(noteMatch[1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

export const formatArabicMonthLabel = (monthKey) => {
  if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
    return 'تاريخ غير محدد';
  }
  const [yearStr, monthStr] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 15));
  try {
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  } catch {
    return monthKey;
  }
};

export const getHistoricalSeasonMatches = async (
  leagueId,
  seasonYear,
  { strict = false, forceRefresh = false, signal } = {}
) => {
  const year = Number(seasonYear);
  if (!leagueId || !Number.isInteger(year) || year < 1900 || year > 2100) {
    const err = new Error(`Invalid historical season parameters: ${leagueId} / ${seasonYear}`);
    if (strict) throw err;
    return [];
  }

  if (leagueId === 'egypt.1') {
    const err = new Error('Historical match schedules are not available for mock league egypt.1');
    if (strict) throw err;
    return [];
  }

  const league = getLeagues().find(l => l.id === leagueId) || {
    id: leagueId,
    name: leagueId,
    logo: ''
  };
  const years = getSeasonCalendarYears(leagueId, year);

  try {
    const pages = await Promise.all(years.map(async (calendarYear) => {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${calendarYear}&limit=1000`;
      const data = await cachedJson(url, {
        ttl: 300000,
        timeout: 20000,
        forceRefresh,
        signal
      });
      return { calendarYear, data };
    }));

    const seenIds = new Set();
    const normalizedMatches = [];

    for (const { data } of pages) {
      const rawEvents = Array.isArray(data?.events) ? data.events : [];
      const seasonEvents = [];
      for (const event of rawEvents) {
        if (!event || event.id === undefined || event.id === null) continue;
        const eventId = String(event.id);
        if (seenIds.has(eventId)) continue;
        if (Number(event.season?.year) !== year) continue;
        seenIds.add(eventId);
        seasonEvents.push(event);
      }

      if (seasonEvents.length === 0) continue;

      const mapped = normalizeScoreboardMatches(
        { leagues: data?.leagues || [], events: seasonEvents },
        league,
        `${year}0101`
      );

      for (let i = 0; i < mapped.length; i += 1) {
        const rawEvent = seasonEvents[i];
        const item = mapped[i];
        const isoDate = rawEvent?.date || '';
        const dateTs = Date.parse(isoDate);
        normalizedMatches.push({
          ...item,
          date: isoDate,
          dateKey: formatMatchDateKey(isoDate),
          dateTs: Number.isFinite(dateTs) ? dateTs : 0,
          seasonYear: year,
          seasonSlug: rawEvent?.season?.slug || '',
          roundNumber: extractReliableRoundNumber(rawEvent)
        });
      }
    }

    // Sort newest-first so finals / closing matchdays appear first; unknown dates last.
    normalizedMatches.sort((a, b) => {
      if (a.dateTs > 0 && b.dateTs === 0) return -1;
      if (a.dateTs === 0 && b.dateTs > 0) return 1;
      if (b.dateTs !== a.dateTs) return b.dateTs - a.dateTs;
      return String(a.id).localeCompare(String(b.id));
    });

    return normalizedMatches;
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error(`Failed to load historical matches for ${leagueId} (${year}):`, err);
    }
    if (strict) throw err;
    return [];
  }
};

export const groupHistoricalMatchesByDate = (matches = []) => {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  const groupsMap = new Map();
  for (const match of matches) {
    if (!match) continue;
    const key = match.dateKey || 'unknown';
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        dateKey: key,
        label: key === 'unknown' ? 'تاريخ غير محدد' : formatArabicMatchDate(match.date),
        matches: []
      });
    }
    groupsMap.get(key).matches.push(match);
  }
  return Array.from(groupsMap.values());
};

const sortMatchesChronologically = (matches = []) => [...matches].sort((a, b) => {
  const aValid = Number.isFinite(a?.dateTs) && a.dateTs > 0;
  const bValid = Number.isFinite(b?.dateTs) && b.dateTs > 0;
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  if (aValid && bValid && a.dateTs !== b.dateTs) return a.dateTs - b.dateTs;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
});

const resolveCompetitionStage = (match) => {
  const slug = String(match?.seasonSlug || '').toLowerCase().trim();
  if (/league-phase/.test(slug)) return { id: 'stage-league-phase', label: 'مرحلة الدوري', order: 1 };
  if (/group-stage|group/.test(slug)) return { id: 'stage-group-stage', label: 'دور المجموعات', order: 1 };
  if (/regular-season/.test(slug)) return { id: 'stage-regular-season', label: 'الموسم المنتظم', order: 1 };
  if (/playoff|play-off|wild-card/.test(slug)) return { id: 'stage-playoff', label: 'ملحق الأدوار الإقصائية', order: 2 };
  if (/round-of-32|round-one/.test(slug)) return { id: 'stage-r32', label: 'دور الـ 32', order: 3 };
  if (/round-of-16/.test(slug)) return { id: 'stage-r16', label: 'دور الـ 16', order: 4 };
  if (/quarterfinal/.test(slug)) return { id: 'stage-qf', label: 'ربع النهائي', order: 5 };
  if (/semifinal/.test(slug)) return { id: 'stage-sf', label: 'نصف النهائي', order: 6 };
  if (/3rd-place|third-place|bronze/.test(slug)) return { id: 'stage-third-place', label: 'المركز الثالث', order: 7 };
  if (/^final$|mls-cup|conference.*final/.test(slug)) return { id: 'stage-final', label: 'النهائي', order: 8 };
  return null;
};

const buildMonthSubGroups = (matches) => {
  const chronological = sortMatchesChronologically(matches);
  const byMonth = new Map();
  for (const match of chronological) {
    const monthKey = match.dateKey && match.dateKey.length >= 7 ? match.dateKey.slice(0, 7) : 'unknown';
    if (!byMonth.has(monthKey)) {
      byMonth.set(monthKey, {
        id: `month-${monthKey}`,
        label: monthKey === 'unknown' ? 'تاريخ غير محدد' : formatArabicMonthLabel(monthKey),
        matches: []
      });
    }
    byMonth.get(monthKey).matches.push(match);
  }
  return Array.from(byMonth.values()).map(group => ({
    ...group,
    count: group.matches.length,
    dateGroups: groupHistoricalMatchesByDate(group.matches),
    subFilters: []
  }));
};

const buildRoundSubGroups = (matches) => {
  const chronological = sortMatchesChronologically(matches);
  const byRound = new Map();
  for (const match of chronological) {
    const key = Number.isInteger(match.roundNumber) && match.roundNumber > 0
      ? match.roundNumber
      : 'other';
    if (!byRound.has(key)) {
      byRound.set(key, {
        id: key === 'other' ? 'round-other' : `round-${key}`,
        roundNumber: key === 'other' ? Number.MAX_SAFE_INTEGER : key,
        label: key === 'other' ? 'مباريات أخرى' : `الجولة ${key}`,
        matches: []
      });
    }
    byRound.get(key).matches.push(match);
  }
  return Array.from(byRound.values())
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map(({ roundNumber: _rn, ...group }) => ({
      ...group,
      count: group.matches.length,
      dateGroups: groupHistoricalMatchesByDate(group.matches),
      subFilters: []
    }));
};

export const organizeHistoricalMatches = (matches = [], leagueId = '') => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { mode: 'months', groups: [], defaultGroupId: null, totalMatches: 0 };
  }

  const validMatches = matches.filter(Boolean);
  const isTournamentCompetition =
    leagueId.startsWith('uefa.') ||
    leagueId === 'fifa.world' ||
    leagueId === 'caf.nations' ||
    leagueId === 'usa.1';

  // 1. Stage-based organization for multi-stage competitions (UCL, UEL, World Cup, MLS)
  const stageMap = new Map();
  let matchedStagesCount = 0;
  for (const match of validMatches) {
    const stage = resolveCompetitionStage(match);
    if (stage) {
      matchedStagesCount += 1;
      if (!stageMap.has(stage.id)) {
        stageMap.set(stage.id, { ...stage, matches: [] });
      }
      stageMap.get(stage.id).matches.push(match);
    } else if (isTournamentCompetition) {
      if (!stageMap.has('stage-other')) {
        stageMap.set('stage-other', { id: 'stage-other', label: 'مباريات أخرى', order: 99, matches: [] });
      }
      stageMap.get('stage-other').matches.push(match);
    }
  }

  if (stageMap.size > 1 || (isTournamentCompetition && matchedStagesCount > 0)) {
    const groups = Array.from(stageMap.values())
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...stage }) => {
        const chronological = sortMatchesChronologically(stage.matches);
        const withRound = chronological.filter(m => Number.isInteger(m.roundNumber) && m.roundNumber > 0).length;
        let subFilters = [];
        if (chronological.length > 24) {
          subFilters = withRound / chronological.length >= 0.8
            ? buildRoundSubGroups(chronological)
            : buildMonthSubGroups(chronological);
        }
        return {
          ...stage,
          matches: chronological,
          count: chronological.length,
          dateGroups: groupHistoricalMatchesByDate(chronological),
          subFilters
        };
      });

    return {
      mode: 'stages',
      groups,
      defaultGroupId: groups[0]?.id || null,
      totalMatches: validMatches.length
    };
  }

  // 2. Round-based organization ONLY when ESPN provides reliable round/week metadata (>= 80%)
  const withReliableRound = validMatches.filter(m => Number.isInteger(m.roundNumber) && m.roundNumber > 0).length;
  if (withReliableRound / validMatches.length >= 0.8) {
    const groups = buildRoundSubGroups(validMatches);
    return {
      mode: 'rounds',
      groups,
      defaultGroupId: groups[0]?.id || null,
      totalMatches: validMatches.length
    };
  }

  // 3. Honest date/month fallback when ESPN omits round numbers (never fabricate rounds!)
  const groups = buildMonthSubGroups(validMatches);
  return {
    mode: 'months',
    groups,
    defaultGroupId: groups[0]?.id || null,
    totalMatches: validMatches.length
  };
};

export const createHistoricalMatchesController = ({
  fetcher = getHistoricalSeasonMatches,
  onStateChange
} = {}) => {
  let activeLeagueId = null;
  let activeSeason = null;
  let matches = [];
  let loading = false;
  let error = null;
  let mounted = true;
  let requestId = 0;
  let activeAbortController = null;

  const emit = () => {
    if (!mounted) return;
    onStateChange?.({
      leagueId: activeLeagueId,
      season: activeSeason,
      matches,
      loading,
      error
    });
  };

  const abortInFlight = () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  };

  const load = async (leagueId, season, { forceRefresh = false } = {}) => {
    if (!mounted || !leagueId || season === null || season === undefined) return;

    const targetChanged = activeLeagueId !== leagueId || activeSeason !== season;
    if (targetChanged) {
      activeLeagueId = leagueId;
      activeSeason = season;
      matches = [];
    }

    abortInFlight();
    const controller = new AbortController();
    activeAbortController = controller;
    const currentRequestId = ++requestId;

    loading = true;
    error = null;
    emit();

    try {
      const data = await fetcher(leagueId, season, {
        strict: true,
        forceRefresh,
        signal: controller.signal
      });
      if (!mounted || controller.signal.aborted || currentRequestId !== requestId) return;
      matches = Array.isArray(data) ? data : [];
      error = null;
    } catch (err) {
      if (!mounted || controller.signal.aborted || err?.name === 'AbortError' || currentRequestId !== requestId) {
        return;
      }
      error = 'تعذر تحميل مباريات هذا الموسم التاريخي. يرجى المحاولة مرة أخرى.';
    } finally {
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
      if (mounted && currentRequestId === requestId) {
        loading = false;
        emit();
      }
    }
  };

  const retry = () => {
    if (!mounted || loading || !activeLeagueId || activeSeason === null) return Promise.resolve();
    return load(activeLeagueId, activeSeason, { forceRefresh: true });
  };

  const dispose = () => {
    mounted = false;
    abortInFlight();
  };

  return {
    load,
    retry,
    dispose,
    getState: () => ({
      leagueId: activeLeagueId,
      season: activeSeason,
      matches,
      loading,
      error
    })
  };
};
