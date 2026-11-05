// خدمة البحث الذكي في منصة كورة سكور (Search Service)
// تدعم البحث باللغة العربية والإنجليزية، وتطبيع الحروف، والأسماء الشائعة، مع عزل البيانات التجريبية للمصري

/**
 * دالة لتطبيع النصوص العربية والإنجليزية لإزالة التشكيل وتوحيد أشكال الحروف
 */
export const normalizeSearchText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة الحركات والتنوين
    .replace(/ـ/g, '') // إزالة التطويل والكشيدة
    .replace(/[أإآٱ]/g, 'ا') // توحيد الهمزات إلى ألف
    .replace(/ة/g, 'ه') // توحيد التاء المربوطة
    .replace(/ى/g, 'ي') // توحيد الألف المقصورة إلى ياء
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ') // إزالة الرموز الخاصة
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * قاعدة بيانات الأندية المعتمدة ذات المسارات الصالحة المدعومة في التطبيق
 */
export const POPULAR_TEAMS = [
  // أندية الدوري الإنجليزي الممتاز (eng.1)
  {
    id: '359',
    name: 'Arsenal',
    arabicName: 'آرسنال',
    aliases: ['ارسنال', 'المدفعجية', 'arsenal', 'gunners', 'ars'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
    isMock: false
  },
  {
    id: '382',
    name: 'Manchester City',
    arabicName: 'مانشستر سيتي',
    aliases: ['مان سيتي', 'السيتي', 'man city', 'manchester city', 'mci'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
    isMock: false
  },
  {
    id: '364',
    name: 'Liverpool',
    arabicName: 'ليفربول',
    aliases: ['الريدز', 'liverpool', 'reds', 'liv'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    isMock: false
  },
  {
    id: '363',
    name: 'Chelsea',
    arabicName: 'تشيلسي',
    aliases: ['تشلسي', 'البلوز', 'chelsea', 'blues', 'che'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png',
    isMock: false
  },
  {
    id: '360',
    name: 'Manchester United',
    arabicName: 'مانشستر يونايتد',
    aliases: ['مان يونايتد', 'اليونايتد', 'الشياطين الحمر', 'man utd', 'manchester united', 'mun'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png',
    isMock: false
  },
  {
    id: '367',
    name: 'Tottenham Hotspur',
    arabicName: 'توتنهام هوتسبير',
    aliases: ['توتنهام', 'السبيرز', 'tottenham', 'spurs', 'tot'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/367.png',
    isMock: false
  },
  {
    id: '362',
    name: 'Aston Villa',
    arabicName: 'أستون فيلا',
    aliases: ['استون فيلا', 'aston villa', 'villa', 'avl'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/362.png',
    isMock: false
  },
  {
    id: '361',
    name: 'Newcastle United',
    arabicName: 'نيوكاسل يونايتد',
    aliases: ['نيوكاسل', 'newcastle', 'new'],
    leagueId: 'eng.1',
    leagueName: 'الدوري الإنجليزي الممتاز',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/361.png',
    isMock: false
  },

  // أندية الدوري الإسباني (esp.1)
  {
    id: '86',
    name: 'Real Madrid',
    arabicName: 'ريال مدريد',
    aliases: ['الريال', 'الملكي', 'مدريد', 'real madrid', 'madrid', 'rma'],
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    isMock: false
  },
  {
    id: '83',
    name: 'Barcelona',
    arabicName: 'برشلونة',
    aliases: ['برشلونه', 'البارسا', 'البرسا', 'barcelona', 'barca', 'bar'],
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    isMock: false
  },
  {
    id: '1068',
    name: 'Atlético Madrid',
    arabicName: 'أتلتيكو مدريد',
    aliases: ['اتلتيكو مدريد', 'اتلتيكو', 'الروخيبلانكوس', 'atletico madrid', 'atletico', 'atm'],
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
    isMock: false
  },
  {
    id: '243',
    name: 'Sevilla',
    arabicName: 'إشبيلية',
    aliases: ['اشبيلية', 'اشبيليه', 'sevilla', 'sev'],
    leagueId: 'esp.1',
    leagueName: 'الدوري الإسباني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/243.png',
    isMock: false
  },

  // أندية الدوري الإيطالي (ita.1)
  {
    id: '110',
    name: 'Internazionale',
    arabicName: 'إنتر ميلان',
    aliases: ['انتر ميلان', 'الانتر', 'النيراتزوري', 'inter milan', 'inter', 'int'],
    leagueId: 'ita.1',
    leagueName: 'الدوري الإيطالي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png',
    isMock: false
  },
  {
    id: '103',
    name: 'AC Milan',
    arabicName: 'إي سي ميلان',
    aliases: ['اي سي ميلان', 'ميلان', 'الروسونيري', 'milan', 'ac milan', 'mil'],
    leagueId: 'ita.1',
    leagueName: 'الدوري الإيطالي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/103.png',
    isMock: false
  },
  {
    id: '111',
    name: 'Juventus',
    arabicName: 'يوفنتوس',
    aliases: ['اليوفي', 'السيدة العجوز', 'juventus', 'juve', 'juv'],
    leagueId: 'ita.1',
    leagueName: 'الدوري الإيطالي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/111.png',
    isMock: false
  },
  {
    id: '114',
    name: 'Napoli',
    arabicName: 'نابولي',
    aliases: ['napoli', 'nap'],
    leagueId: 'ita.1',
    leagueName: 'الدوري الإيطالي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/114.png',
    isMock: false
  },
  {
    id: '104',
    name: 'AS Roma',
    arabicName: 'روما',
    aliases: ['نادي روما', 'الذئاب', 'roma', 'rom'],
    leagueId: 'ita.1',
    leagueName: 'الدوري الإيطالي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/104.png',
    isMock: false
  },

  // أندية الدوري الألماني (ger.1)
  {
    id: '132',
    name: 'Bayern Munich',
    arabicName: 'بايرن ميونخ',
    aliases: ['البايرن', 'ميونخ', 'bayern munich', 'bayern', 'bay'],
    leagueId: 'ger.1',
    leagueName: 'الدوري الألماني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png',
    isMock: false
  },
  {
    id: '124',
    name: 'Borussia Dortmund',
    arabicName: 'بوروسيا دورتموند',
    aliases: ['دورتموند', 'borussia dortmund', 'dortmund', 'bvb'],
    leagueId: 'ger.1',
    leagueName: 'الدوري الألماني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/124.png',
    isMock: false
  },
  {
    id: '131',
    name: 'Bayer Leverkusen',
    arabicName: 'باير ليفركوزن',
    aliases: ['ليفركوزن', 'bayer leverkusen', 'leverkusen', 'lev'],
    leagueId: 'ger.1',
    leagueName: 'الدوري الألماني',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/131.png',
    isMock: false
  },

  // أندية الدوري الفرنسي (fra.1)
  {
    id: '160',
    name: 'Paris Saint-Germain',
    arabicName: 'باريس سان جيرمان',
    aliases: ['باريس', 'بي اس جي', 'paris saint germain', 'psg', 'paris'],
    leagueId: 'fra.1',
    leagueName: 'الدوري الفرنسي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png',
    isMock: false
  },
  {
    id: '166',
    name: 'Marseille',
    arabicName: 'مارسيليا',
    aliases: ['مرسيليا', 'marseille', 'om'],
    leagueId: 'fra.1',
    leagueName: 'الدوري الفرنسي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/166.png',
    isMock: false
  },

  // أندية دوري روشن السعودي (ksa.1)
  {
    id: '929',
    name: 'Al Hilal',
    arabicName: 'الهلال',
    aliases: ['نادي الهلال', 'الزعيم', 'الموج الأزرق', 'al hilal', 'hilal', 'hil'],
    leagueId: 'ksa.1',
    leagueName: 'دوري روشن السعودي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/929.png',
    isMock: false
  },
  {
    id: '817',
    name: 'Al Nassr',
    arabicName: 'النصر',
    aliases: ['نادي النصر', 'العالمي', 'فارس نجد', 'al nassr', 'nassr', 'nsr'],
    leagueId: 'ksa.1',
    leagueName: 'دوري روشن السعودي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/817.png',
    isMock: false
  },
  {
    id: '2276',
    name: 'Al Ittihad',
    arabicName: 'الاتحاد السعودي',
    aliases: ['الاتحاد', 'العميد', 'اتي جدة', 'al ittihad', 'ittihad', 'itt'],
    leagueId: 'ksa.1',
    leagueName: 'دوري روشن السعودي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/2276.png',
    isMock: false
  },
  {
    id: '8346',
    name: 'Al Ahli',
    arabicName: 'الأهلي السعودي',
    aliases: ['الاهلي السعودي', 'قلعة الكؤوس', 'al ahli', 'ahli', 'ahl'],
    leagueId: 'ksa.1',
    leagueName: 'دوري روشن السعودي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/8346.png',
    isMock: false
  },
  {
    id: '793',
    name: 'Al Shabab',
    arabicName: 'الشباب السعودي',
    aliases: ['الشباب', 'الليث الأبيض', 'al shabab', 'shabab', 'sha'],
    leagueId: 'ksa.1',
    leagueName: 'دوري روشن السعودي',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/793.png',
    isMock: false
  },

  // أندية الدوري الأمريكي (usa.1)
  {
    id: '20232',
    name: 'Inter Miami CF',
    arabicName: 'إنتر ميامي',
    aliases: ['انتر ميامي', 'ميامي', 'inter miami', 'miami', 'mia'],
    leagueId: 'usa.1',
    leagueName: 'الدوري الأمريكي (MLS)',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png',
    isMock: false
  },

  // أندية الدوري المصري الستة المعتمدة (بيانات تجريبية ومحاكاة)
  {
    id: 'egy-team-ahly',
    name: 'Al Ahly SC',
    arabicName: 'الأهلي',
    aliases: ['الاهلي', 'القلعة الحمراء', 'نادي القرن', 'المارد الأحمر', 'al ahly', 'ahly'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  },
  {
    id: 'egy-team-zamalek',
    name: 'Zamalek SC',
    arabicName: 'الزمالك',
    aliases: ['القلعة البيضاء', 'الفارس الأبيض', 'ميت عقبة', 'zamalek'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  },
  {
    id: 'egy-team-pyramids',
    name: 'Pyramids FC',
    arabicName: 'بيراميدز',
    aliases: ['الأسيوطي سابقا', 'pyramids'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  },
  {
    id: 'egy-team-masry',
    name: 'Al Masry SC',
    arabicName: 'المصري البورسعيدي',
    aliases: ['المصري', 'النسور الخضر', 'بورسعيد', 'al masry', 'masry'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  },
  {
    id: 'egy-team-ittihad',
    name: 'Al Ittihad Alexandria',
    arabicName: 'الاتحاد السكندري',
    aliases: ['الاتحاد', 'سيد البلد', 'زعيم الثغر', 'al ittihad', 'ittihad alexandria'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  },
  {
    id: 'egy-team-ismaily',
    name: 'Ismaily SC',
    arabicName: 'الإسماعيلي',
    aliases: ['الاسماعيلي', 'الدراويش', 'برازيل مصر', 'ismaily'],
    leagueId: 'egypt.1',
    leagueName: 'الدوري المصري الممتاز',
    logo: '',
    isMock: true
  }
];

/**
 * أسماء مستعارة وكلمات مفتاحية للبطولات
 */
const LEAGUE_ALIASES = {
  'eng.1': ['الدوري الانجليزي', 'البريميرليج', 'بريميرليج', 'premier league', 'epl', 'انجلترا', 'انجلترا'],
  'esp.1': ['الدوري الاسباني', 'لاليجا', 'لا ليجا', 'la liga', 'اسبانيا', 'الليجا'],
  'ita.1': ['الدوري الايطالي', 'الكالتشيو', 'سيريا اي', 'serie a', 'ايطاليا'],
  'ger.1': ['الدوري الالماني', 'البوندسليجا', 'bundesliga', 'المانيا'],
  'fra.1': ['الدوري الفرنسي', 'ليج 1', 'ligue 1', 'فرنسا'],
  'ksa.1': ['دوري روشن', 'الدوري السعودي', 'روشن', 'saudi pro league', 'spl', 'السعودية', 'دوري المحترفين السعودي'],
  'egypt.1': ['الدوري المصري', 'الدوري المصري الممتاز', 'مصر', 'egyptian premier league', 'دوري نايل'],
  'uefa.champions': ['دوري ابطال اوروبا', 'تشامبيونز ليج', 'الشامبيونز ليج', 'ابطال اوروبا', 'champions league', 'ucl'],
  'uefa.europa': ['الدوري الاوروبي', 'اليوروباليج', 'europa league', 'uel'],
  'fifa.world': ['كاس العالم', 'المونديال', 'world cup', 'فيفا', 'كأس العالم'],
  'usa.1': ['الدوري الامريكي', 'ام ال اس', 'mls', 'امريكا']
};

/**
 * البحث الشامل عبر البطولات والأندية والمباريات المحملة
 * @param {Object} options
 * @param {string} options.query - نص البحث
 * @param {Array} options.matches - مصفوفة المباريات المحملة حالياً في الذاكرة
 * @param {Array} options.leagues - مصفوفة البطولات المعتمدة
 * @returns {Object} { leagues: [], teams: [], matches: [] }
 */
export const searchAll = ({ query = '', matches = [], leagues = [] }) => {
  const clean = query.trim();
  if (!clean) {
    return {
      leagues: [],
      teams: [],
      matches: []
    };
  }

  const normalizedQuery = normalizeSearchText(clean);
  const terms = normalizedQuery.split(' ').filter(Boolean);

  // 1. البحث في البطولات
  const matchedLeagues = leagues.filter((league) => {
    const normName = normalizeSearchText(league.name);
    const normCountry = normalizeSearchText(league.country);
    const normId = normalizeSearchText(league.id);
    const aliases = (LEAGUE_ALIASES[league.id] || []).map(normalizeSearchText);

    return terms.every((t) => (
      normName.includes(t) ||
      normCountry.includes(t) ||
      normId.includes(t) ||
      aliases.some(a => a.includes(t))
    ));
  }).map(l => ({
    ...l,
    isMock: l.id === 'egypt.1'
  }));

  // 2. تجميع وفهرسة الأندية
  // نجمع أندية القائمة المعتمدة بالإضافة لأي أندية تظهر في مباريات اليوم تملك ID صالحاً
  const teamMap = new Map();
  POPULAR_TEAMS.forEach(team => {
    teamMap.set(String(team.id), team);
  });

  // إضافة الأندية من المباريات المحملة إذا لم تكن موجودة وتملك معرفاً صالحاً
  matches.forEach(m => {
    if (m.homeTeamId && !teamMap.has(String(m.homeTeamId))) {
      teamMap.set(String(m.homeTeamId), {
        id: String(m.homeTeamId),
        name: m.homeTeam,
        arabicName: m.homeTeam,
        aliases: [m.homeTeam],
        leagueId: m.leagueId,
        leagueName: m.leagueName,
        logo: m.homeLogo || '',
        isMock: m.leagueId === 'egypt.1' || String(m.homeTeamId).startsWith('egy-team-')
      });
    }
    if (m.awayTeamId && !teamMap.has(String(m.awayTeamId))) {
      teamMap.set(String(m.awayTeamId), {
        id: String(m.awayTeamId),
        name: m.awayTeam,
        arabicName: m.awayTeam,
        aliases: [m.awayTeam],
        leagueId: m.leagueId,
        leagueName: m.leagueName,
        logo: m.awayLogo || '',
        isMock: m.leagueId === 'egypt.1' || String(m.awayTeamId).startsWith('egy-team-')
      });
    }
  });

  const allTeams = Array.from(teamMap.values());
  const matchedTeams = allTeams.filter((team) => {
    const normName = normalizeSearchText(team.name);
    const normArabic = normalizeSearchText(team.arabicName);
    const normLeague = normalizeSearchText(team.leagueName);
    const aliases = (team.aliases || []).map(normalizeSearchText);

    return terms.every((t) => (
      normName.includes(t) ||
      normArabic.includes(t) ||
      normLeague.includes(t) ||
      aliases.some(a => a.includes(t))
    ));
  });

  // 3. البحث في المباريات المحملة في الذاكرة لليوم الحالي
  const matchedMatches = matches.filter((match) => {
    const normHome = normalizeSearchText(match.homeTeam);
    const normAway = normalizeSearchText(match.awayTeam);
    const normLeague = normalizeSearchText(match.leagueName);

    return terms.every((t) => (
      normHome.includes(t) ||
      normAway.includes(t) ||
      normLeague.includes(t)
    ));
  }).map(m => ({
    ...m,
    isMock: m.leagueId === 'egypt.1' || String(m.id).startsWith('egy-')
  }));

  return {
    leagues: matchedLeagues.slice(0, 5),
    teams: matchedTeams.slice(0, 8),
    matches: matchedMatches.slice(0, 6)
  };
};

/**
 * اقتراحات سريعة عند فتح شريط البحث قبل كتابة أي نص
 */
export const getQuickSuggestions = () => {
  return {
    popularLeagues: [
      { id: 'eng.1', name: 'الدوري الإنجليزي الممتاز', logo: 'https://a.espncdn.com/i/league-logos/soccer/500/23.png' },
      { id: 'esp.1', name: 'الدوري الإسباني', logo: 'https://a.espncdn.com/i/league-logos/soccer/500/15.png' },
      { id: 'uefa.champions', name: 'دوري أبطال أوروبا', logo: 'https://a.espncdn.com/i/league-logos/soccer/500/2.png' },
      { id: 'ksa.1', name: 'دوري روشن السعودي', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/350.png' }
    ],
    popularTeams: [
      { id: '86', name: 'ريال مدريد', leagueName: 'الدوري الإسباني', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', isMock: false },
      { id: '83', name: 'برشلونة', leagueName: 'الدوري الإسباني', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', isMock: false },
      { id: '359', name: 'آرسنال', leagueName: 'الدوري الإنجليزي الممتاز', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', isMock: false },
      { id: '364', name: 'ليفربول', leagueName: 'الدوري الإنجليزي الممتاز', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', isMock: false },
      { id: '929', name: 'الهلال', leagueName: 'دوري روشن السعودي', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/929.png', isMock: false },
      { id: 'egy-team-ahly', name: 'الأهلي', leagueName: 'الدوري المصري الممتاز', logo: '', isMock: true }
    ]
  };
};

