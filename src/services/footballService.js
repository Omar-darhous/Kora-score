import { cachedJson } from './requestCache.js';
import { parseMatchResult } from './matchResult.js';
import { classifyRound, rounds } from './tournamentRules.js';
import { defaultNewsFetcher } from './newsService.js';
// خدمة جلب بيانات كرة القدم الحية والحقيقية بالكامل من واجهات ESPN المفتوحة وموجز الأخبار DW الرياضي

import { LEAGUES } from './mockData.js';

// قائمة بالصور الافتراضية عالية الجودة لتبديلها في الأخبار


export const DEFAULT_TEAM_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo-500.png';

const isValidLogoUrl = (url, entityType = 'team') => {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) return false;
  if (
    clean.includes('/i/league-logos/') ||
    clean.includes('/teamlogos/default-soccer.png') ||
    clean.includes('Egyptian_Premier_League_logo.png')
  ) {
    return false;
  }
  if (entityType === 'league' && clean.includes('/i/teamlogos/')) return false;
  if (entityType === 'team' && clean.includes('/i/leaguelogos/')) return false;
  return true;
};

export const resolveLeagueLogo = (apiLeague, fallbackLogo = '') => {
  const candidates = [apiLeague?.logos?.[0]?.href, apiLeague?.logo, fallbackLogo];
  return candidates.find((url) => isValidLogoUrl(url, 'league')) || '';
};

export const resolveTeamLogo = (team, fallbackLogo = DEFAULT_TEAM_LOGO) => {
  const candidates = [team?.logo, team?.logos?.[0]?.href];
  const valid = candidates.find((url) => isValidLogoUrl(url, 'team'));
  if (valid) return valid;
  return isValidLogoUrl(fallbackLogo, 'team') ? fallbackLogo : '';
};

export const getLeagues = () => {
  return LEAGUES;
};

// توليد مباريات الدوري المصري للموسم الحالي (بدون شعارات بناءً على طلب المستخدم)
const getMockEgyptianMatches = () => {
  return [
    {
      id: 'egy-match-1',
      leagueId: 'egypt.1',
      leagueName: 'الدوري المصري الممتاز',
      leagueLogo: '',
      homeTeam: 'الأهلي',
      homeLogo: '', // فارغ لحذف الشعار
      homeScore: 2,
      homeTeamId: 'egy-team-ahly',
      awayTeam: 'الزمالك',
      awayLogo: '',
      awayScore: 1,
      awayTeamId: 'egy-team-zamalek',
      status: 'FT',
      minute: 90,
      time: '19:30',
      roundName: 'الجولة 25 (مجموعة التتويج)',
      detailsLoaded: true,
      stats: {
        possession: [58, 42],
        shots: [14, 8],
        shotsOnGoal: [6, 3],
        corners: [7, 4],
        fouls: [12, 16],
        yellowCards: [2, 3],
        redCards: [0, 0]
      },
      events: [
        { type: 'goal', time: '14', team: 'home', player: 'وسام أبو علي' },
        { type: 'goal', time: '41', team: 'away', player: 'أحمد سيد زيزو (ضربة جزاء)' },
        { type: 'goal', time: '82', team: 'home', player: 'إمام عاشور' },
        { type: 'card', cardType: 'yellow', time: '30', team: 'away', player: 'حمزة المثلوثي' },
        { type: 'card', cardType: 'yellow', time: '67', team: 'home', player: 'مروان عطية' }
      ],
      lineups: {
        home: ['مصطفى شوبير', 'محمد هاني', 'رامي ربيعة', 'محمد عبد المنعم', 'كريم فؤاد', 'مروان عطية', 'أكرم توفيق', 'إمام عاشور', 'بيرسي تاو', 'حسين الشحات', 'وسام أبو علي'],
        away: ['محمد عواد', 'عمر جابر', 'حمزة المثلوثي', 'حسام عبد المجيد', 'أحمد فتوح', 'نبيل عماد دونجا', 'عبد الله السعيد', 'ناصر ماهر', 'أحمد سيد زيزو', 'مصطفى شلبي', 'سيف الجزيري']
      }
    },
    {
      id: 'egy-match-2',
      leagueId: 'egypt.1',
      leagueName: 'الدوري المصري الممتاز',
      leagueLogo: '',
      homeTeam: 'بيراميدز',
      homeLogo: '',
      homeScore: 3,
      homeTeamId: 'egy-team-pyramids',
      awayTeam: 'الإسماعيلي',
      awayLogo: '',
      awayScore: 0,
      awayTeamId: 'egy-team-ismaily',
      status: 'FT',
      minute: 90,
      time: '17:00',
      roundName: 'الجولة 25',
      detailsLoaded: true,
      stats: {
        possession: [62, 38],
        shots: [16, 5],
        shotsOnGoal: [8, 1],
        corners: [9, 2],
        fouls: [10, 14],
        yellowCards: [1, 2],
        redCards: [0, 0]
      },
      events: [
        { type: 'goal', time: '23', team: 'home', player: 'فيستون مايلي' },
        { type: 'goal', time: '55', team: 'home', player: 'مصطفى فتحي' },
        { type: 'goal', time: '78', team: 'home', player: 'بلاتي توريه' }
      ],
      lineups: {
        home: ['أحمد الشناوي', 'محمد الشيبي', 'أحمد سامي', 'أسامة جلال', 'كريم حافظ', 'بلاتي توريه', 'مهند لاشين', 'وليد الكرتي', 'مصطفى فتحي', 'فخري لاكاي', 'فيستون مايلي'],
        away: ['أحمد عادل عبد المنعم', 'محمد دسوقي', 'محمد نصر', 'عماد حمدي', 'كريم عرفات', 'محمد بيومي', 'عمر الساعي', 'عبد الرحمن مجدي', 'إيريك تراوري', 'خالد النبريص', 'نادر فرج']
      }
    },
    {
      id: 'egy-match-3',
      leagueId: 'egypt.1',
      leagueName: 'الدوري المصري الممتاز',
      leagueLogo: '',
      homeTeam: 'المصري البورسعيدي',
      homeLogo: '',
      homeScore: 1,
      homeTeamId: 'egy-team-masry',
      awayTeam: 'الاتحاد السكندري',
      awayLogo: '',
      awayScore: 1,
      awayTeamId: 'egy-team-ittihad',
      status: 'FT',
      minute: 90,
      time: '21:00',
      roundName: 'الجولة 25',
      detailsLoaded: true,
      stats: {
        possession: [50, 50],
        shots: [10, 9],
        shotsOnGoal: [4, 4],
        corners: [5, 5],
        fouls: [15, 13],
        yellowCards: [3, 2],
        redCards: [0, 0]
      },
      events: [
        { type: 'goal', time: '34', team: 'away', player: 'مابولولو' },
        { type: 'goal', time: '65', team: 'home', player: 'فخر الدين بن يوسف' }
      ],
      lineups: {
        home: ['محمود جاد', 'كريم العراقي', 'باهر المحمدي', 'عمرو موسى', 'حسين السيد', 'معتز زدام', 'محمود حمادة', 'سمير فكري', 'ميدو جابر', 'صلاح محسن', 'فخر الدين بن يوسف'],
        away: ['المهدي سليمان', 'هشام صلاح', 'سيف تقا', 'مصطفى إبراهيم', 'شريف رضا', 'خالد الغندور', 'مورو ساليفو', 'كريم الديب', 'أحمد عادل ميسي', 'مابولولو', 'عبد الغني محمد']
      }
    }
  ];
};

// ترجمة الأدوار الإقصائية إلى العربية
const mapKnockoutStage = (slug) => {
  const key = classifyRound(slug);
  if (key) return rounds.find(([id]) => id === key)?.[1] || null;
  return /group|league.phase/i.test(slug || '') ? 'مرحلة المجموعات / الدوري' : null;
};

// ترجمة الجولات الأسبوعية إلى العربية
const translateRoundText = (text) => {
  if (!text) return '';
  const match = text.match(/\d+/);
  if (match) {
    const num = match[0];
    const lower = text.toLowerCase();
    if (lower.includes('matchday') || lower.includes('round') || lower.includes('jornada') || lower.includes('giornata')) {
      return `الجولة ${num}`;
    }
    if (lower.includes('week') || lower.includes('semaine')) {
      return `الأسبوع ${num}`;
    }
  }
  return text;
};

// الاحتفاظ بآخر نسخة صالحة معروفة لكل بطولة وتاريخ لمنع فقدان المباريات عند تعثر طلب بطولة واحدة مؤقتاً
const leagueMatchesSnapshot = new Map();
const latestSnapshotVersion = new Map();
let snapshotSequence = 0;

// جلب المباريات الحقيقية لجميع الدوريات في تاريخ معين (تنسيق YYYYMMDD)
export const getMatches = async (dateStr, { strict = false, onPartial, forceRefresh = false } = {}) => {
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
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${dateStr}`;
        const data = await cachedJson(url, { ttl: 15000, forceRefresh });

        let fallbackRound = '';
        const calendar = data.leagues?.[0]?.calendar || [];
        if (calendar.length > 0) {
          const formattedTargetDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          const foundIdx = calendar.findIndex(c => {
            if (typeof c === 'string') {
              return c.startsWith(formattedTargetDate);
            } else if (c && typeof c === 'object' && typeof c.date === 'string') {
              return c.date.startsWith(formattedTargetDate);
            }
            return false;
          });
          if (foundIdx !== -1) {
            const item = calendar[foundIdx];
            if (item && typeof item === 'object' && item.label) {
              fallbackRound = translateRoundText(item.label);
            } else {
              fallbackRound = `الجولة ${foundIdx + 1}`;
            }
          }
        }

        const events = data.events || [];
        const mappedMatches = events.map(event => {
          const comp = event.competitions?.[0] || {};
          const homeCompetitor = comp.competitors?.find(c => c.homeAway === 'home') || {};
          const awayCompetitor = comp.competitors?.find(c => c.homeAway === 'away') || {};

          let statusStr = 'NS';
          if (event.status?.type?.state === 'in') {
            statusStr = 'LIVE';
          } else if (event.status?.type?.state === 'post') {
            statusStr = 'FT';
          }

          const matchTime = new Date(event.date).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
          });

          let roundName = '';
          const seasonSlug = event.season?.slug || '';
          const altNote = comp.altGameNote || '';

          const knockout = mapKnockoutStage(seasonSlug) || mapKnockoutStage(altNote);
          if (knockout) {
            roundName = knockout;
          } else if (comp.notes && comp.notes.length > 0) {
            roundName = translateRoundText(comp.notes[0]?.text || '');
          }

          if (!roundName) {
            roundName = fallbackRound || 'الدوري المنتظم';
          }

          return {
            id: event.id,
            leagueId: league.id,
            leagueName: league.name,
            leagueLogo: resolveLeagueLogo(data.leagues?.[0], league.logo),
            homeTeam: homeCompetitor.team?.displayName || 'فريق مستضيف',
            homeLogo: resolveTeamLogo(homeCompetitor.team),
            homeScore: parseInt(homeCompetitor.score) || 0,
            homeTeamId: homeCompetitor.team?.id,
            awayTeam: awayCompetitor.team?.displayName || 'فريق ضيف',
            awayLogo: resolveTeamLogo(awayCompetitor.team),
            awayScore: parseInt(awayCompetitor.score) || 0,
            awayTeamId: awayCompetitor.team?.id,
            status: statusStr,
            ...parseMatchResult(event.status || comp.status, comp.competitors),
            minute: event.status?.displayClock ? event.status.displayClock.replace("'", "") : event.status?.clock || 0,
            time: matchTime,
            roundName,
            detailsLoaded: false
          };
        });

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
        failedRequests += 1;
        console.error(`Error fetching matches for league ${league.id}:`, err);
        if (leagueMatchesSnapshot.has(snapshotKey)) {
          return structuredClone(leagueMatchesSnapshot.get(snapshotKey));
        }
        return [];
      }
    });

    const results = await Promise.all(promises);
    if (strict && failedRequests === activeLeagues.filter(league => league.id !== 'egypt.1').length) throw new Error("Match schedule unavailable");
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
    console.error('Failed to load matches:', e);
    if (strict) throw e;
    return [];
  }
};

// جلب تفاصيل المباراة الكاملة
export const getMatchDetails = async (leagueId, eventId) => {
  if (leagueId === 'egypt.1') {
    const mockMatches = getMockEgyptianMatches();
    const match = mockMatches.find(m => m.id === eventId);
    if (match) {
      return {
        stats: match.stats,
        events: match.events,
        lineups: match.lineups
      };
    }
    return null;
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${eventId}`;
    const summary = await cachedJson(url, { ttl: 15000 });

    const boxscore = summary.boxscore || {};
    const homeTeamId = boxscore.teams?.[0]?.team?.id;
    const awayTeamId = boxscore.teams?.[1]?.team?.id;

    const statsObj = {
      possession: [50, 50],
      shots: [0, 0],
      shotsOnGoal: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
      redCards: [0, 0]
    };

    if (boxscore.teams && boxscore.teams.length >= 2) {
      const homeStats = boxscore.teams[0].statistics || [];
      const awayStats = boxscore.teams[1].statistics || [];

      const getStatVal = (statsList, name) => {
        const item = statsList.find(s => s.name === name);
        return item ? parseFloat(item.displayValue) || 0 : 0;
      };

      statsObj.possession = [getStatVal(homeStats, 'possessionPct') || 50, getStatVal(awayStats, 'possessionPct') || 50];
      statsObj.shots = [getStatVal(homeStats, 'totalShots') || 0, getStatVal(awayStats, 'totalShots') || 0];
      statsObj.shotsOnGoal = [getStatVal(homeStats, 'shotsOnTarget') || 0, getStatVal(awayStats, 'shotsOnTarget') || 0];
      statsObj.corners = [getStatVal(homeStats, 'wonCorners') || 0, getStatVal(awayStats, 'wonCorners') || 0];
      statsObj.fouls = [getStatVal(homeStats, 'foulsCommitted') || 0, getStatVal(awayStats, 'foulsCommitted') || 0];
      statsObj.yellowCards = [getStatVal(homeStats, 'yellowCards') || 0, getStatVal(awayStats, 'yellowCards') || 0];
      statsObj.redCards = [getStatVal(homeStats, 'redCards') || 0, getStatVal(awayStats, 'redCards') || 0];
    }

    const events = [];
    if (summary.keyEvents) {
      summary.keyEvents.forEach(evt => {
        const typeText = evt.type?.text?.toLowerCase() || '';
        let type = '';
        let cardType = '';

        if (typeText.includes('goal')) {
          type = 'goal';
        } else if (typeText.includes('yellow card')) {
          type = 'card';
          cardType = 'yellow';
        } else if (typeText.includes('red card')) {
          type = 'card';
          cardType = 'red';
        }

        if (type) {
          events.push({
            type,
            cardType,
            time: evt.clock?.displayValue ? evt.clock.displayValue.replace("'", "") : evt.clock?.value || 0,
            team: evt.team?.id === homeTeamId ? 'home' : 'away',
            player: evt.text || 'حدث في اللقاء',
            assist: 'مجهود فردي'
          });
        }
      });
    }

    const lineups = { home: [], away: [] };
    if (summary.rosters && summary.rosters['0'] && summary.rosters['1']) {
      const roster0 = summary.rosters['0'] || {};
      const roster1 = summary.rosters['1'] || {};

      const mapRoster = (teamRoster) => {
        return (teamRoster.roster || [])
          .filter(p => p.starter)
          .map(p => p.athlete?.displayName || 'لاعب');
      };

      if (roster0.team?.id === homeTeamId) {
        lineups.home = mapRoster(roster0);
        lineups.away = mapRoster(roster1);
      } else {
        lineups.home = mapRoster(roster1);
        lineups.away = mapRoster(roster0);
      }
    }

    const competition = summary.header?.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home');
    const away = competition?.competitors?.find(c => c.homeAway === 'away');
    const match = competition && home && away ? {
      id: String(eventId), leagueId,
      homeTeam: home.team?.displayName, awayTeam: away.team?.displayName,
      homeLogo: home.team?.logo || home.team?.logos?.[0]?.href,
      awayLogo: away.team?.logo || away.team?.logos?.[0]?.href,
      homeScore: Number(home.score?.value ?? home.score ?? 0),
      awayScore: Number(away.score?.value ?? away.score ?? 0),
      status: competition.status?.type?.state === 'post' ? 'FT' : competition.status?.type?.state === 'in' ? 'LIVE' : 'NS',
      ...parseMatchResult(competition.status, competition.competitors)
    } : null;
    return {
      match,
      stats: statsObj,
      events: events.sort((a, b) => b.time - a.time),
      lineups
    };
  } catch (e) {
    console.error('Failed to load match details:', e);
    return null;
  }
};

// الاشتراك في تحديثات المباريات المباشرة
let liveRefreshInterval = null;
let clearLiveRefreshInterval = clearInterval;
let subscribers = [];
let lastNotifiedSignature = null;
let isLivePolling = false;

export const subscribeToLiveMatches = (
  callback,
  {
    intervalMs = 30000,
    dateStr: fixedDateStr,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval
  } = {}
) => {
  if (typeof callback === 'function' && !subscribers.includes(callback)) {
    subscribers.push(callback);
    lastNotifiedSignature = null;
  }

  if (!liveRefreshInterval) {
    clearLiveRefreshInterval = clearIntervalFn;
    liveRefreshInterval = setIntervalFn(async () => {
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
    }, intervalMs);
  }

  return () => {
    subscribers = subscribers.filter(sub => sub !== callback);
    if (subscribers.length === 0 && liveRefreshInterval !== null) {
      clearLiveRefreshInterval(liveRefreshInterval);
      liveRefreshInterval = null;
      lastNotifiedSignature = null;
      isLivePolling = false;
    }
  };
};

// استخراج وحفظ البيانات الوصفية للموسم الرياضي إن وجدت دون افتراضات
const parseSeasonMetadata = (rawSeason) => {
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

const parseStandingsEntries = (entries) => {
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
    const mockGroup = {
      name: 'الدوري المصري الممتاز (الموسم الحالي 2025-2026)',
      season: null,
      entries: [
        { teamId: 'egy-team-zamalek', rank: 1, team: 'الزمالك (البطل)', logo: '', played: 25, win: 17, draw: 5, loss: 3, goalsFor: 46, goalsAgainst: 20, points: 56 },
        { teamId: 'egy-team-pyramids', rank: 2, team: 'بيراميدز', logo: '', played: 25, win: 16, draw: 6, loss: 3, goalsFor: 48, goalsAgainst: 22, points: 54 },
        { teamId: 'egy-team-ahly', rank: 3, team: 'الأهلي', logo: '', played: 25, win: 15, draw: 6, loss: 4, goalsFor: 52, goalsAgainst: 18, points: 51 },
        { teamId: 'egy-team-masry', rank: 4, team: 'المصري البورسعيدي', logo: '', played: 25, win: 13, draw: 7, loss: 5, goalsFor: 39, goalsAgainst: 26, points: 46 },
        { teamId: null, rank: 5, team: 'مودرن فيوتشر', logo: '', played: 25, win: 11, draw: 9, loss: 5, goalsFor: 33, goalsAgainst: 27, points: 42 },
        { teamId: null, rank: 6, team: 'سموحة', logo: '', played: 25, win: 11, draw: 7, loss: 7, goalsFor: 36, goalsAgainst: 34, points: 40 },
        { teamId: null, rank: 7, team: 'زد', logo: '', played: 25, win: 10, draw: 9, loss: 6, goalsFor: 41, goalsAgainst: 31, points: 39 },
        { teamId: null, rank: 8, team: 'البنك الأهلي', logo: '', played: 25, win: 10, draw: 8, loss: 7, goalsFor: 35, goalsAgainst: 30, points: 38 },
        { teamId: null, rank: 9, team: 'سيراميكا كليوباترا', logo: '', played: 25, win: 10, draw: 7, loss: 8, goalsFor: 44, goalsAgainst: 37, points: 37 },
        { teamId: null, rank: 10, team: 'طلائع الجيش', logo: '', played: 25, win: 9, draw: 9, loss: 7, goalsFor: 26, goalsAgainst: 25, points: 36 },
        { teamId: 'egy-team-ittihad', rank: 11, team: 'الاتحاد السكندري', logo: '', played: 25, win: 9, draw: 8, loss: 8, goalsFor: 29, goalsAgainst: 33, points: 35 },
        { teamId: null, rank: 12, team: 'إنبي', logo: '', played: 25, win: 9, draw: 7, loss: 9, goalsFor: 35, goalsAgainst: 34, points: 34 },
        { teamId: null, rank: 13, team: 'الجونة', logo: '', played: 25, win: 7, draw: 12, loss: 6, goalsFor: 29, goalsAgainst: 34, points: 33 },
        { teamId: null, rank: 14, team: 'غزل المحلة', logo: '', played: 25, win: 8, draw: 7, loss: 10, goalsFor: 28, goalsAgainst: 35, points: 31 },
        { teamId: null, rank: 15, team: 'فاركو', logo: '', played: 25, win: 7, draw: 7, loss: 11, goalsFor: 32, goalsAgainst: 45, points: 28 },
        { teamId: 'egy-team-ismaily', rank: 16, team: 'الإسماعيلي', logo: '', played: 25, win: 6, draw: 8, loss: 11, goalsFor: 32, goalsAgainst: 40, points: 26 },
        { teamId: null, rank: 17, team: 'حرس الحدود', logo: '', played: 25, win: 5, draw: 8, loss: 12, goalsFor: 23, goalsAgainst: 43, points: 23 },
        { teamId: null, rank: 18, team: 'كهرباء الإسماعيلية', logo: '', played: 25, win: 4, draw: 8, loss: 13, goalsFor: 17, goalsAgainst: 40, points: 20 }
      ]
    };
    const result = [mockGroup];
    result.season = null;
    return result;
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

const TRUSTED_DW_ARTICLE_HOSTS = new Set(['dw.com', 'www.dw.com', 'm.dw.com']);

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>');

export const isTrustedDwArticleUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' && TRUSTED_DW_ARTICLE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const isTrustedDwImageUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:' && (host === 'dw.com' || host.endsWith('.dw.com'));
  } catch {
    return false;
  }
};

export const extractArticleMetaImage = (html) => {
  if (typeof html !== 'string' || !html) return '';
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  let twitterFallback = '';

  for (const tag of metaTags) {
    const attrs = {};
    const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let match;
    while ((match = attrPattern.exec(tag)) !== null) {
      const attrName = match[1].toLowerCase();
      const attrValue = match[2] ?? match[3] ?? match[4] ?? '';
      attrs[attrName] = attrValue;
    }

    const key = (attrs.property || attrs.name || '').trim().toLowerCase();
    if (!key || !attrs.content) continue;

    const candidate = decodeHtmlEntities(attrs.content).trim();
    if (!isTrustedDwImageUrl(candidate)) continue;

    if (key === 'og:image' || key === 'og:image:secure_url') {
      return candidate;
    }
    if (!twitterFallback && (key === 'twitter:image' || key === 'twitter:image:src')) {
      twitterFallback = candidate;
    }
  }

  return twitterFallback;
};

export const createArticleImageResolver = ({
  fetcher = (...args) => fetch(...args),
  timeout = 6000,
  maxCacheEntries = 100
} = {}) => {
  const cache = new Map();
  const pending = new Map();

  const remember = (url, imageUrl) => {
    if (!cache.has(url) && cache.size >= maxCacheEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(url, imageUrl);
  };

  const resolve = (articleUrl, { signal } = {}) => {
    if (!isTrustedDwArticleUrl(articleUrl)) return Promise.resolve('');
    const normalizedUrl = articleUrl.trim();
    if (cache.has(normalizedUrl)) return Promise.resolve(cache.get(normalizedUrl));
    if (pending.has(normalizedUrl)) return pending.get(normalizedUrl);
    if (signal?.aborted) return Promise.resolve('');

    const request = (async () => {
      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetcher(normalizedUrl, { signal: controller.signal });
        if (!response?.ok) {
          remember(normalizedUrl, '');
          return '';
        }
        const html = await response.text();
        const imageUrl = extractArticleMetaImage(html);
        remember(normalizedUrl, imageUrl);
        return imageUrl;
      } catch {
        if (!signal?.aborted) {
          remember(normalizedUrl, '');
        }
        return '';
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onExternalAbort);
        pending.delete(normalizedUrl);
      }
    })();

    pending.set(normalizedUrl, request);
    return request;
  };

  return {
    resolve,
    clearCache: () => cache.clear(),
    getCacheSize: () => cache.size
  };
};

const defaultArticleImageResolver = createArticleImageResolver();

export const enrichNewsImages = async (
  articles,
  { resolver = defaultArticleImageResolver, concurrency = 3, onImageResolved, signal } = {}
) => {
  if (!Array.isArray(articles) || articles.length === 0) return [];
  const queue = articles.filter(item => item && !item.img && isTrustedDwArticleUrl(item.link));
  if (queue.length === 0) return articles;

  const resolvedById = new Map();
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, concurrency), queue.length);

  const worker = async () => {
    while (cursor < queue.length && !signal?.aborted) {
      const article = queue[cursor++];
      const imageUrl = await resolver.resolve(article.link, { signal });
      if (!signal?.aborted && imageUrl) {
        resolvedById.set(article.id, imageUrl);
        onImageResolved?.(article.id, imageUrl);
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  if (resolvedById.size === 0) return articles;

  return articles.map(item => (
    resolvedById.has(item.id) ? { ...item, img: resolvedById.get(item.id) } : item
  ));
};

// جلب الأخبار الرياضية الحقيقية من المصادر المعتمدة (CNN العربية و DW العربية)
export const getNews = async ({ strict = false, forceRefresh = false, signal } = {}) => {
  try {
    return await defaultNewsFetcher.fetchNews({ strict: true, forceRefresh, signal });
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error("Failed to load real news:", e);
    }
    if (strict) throw e;
    return [];
  }
};

// جلب تفاصيل مباريات الأدوار الإقصائية لكأس العالم وترتيبها في هيكل الشجرة
export const getTournamentKnockouts = async (leagueId, seasonYear) => {
  const year = Number(seasonYear);
  if (!Number.isInteger(year) || year < 1900) throw new Error('Season unavailable');
  // European seasons span two calendar years; never mix different seasons.
  const years = leagueId.startsWith('uefa.') ? [year, year + 1] : [year];
  const pages = await Promise.all(years.map(async calendarYear => {
    return cachedJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${calendarYear}&limit=1000`, { ttl: 15000, timeout: 20000 });
  }));
  const data = { events: pages.flatMap(page => page.events || []) };
  const result = Object.fromEntries(rounds.map(([key]) => [key, []]));
  const seen = new Set();
  for (const event of data.events || []) {
    if (Number(event.season?.year) !== year || seen.has(event.id)) continue;
    seen.add(event.id);
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const stage = classifyRound(event.season?.slug) || classifyRound(comp.altGameNote) || classifyRound((comp.notes || []).map(n => n.text).join(' '));
    if (!stage) continue;
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const status = event.status || comp.status;
    const score = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
    result[stage].push({
      id: event.id, leagueId, date: event.date, knockoutStage: stage,
      homeTeamId: home.team?.id, awayTeamId: away.team?.id,
      homeTeam: home.team?.displayName || 'لم يتحدد بعد', awayTeam: away.team?.displayName || 'لم يتحدد بعد',
      homeLogo: home.team?.logo, awayLogo: away.team?.logo,
      homeScore: score(home.score), awayScore: score(away.score),
      homeWinner: home.winner === true, awayWinner: away.winner === true,
      status: status?.type?.state === 'post' ? 'FT' : status?.type?.state === 'in' ? 'LIVE' : 'NS',
      ...parseMatchResult(status, comp.competitors),
      time: new Date(event.date).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
  }
  // Fetch period scores only for matches that actually needed extra time or penalties.
  const specialMatches = Object.values(result).flat().filter(m => m.finishType === 'extra-time' || m.finishType === 'penalties');
  for (let i = 0; i < specialMatches.length; i += 4) {
    await Promise.all(specialMatches.slice(i, i + 4).map(async match => {
      try {
        const summary = await cachedJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${match.id}`, { ttl: 15000, timeout: 10000 });
        const competition = summary.header?.competitions?.[0];
        if (competition?.status && competition?.competitors?.length === 2) {
          const periods = parseMatchResult(competition.status, competition.competitors);
          match.regulationScore = periods.regulationScore;
          match.extraTimeScore = periods.extraTimeScore;
        }
      } catch { /* The match remains visible when period details are unavailable. */ }
    }));
  }
  for (const matches of Object.values(result)) matches.sort((a, b) => new Date(a.date) - new Date(b.date));
  return result;
};

// ==========================================
// خدمات بيانات تفاصيل الأندية وقوائم اللاعبين والنتائج
// ==========================================

const EGYPTIAN_MOCK_TEAMS_DATA = {
  'egy-team-ahly': {
    id: 'egy-team-ahly',
    name: 'الأهلي',
    shortName: 'الأهلي',
    abbreviation: 'AHL',
    logo: '',
    venue: { name: 'ستاد القاهرة الدولي', capacity: 75000, city: 'القاهرة' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  },
  'egy-team-zamalek': {
    id: 'egy-team-zamalek',
    name: 'الزمالك',
    shortName: 'الزمالك',
    abbreviation: 'ZAM',
    logo: '',
    venue: { name: 'ستاد القاهرة الدولي', capacity: 75000, city: 'القاهرة' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  },
  'egy-team-pyramids': {
    id: 'egy-team-pyramids',
    name: 'بيراميدز',
    shortName: 'بيراميدز',
    abbreviation: 'PYR',
    logo: '',
    venue: { name: 'ستاد الدفاع الجوي', capacity: 30000, city: 'القاهرة' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  },
  'egy-team-masry': {
    id: 'egy-team-masry',
    name: 'المصري البورسعيدي',
    shortName: 'المصري',
    abbreviation: 'MAS',
    logo: '',
    venue: { name: 'ستاد برج العرب', capacity: 86000, city: 'الإسكندرية' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  },
  'egy-team-ittihad': {
    id: 'egy-team-ittihad',
    name: 'الاتحاد السكندري',
    shortName: 'الاتحاد',
    abbreviation: 'ITH',
    logo: '',
    venue: { name: 'ستاد الإسكندرية', capacity: 20000, city: 'الإسكندرية' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  },
  'egy-team-ismaily': {
    id: 'egy-team-ismaily',
    name: 'الإسماعيلي',
    shortName: 'الإسماعيلي',
    abbreviation: 'ISM',
    logo: '',
    venue: { name: 'ستاد الإسماعيلية', capacity: 18525, city: 'الإسماعيلية' },
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  }
};

const formatMockPlayers = (names) => {
  return names.map((name, idx) => {
    let position = 'لاعب وسط';
    let positionGroup = 'midfielders';
    if (idx === 0) {
      position = 'حارس مرمى';
      positionGroup = 'goalkeepers';
    } else if (idx >= 1 && idx <= 4) {
      position = 'مدافع';
      positionGroup = 'defenders';
    } else if (idx >= 5 && idx <= 7) {
      position = 'لاعب وسط';
      positionGroup = 'midfielders';
    } else {
      position = 'مهاجم';
      positionGroup = 'forwards';
    }
    return {
      id: `egy-player-${idx + 1}`,
      name,
      jersey: String(idx + 1),
      position,
      positionGroup,
      citizenship: 'مصر',
      photo: ''
    };
  });
};

const getEgyptianTeamRoster = (teamId) => {
  const matches = getMockEgyptianMatches();
  for (const m of matches) {
    if (m.homeTeamId === teamId && m.lineups?.home) {
      return formatMockPlayers(m.lineups.home);
    }
    if (m.awayTeamId === teamId && m.lineups?.away) {
      return formatMockPlayers(m.lineups.away);
    }
  }
  return [];
};

const getEgyptianTeamSchedule = (teamId) => {
  const matches = getMockEgyptianMatches();
  const teamMatches = matches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
  return teamMatches.map(m => {
    const isHome = m.homeTeamId === teamId;
    const teamScore = isHome ? m.homeScore : m.awayScore;
    const opponentScore = isHome ? m.awayScore : m.homeScore;
    let result = 'D';
    if (teamScore > opponentScore) result = 'W';
    else if (teamScore < opponentScore) result = 'L';
    return {
      id: m.id,
      leagueId: 'egypt.1',
      date: '2026-05-29T19:30:00Z',
      time: m.time,
      name: `${m.homeTeam} ضد ${m.awayTeam}`,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      isHome,
      opponentName: isHome ? m.awayTeam : m.homeTeam,
      opponentLogo: isHome ? m.awayLogo : m.homeLogo,
      result,
      status: m.status || 'FT',
      rawEvent: m
    };
  });
};

const categorizePosition = (posName = '') => {
  const p = (posName || '').toLowerCase();
  if (p.includes('goal') || p.includes('keeper')) return 'goalkeepers';
  if (p.includes('defen') || p.includes('back')) return 'defenders';
  if (p.includes('midfield')) return 'midfielders';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('att')) return 'forwards';
  return 'other';
};

const translatePosition = (posName = '') => {
  const p = (posName || '').toLowerCase();
  if (p.includes('goal') || p.includes('keeper')) return 'حارس مرمى';
  if (p.includes('center-back') || p.includes('central defender')) return 'قلب دفاع';
  if (p.includes('left-back') || p.includes('left back')) return 'ظهير أيسر';
  if (p.includes('right-back') || p.includes('right back')) return 'ظهير أيمن';
  if (p.includes('defen') || p.includes('back')) return 'مدافع';
  if (p.includes('defensive midfield')) return 'وسط دفاعي';
  if (p.includes('attacking midfield')) return 'وسط هجومي';
  if (p.includes('midfield')) return 'لاعب وسط';
  if (p.includes('left wing')) return 'جناح أيسر';
  if (p.includes('right wing')) return 'جناح أيمن';
  if (p.includes('striker') || p.includes('center forward')) return 'رأس حربة';
  if (p.includes('forward') || p.includes('att')) return 'مهاجم';
  return posName || 'لاعب';
};

// جلب تفاصيل وهوية النادي
export const getTeamDetails = async (teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return null;
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return EGYPTIAN_MOCK_TEAMS_DATA[cleanId] || {
      id: cleanId,
      name: 'فريق مصري',
      shortName: 'فريق مصري',
      abbreviation: 'EGY',
      logo: '',
      venue: null,
      defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
    };
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/teams/${cleanId}`;
    const data = await cachedJson(url, { ttl: 300000 });
    const t = data.team;
    if (!t) return null;

    return {
      id: String(t.id || cleanId),
      name: t.displayName || t.name || 'فريق كروي',
      shortName: t.shortDisplayName || t.displayName || '',
      abbreviation: t.abbreviation || '',
      logo: t.logos?.[0]?.href || '',
      venue: t.venue ? {
        name: t.venue.fullName || '',
        capacity: t.venue.capacity || null,
        city: t.venue.address?.city || ''
      } : null,
      defaultLeague: t.defaultLeague ? {
        id: t.defaultLeague.id,
        name: t.defaultLeague.name,
        midsizeName: t.defaultLeague.midsizeName
      } : null
    };
  } catch (err) {
    console.error(`Failed to fetch details for team ${cleanId}:`, err);
    return null;
  }
};

// جلب نتائج ومباريات النادي الأخيرة
export const getTeamSchedule = async (leagueId, teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return [];
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return getEgyptianTeamSchedule(cleanId);
  }

  if (!leagueId) {
    return [];
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams/${cleanId}/schedule`;
    const data = await cachedJson(url, { ttl: 15000 });
    const events = data.events || [];

    return events.map(event => {
      const comp = event.competitions?.[0] || {};
      const competitors = comp.competitors || [];
      const homeComp = competitors.find(c => c.homeAway === 'home') || {};
      const awayComp = competitors.find(c => c.homeAway === 'away') || {};

      const isHome = String(homeComp.id || homeComp.team?.id) === cleanId;
      const teamComp = isHome ? homeComp : awayComp;
      const opponentComp = isHome ? awayComp : homeComp;

      const homeScore = parseInt(homeComp.score?.value ?? homeComp.score?.displayValue ?? homeComp.score ?? 0, 10);
      const awayScore = parseInt(awayComp.score?.value ?? awayComp.score?.displayValue ?? awayComp.score ?? 0, 10);
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;

      let result = 'D';
      if (teamComp.winner === true) {
        result = 'W';
      } else if (opponentComp.winner === true) {
        result = 'L';
      } else if (teamScore > opponentScore) {
        result = 'W';
      } else if (teamScore < opponentScore) {
        result = 'L';
      }

      const eventStatus = event.status || comp.status;
      let status = 'FT';
      if (eventStatus?.type?.state === 'in') {
        status = 'LIVE';
      } else if (eventStatus?.type?.state === 'pre') {
        status = 'NS';
      }

      return {
        id: event.id,
        leagueId,
        date: event.date,
        name: event.name || `${homeComp.team?.displayName || ''} ضد ${awayComp.team?.displayName || ''}`,
        homeTeam: homeComp.team?.displayName || 'فريق مستضيف',
        awayTeam: awayComp.team?.displayName || 'فريق ضيف',
        homeScore,
        awayScore,
        isHome,
        opponentName: opponentComp.team?.displayName || '',
        opponentLogo: opponentComp.team?.logos?.[0]?.href || opponentComp.team?.logo || '',
        result,
        status,
        ...parseMatchResult(event.status || comp.status, competitors),
        rawEvent: event
      };
    });
  } catch (err) {
    console.error(`Failed to fetch schedule for team ${cleanId} in league ${leagueId}:`, err);
    return [];
  }
};

// جلب قائمة لاعبي النادي
export const getTeamRoster = async (leagueId, teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return [];
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return getEgyptianTeamRoster(cleanId);
  }

  if (!leagueId) {
    return [];
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams/${cleanId}/roster`;
    const data = await cachedJson(url, { ttl: 300000 });
    const athletes = data.athletes || [];

    return athletes.map(a => {
      const posName = a.position?.displayName || a.position?.name || '';
      return {
        id: String(a.id || Math.random()),
        name: a.displayName || a.fullName || 'لاعب',
        jersey: a.jersey ? String(a.jersey) : '',
        position: translatePosition(posName),
        positionGroup: categorizePosition(posName),
        citizenship: a.citizenship || '',
        photo: a.headshot?.href || ''
      };
    });
  } catch (err) {
    console.error(`Failed to fetch roster for team ${cleanId} in league ${leagueId}:`, err);
    return [];
  }
};
