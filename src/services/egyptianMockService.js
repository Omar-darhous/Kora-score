// بيانات تجريبية محفوظة للدوري المصري الممتاز (تُعرض مع إشعارات EgyptianDisclaimer و EgyptianBadge)

export const getMockEgyptianMatches = () => {
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

export const getMockEgyptianMatchDetails = (eventId) => {
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
};

export const getMockEgyptianStandings = () => {
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
};

export const EGYPTIAN_MOCK_TEAMS_DATA = {
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

export const getEgyptianTeamDetails = (teamId) => {
  const cleanId = String(teamId || '').trim();
  return EGYPTIAN_MOCK_TEAMS_DATA[cleanId] || {
    id: cleanId,
    name: 'فريق مصري',
    shortName: 'فريق مصري',
    abbreviation: 'EGY',
    logo: '',
    venue: null,
    defaultLeague: { id: 'egypt.1', name: 'الدوري المصري الممتاز', midsizeName: 'egypt.1' }
  };
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

export const getEgyptianTeamRoster = (teamId) => {
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

export const getEgyptianTeamSchedule = (teamId) => {
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
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
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
