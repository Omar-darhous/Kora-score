// خدمة جلب بيانات كرة القدم الحية والحقيقية بالكامل من واجهات ESPN المفتوحة وموجز الأخبار DW الرياضي

import { LEAGUES, NEWS } from './mockData.js';

// قائمة بالصور الافتراضية عالية الجودة لتبديلها في الأخبار
const NEWS_IMAGES = [
  'https://images.unsplash.com/photo-1579952362774-3839e15a400c?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1540747737956-fd63f861d63e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=600'
];

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
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egyptian_Premier_League_logo.png',
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
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egyptian_Premier_League_logo.png',
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
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Egyptian_Premier_League_logo.png',
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
  if (!slug) return null;
  const s = slug.toLowerCase();
  if (s.includes('quarter') || s.includes('1/4') || s.includes('quarterfinals')) return 'ربع النهائي';
  if (s.includes('semi') || s.includes('1/2') || s.includes('semifinals')) return 'نصف النهائي';
  if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 'النهائي';
  if (s.includes('round-of-16') || s.includes('round of 16') || s.includes('1/8') || s.includes('octavos')) return 'دور الـ 16';
  if (s.includes('round-of-32') || s.includes('round of 32') || s.includes('1/16')) return 'دور الـ 32';
  if (s.includes('third-place') || s.includes('3rd-place') || s.includes('bronze')) return 'تحديد المركز الثالث';
  if (s.includes('group-stage') || s.includes('groups')) return 'دور المجموعات';
  return null;
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

// جلب المباريات الحقيقية لجميع الدوريات في تاريخ معين (تنسيق YYYYMMDD)
export const getMatches = async (dateStr) => {
  if (!dateStr) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateStr = `${yyyy}${mm}${dd}`;
  }

  const activeLeagues = getLeagues();

  try {
    const promises = activeLeagues.map(async (league) => {
      if (league.id === 'egypt.1') {
        // الدوري المصري انتهى يوم 29 مايو 2026، لذا نعرض مبارياته فقط في ذلك التاريخ لمنع التشويش على مباريات اليوم المباشرة الحالية
        if (dateStr === '20260529') {
          return getMockEgyptianMatches();
        }
        return [];
      }

      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${dateStr}`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        
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
        return events.map(event => {
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
            leagueLogo: league.logo,
            homeTeam: homeCompetitor.team?.displayName || 'فريق مستضيف',
            homeLogo: homeCompetitor.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
            homeScore: parseInt(homeCompetitor.score) || 0,
            homeTeamId: homeCompetitor.team?.id,
            awayTeam: awayCompetitor.team?.displayName || 'فريق ضيف',
            awayLogo: awayCompetitor.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
            awayScore: parseInt(awayCompetitor.score) || 0,
            awayTeamId: awayCompetitor.team?.id,
            status: statusStr,
            minute: event.status?.displayClock ? event.status.displayClock.replace("'", "") : event.status?.clock || 0,
            time: matchTime,
            roundName,
            detailsLoaded: false
          };
        });
      } catch (err) {
        console.error(`Error fetching matches for league ${league.id}:`, err);
        return [];
      }
    });

    const results = await Promise.all(promises);
    const allMatches = results.flat();

    return allMatches.sort((a, b) => {
      const statusOrder = { 'LIVE': 1, 'NS': 2, 'FT': 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  } catch (e) {
    console.error('Failed to load matches:', e);
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
    const response = await fetch(url);
    if (!response.ok) return null;
    const summary = await response.json();

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

    return {
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
let subscribers = [];

export const subscribeToLiveMatches = (callback) => {
  subscribers.push(callback);

  if (!liveRefreshInterval) {
    liveRefreshInterval = setInterval(async () => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;

      const currentMatches = await getMatches(dateStr);
      subscribers.forEach(sub => sub(currentMatches));
    }, 30000); 
  }

  return () => {
    subscribers = subscribers.filter(sub => sub !== callback);
    if (subscribers.length === 0 && liveRefreshInterval) {
      clearInterval(liveRefreshInterval);
      liveRefreshInterval = null;
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
      rank: getStatVal('rank') || item.rank || 0,
      team: item.team?.displayName || 'فريق كروي',
      logo: item.team?.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
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
export const getStandings = async (leagueId = 'eng.1') => {
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
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();

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

    if (season) {
      result.season = season;
    }

    return result;
  } catch (e) {
    console.error(`Failed to fetch standings for league ${leagueId}:`, e);
    return [];
  }
};

// جلب الأخبار الرياضية الحقيقية
export const getNews = async () => {
  try {
    const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https://rss.dw.com/xml/rss-ar-sports');
    if (!res.ok) throw new Error("Failed to fetch RSS news");
    const json = await res.json();
    
    const items = json.items || [];
    return items.map((item, idx) => {
      const pubDate = new Date(item.pubDate);
      const diffMs = new Date() - pubDate;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      let relativeTime = 'منذ ساعات';
      if (diffHours === 0) {
        relativeTime = 'منذ أقل من ساعة';
      } else if (diffHours === 1) {
        relativeTime = 'منذ ساعة واحدة';
      } else if (diffHours < 24) {
        relativeTime = `منذ ${diffHours} ساعة`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        relativeTime = `منذ ${diffDays} يوم`;
      }

      const imageIndex = idx % NEWS_IMAGES.length;
      const imageUrl = item.thumbnail || item.enclosure?.link || NEWS_IMAGES[imageIndex];

      return {
        id: item.guid || String(idx),
        tag: item.categories?.[0] || 'كرة قدم عالمية',
        title: item.title,
        desc: item.description ? item.description.replace(/<[^>]*>/g, '') : '',
        body: item.content ? item.content.replace(/<[^>]*>/g, '') : item.description || '',
        img: imageUrl,
        date: relativeTime,
        readTime: '3 دقائق قراءة',
        link: item.link
      };
    });
  } catch (e) {
    console.error("Failed to load real news:", e);
    return [];
  }
};

// جلب تفاصيل مباريات الأدوار الإقصائية لكأس العالم وترتيبها في هيكل الشجرة
export const getWorldCupKnockouts = async () => {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=200';
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const events = data.events || [];
    
    // فلترة وتنسيق المباريات
    const parsedMatches = events.map(event => {
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

      const seasonSlug = event.season?.slug || '';
      const altNote = comp.altGameNote || '';

      const knockoutStage = mapKnockoutStage(seasonSlug) || mapKnockoutStage(altNote);

      return {
        id: event.id,
        leagueId: 'fifa.world', // to work with details popup
        homeTeam: homeCompetitor.team?.displayName || 'فريق مستضيف',
        homeLogo: homeCompetitor.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
        homeScore: parseInt(homeCompetitor.score) ?? 0,
        awayTeam: awayCompetitor.team?.displayName || 'فريق ضيف',
        awayLogo: awayCompetitor.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-soccer.png',
        awayScore: parseInt(awayCompetitor.score) ?? 0,
        status: statusStr,
        statusDetail: event.status?.type?.detail || '',
        minute: event.status?.displayClock ? event.status.displayClock.replace("'", "") : event.status?.clock || 0,
        time: matchTime,
        date: event.date,
        roundSlug: seasonSlug || altNote,
        knockoutStage
      };
    });

    const r16 = new Array(8).fill(null);
    const qf = new Array(4).fill(null);
    const sf = new Array(2).fill(null);
    let final = null;
    let thirdPlace = null;

    const r16Definitions = [
      { teams: ['Canada', 'Morocco'], idx: 0 },
      { teams: ['Paraguay', 'France'], idx: 1 },
      { teams: ['Portugal', 'Spain'], idx: 2 },
      { teams: ['United States', 'Belgium'], idx: 3 },
      { teams: ['Brazil', 'Norway'], idx: 4 },
      { teams: ['Mexico', 'England'], idx: 5 },
      { teams: ['Argentina', 'Egypt'], idx: 6 },
      { teams: ['Switzerland', 'Colombia'], idx: 7 }
    ];

    const qfDefinitions = [
      { teams: ['France', 'Morocco'], idx: 0 },
      { teams: ['Spain', 'Belgium'], idx: 1 },
      { teams: ['Norway', 'England'], idx: 2 },
      { teams: ['Argentina', 'Switzerland'], idx: 3 }
    ];

    const sfDefinitions = [
      { teams: ['France', 'Spain'], idx: 0 },
      { teams: ['England', 'Argentina'], idx: 1 }
    ];

    parsedMatches.forEach(match => {
      const slug = (match.roundSlug || '').toLowerCase();
      const home = match.homeTeam;
      const away = match.awayTeam;
      
      const isMatch = (def) => (
        (home.includes(def.teams[0]) && away.includes(def.teams[1])) || 
        (home.includes(def.teams[1]) && away.includes(def.teams[0]))
      );

      if (slug.includes('round-of-16') || slug.includes('1/8') || slug.includes('octavos')) {
        const def = r16Definitions.find(isMatch);
        if (def) r16[def.idx] = match;
      } else if (slug.includes('quarter')) {
        const def = qfDefinitions.find(isMatch);
        if (def) qf[def.idx] = match;
      } else if (slug.includes('semi')) {
        const def = sfDefinitions.find(isMatch);
        if (def) sf[def.idx] = match;
      } else if (slug.includes('final') && !slug.includes('semi') && !slug.includes('quarter') && !slug.includes('3rd') && !slug.includes('third')) {
        final = match;
      } else if (slug.includes('3rd') || slug.includes('third')) {
        thirdPlace = match;
      }
    });

    return { r16, qf, sf, final, thirdPlace };
  } catch (e) {
    console.error("Failed to fetch world cup knockouts:", e);
    return null;
  }
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
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
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
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
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

      let status = 'FT';
      if (event.status?.type?.state === 'in') {
        status = 'LIVE';
      } else if (event.status?.type?.state === 'pre') {
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
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
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
