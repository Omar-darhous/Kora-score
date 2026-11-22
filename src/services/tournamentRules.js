// UEFA clubs 2024/25 onward: top 8 -> R16, 9-24 -> play-offs (UCL/UEL: 8 games, UECL: 6 games).
// FIFA 2026: top 2 in 12 groups plus 8 third-place teams -> R32.
// AFCON (2019+) & EURO (2016+): top 2 in 6 groups plus 4 best third-place teams -> R16.
export const isUefaClubTournament = id => ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'].includes(id);
export const isNationalTournament = id => ['fifa.world', 'caf.nations', 'uefa.euro', 'uefa.nations', 'conmebol.america', 'afc.asian.cup'].includes(id);
export const isTournament = id => isNationalTournament(id) || isUefaClubTournament(id);

export const COMPETITION_CATEGORIES = {
  CLUB: 'club',
  NATIONAL: 'national'
};

export const DEFAULT_CATEGORY_LEAGUES = {
  [COMPETITION_CATEGORIES.CLUB]: 'eng.1',
  [COMPETITION_CATEGORIES.NATIONAL]: 'fifa.world'
};

export const NATIONAL_SECTIONS = {
  TOURNAMENTS: 'tournaments',
  QUALIFIERS: 'qualifiers'
};

const KNOWN_QUALIFIER_IDS = new Set([
  'fifa.worldq.caf',
  'fifa.worldq.uefa',
  'fifa.worldq.afc',
  'fifa.worldq.conmebol',
  'fifa.worldq.concacaf',
  'fifa.worldq.ofc',
  'caf.nations_qual',
  'uefa.euroq'
]);

export const isInternationalQualifier = (leagueOrId = '') => {
  const id = typeof leagueOrId === 'string' ? leagueOrId : (leagueOrId?.id || '');
  const clean = String(id).trim().toLowerCase();
  if (!clean) return false;
  if (KNOWN_QUALIFIER_IDS.has(clean)) return true;
  return /\.worldq\.|_qual$|\.euroq$|\.qual$/i.test(clean);
};

export const isNationalTeamCompetition = (leagueOrId = '') => {
  const id = typeof leagueOrId === 'string' ? leagueOrId : (leagueOrId?.id || '');
  return isNationalTournament(id) || isInternationalQualifier(id);
};

export const isClubCompetition = (leagueOrId = '') => {
  const id = typeof leagueOrId === 'string' ? leagueOrId : (leagueOrId?.id || '');
  return Boolean(String(id).trim()) && !isNationalTeamCompetition(id);
};

export const getCompetitionClassification = (leagueOrId = '') => {
  const id = typeof leagueOrId === 'string' ? leagueOrId : (leagueOrId?.id || '');
  if (isNationalTeamCompetition(id)) {
    if (isInternationalQualifier(id)) {
      return {
        category: COMPETITION_CATEGORIES.NATIONAL,
        categoryLabel: 'بطولات المنتخبات',
        nationalSection: NATIONAL_SECTIONS.QUALIFIERS,
        nationalSectionLabel: 'التصفيات',
        subCategory: 'qualifiers',
        subCategoryLabel: 'التصفيات الدولية والقارية',
        order: 4
      };
    }
    if (id === 'fifa.world') {
      return {
        category: COMPETITION_CATEGORIES.NATIONAL,
        categoryLabel: 'بطولات المنتخبات',
        nationalSection: NATIONAL_SECTIONS.TOURNAMENTS,
        nationalSectionLabel: 'البطولات',
        subCategory: 'world_cup',
        subCategoryLabel: 'كأس العالم',
        order: 1
      };
    }
    if (id === 'uefa.nations') {
      return {
        category: COMPETITION_CATEGORIES.NATIONAL,
        categoryLabel: 'بطولات المنتخبات',
        nationalSection: NATIONAL_SECTIONS.TOURNAMENTS,
        nationalSectionLabel: 'البطولات',
        subCategory: 'nations_league',
        subCategoryLabel: 'دوري الأمم الأوروبية',
        order: 3
      };
    }
    return {
      category: COMPETITION_CATEGORIES.NATIONAL,
      categoryLabel: 'بطولات المنتخبات',
      nationalSection: NATIONAL_SECTIONS.TOURNAMENTS,
      nationalSectionLabel: 'البطولات',
      subCategory: 'continental_national',
      subCategoryLabel: 'البطولات القارية للمنتخبات',
      order: 2
    };
  }

  if (isUefaClubTournament(id)) {
    return {
      category: COMPETITION_CATEGORIES.CLUB,
      categoryLabel: 'بطولات الأندية',
      nationalSection: null,
      nationalSectionLabel: null,
      subCategory: 'continental_club',
      subCategoryLabel: 'البطولات القارية للأندية',
      order: 2
    };
  }

  return {
    category: COMPETITION_CATEGORIES.CLUB,
    categoryLabel: 'بطولات الأندية',
    nationalSection: null,
    nationalSectionLabel: null,
    subCategory: 'domestic',
    subCategoryLabel: 'الدوريات المحلية',
    order: 1
  };
};

export const organizeCompetitions = (leagues = []) => {
  const seenIds = new Set();
  const domestic = [];
  const continentalClub = [];
  const worldCup = [];
  const continentalNational = [];
  const nationsLeague = [];
  const qualifiers = [];

  for (const item of Array.isArray(leagues) ? leagues : []) {
    if (!item || !item.id || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    const meta = getCompetitionClassification(item);
    const enriched = { ...item, ...meta };

    if (meta.category === COMPETITION_CATEGORIES.CLUB) {
      if (meta.subCategory === 'continental_club') {
        continentalClub.push(enriched);
      } else {
        domestic.push(enriched);
      }
    } else if (meta.subCategory === 'world_cup') {
      worldCup.push(enriched);
    } else if (meta.subCategory === 'nations_league') {
      nationsLeague.push(enriched);
    } else if (meta.subCategory === 'qualifiers') {
      qualifiers.push(enriched);
    } else {
      continentalNational.push(enriched);
    }
  }

  const clubSubGroups = [
    { id: 'domestic', label: 'الدوريات المحلية', competitions: domestic },
    { id: 'continental_club', label: 'البطولات القارية للأندية', competitions: continentalClub }
  ].filter(g => g.competitions.length > 0);

  const tournamentsList = [...worldCup, ...continentalNational, ...nationsLeague];
  const nationalSections = [
    { id: NATIONAL_SECTIONS.TOURNAMENTS, label: 'البطولات', competitions: tournamentsList },
    { id: NATIONAL_SECTIONS.QUALIFIERS, label: 'التصفيات', competitions: qualifiers }
  ].filter(s => s.competitions.length > 0);

  const nationalSubGroups = [
    { id: 'world_cup', label: 'كأس العالم', sectionId: NATIONAL_SECTIONS.TOURNAMENTS, competitions: worldCup },
    { id: 'continental_national', label: 'البطولات القارية للمنتخبات', sectionId: NATIONAL_SECTIONS.TOURNAMENTS, competitions: continentalNational },
    { id: 'nations_league', label: 'دوري الأمم الأوروبية', sectionId: NATIONAL_SECTIONS.TOURNAMENTS, competitions: nationsLeague },
    { id: 'qualifiers', label: 'التصفيات الدولية والقارية', sectionId: NATIONAL_SECTIONS.QUALIFIERS, competitions: qualifiers }
  ].filter(g => g.competitions.length > 0);

  return {
    club: {
      id: COMPETITION_CATEGORIES.CLUB,
      label: 'بطولات الأندية',
      competitions: [...domestic, ...continentalClub],
      subGroups: clubSubGroups
    },
    national: {
      id: COMPETITION_CATEGORIES.NATIONAL,
      label: 'بطولات المنتخبات',
      competitions: [...tournamentsList, ...qualifiers],
      sections: nationalSections,
      sectionsByKey: {
        [NATIONAL_SECTIONS.TOURNAMENTS]: tournamentsList,
        [NATIONAL_SECTIONS.QUALIFIERS]: qualifiers
      },
      subGroups: nationalSubGroups
    }
  };
};

export const getDefaultCompetitionForCategory = (category, leagues = []) => {
  const targetCategory = category === COMPETITION_CATEGORIES.NATIONAL
    ? COMPETITION_CATEGORIES.NATIONAL
    : COMPETITION_CATEGORIES.CLUB;
  const preferredId = DEFAULT_CATEGORY_LEAGUES[targetCategory];

  if (Array.isArray(leagues) && leagues.length > 0) {
    const organized = organizeCompetitions(leagues);
    const pool = organized[targetCategory]?.competitions || [];
    if (pool.some(item => item.id === preferredId)) {
      return preferredId;
    }
    if (pool.length > 0) {
      return pool[0].id;
    }
  }

  return preferredId;
};

export const resolveCategorySwitchSelection = (targetCategory, currentLeagueId, leagues = []) => {
  const currentCategory = getCompetitionClassification(currentLeagueId).category;
  if (
    targetCategory !== COMPETITION_CATEGORIES.CLUB &&
    targetCategory !== COMPETITION_CATEGORIES.NATIONAL
  ) {
    return {
      category: currentCategory,
      leagueId: currentLeagueId,
      changed: false
    };
  }

  if (currentCategory === targetCategory && currentLeagueId) {
    return {
      category: currentCategory,
      leagueId: currentLeagueId,
      changed: false
    };
  }

  const nextLeagueId = getDefaultCompetitionForCategory(targetCategory, leagues);
  return {
    category: targetCategory,
    leagueId: nextLeagueId,
    changed: nextLeagueId !== currentLeagueId
  };
};
export const rounds = [['playoff','ملحق الأدوار الإقصائية'],['r32','دور الـ 32'],['r16','دور الـ 16'],['qf','ربع النهائي'],['sf','نصف النهائي'],['thirdPlace','المركز الثالث'],['final','النهائي']];

const LEVEL_ORDER = { A: 1, B: 2, C: 3, D: 4 };

export function parseNationsLeagueGroup(name = '') {
  const raw = String(name || '').trim();
  const shortMatch = raw.match(/\bgroup\s*([a-d])\s*(\d+)\b/i);
  if (shortMatch) {
    const level = shortMatch[1].toUpperCase();
    const number = Number(shortMatch[2]);
    return {
      level,
      levelOrder: LEVEL_ORDER[level] || 99,
      number,
      key: `${level}${number}`,
      arabicName: `المستوى ${level} — المجموعة ${number}`
    };
  }
  const leagueMatch = raw.match(/\bleague\s*([a-d])\s*[-—–]?\s*group\s*(\d+)\b/i);
  if (leagueMatch) {
    const level = leagueMatch[1].toUpperCase();
    const number = Number(leagueMatch[2]);
    return {
      level,
      levelOrder: LEVEL_ORDER[level] || 99,
      number,
      key: `${level}${number}`,
      arabicName: `المستوى ${level} — المجموعة ${number}`
    };
  }
  const arabicMatch = raw.match(/المستوى\s*([a-d])\s*[-—–]\s*المجموعة\s*(\d+)/i);
  if (arabicMatch) {
    const level = arabicMatch[1].toUpperCase();
    const number = Number(arabicMatch[2]);
    return {
      level,
      levelOrder: LEVEL_ORDER[level] || 99,
      number,
      key: `${level}${number}`,
      arabicName: `المستوى ${level} — المجموعة ${number}`
    };
  }
  return null;
}

export function classifyRound(text = '') {
  const s = text.toLowerCase().replaceAll('-', ' ');
  if (/qualif|preliminary|relegation|promotion/.test(s)) return null;
  if (/third|3rd|bronze/.test(s)) return 'thirdPlace';
  if (/round of 32|1\/16/.test(s)) return 'r32';
  if (/round of 16|1\/8|octavos/.test(s)) return 'r16';
  if (/quarter|1\/4/.test(s)) return 'qf';
  if (/semi|1\/2/.test(s)) return 'sf';
  if (/knockout.*play|play.*off/.test(s)) return 'playoff';
  if (/^final$|, final$| final$/.test(s.trim())) return 'final';
  return null;
}
const zone = (label, color = '#10b981') => ({ label, color, bg: color + '18', borderRight: '4px solid ' + color });

const qualifyUefaNationsLeague = (team, groups, year) => {
  const group =
    groups.find(g => Array.isArray(g?.entries) && g.entries.includes(team)) ||
    (team?.groupName ? groups.find(g => g?.name === team.groupName) : null) ||
    groups.find(g => team?.teamId !== undefined && g?.entries?.some(t => String(t.teamId) === String(team.teamId)));
  if (!group || !Array.isArray(group.entries) || group.entries.length === 0) return null;
  if (group.entries.every(t => Number(t.played || 0) === 0)) return null;

  const meta = parseNationsLeagueGroup(group.name || team?.groupName || '');
  const level = group.leagueLevel || meta?.level || null;
  if (!level) return null;

  const activeTeams = group.entries.filter(t => Number(t.played || 0) > 0);
  const requiredGames = group.entries.length === 3 ? 4 : 6;
  const complete =
    (group.entries.length >= 3 && group.entries.every(t => Number(t.played || 0) >= requiredGames)) ||
    (group.entries.length === 4 && activeTeams.length === 3 && activeTeams.every(t => Number(t.played || 0) >= 4));

  const isModern = Number.isFinite(year) ? year >= 2024 : true;

  if (isModern) {
    if (level === 'A') {
      if (team.rank <= 2) return zone(complete ? 'تأهل إلى ربع النهائي' : 'مركز مؤهل إلى ربع النهائي', '#10b981');
      if (team.rank === 3) return zone(complete ? 'ملحق البقاء / الهبوط' : 'مركز ملحق البقاء / الهبوط', '#f59e0b');
      if (team.rank === 4) return zone(complete ? 'هبط إلى المستوى B' : 'مركز هبوط إلى المستوى B', '#ef4444');
      return null;
    }
    if (level === 'B') {
      if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى A' : 'مركز صعود إلى المستوى A', '#3b82f6');
      if (team.rank === 2) return zone(complete ? 'ملحق الصعود إلى المستوى A' : 'مركز ملحق الصعود إلى المستوى A', '#06b6d4');
      if (team.rank === 3) return zone(complete ? 'ملحق البقاء / الهبوط' : 'مركز ملحق البقاء / الهبوط', '#f59e0b');
      if (team.rank === 4) return zone(complete ? 'هبط إلى المستوى C' : 'مركز هبوط إلى المستوى C', '#ef4444');
      return null;
    }
    if (level === 'C') {
      if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى B' : 'مركز صعود إلى المستوى B', '#3b82f6');
      if (team.rank === 2) return zone(complete ? 'ملحق الصعود إلى المستوى B' : 'مركز ملحق الصعود إلى المستوى B', '#06b6d4');
      if (team.rank === 4) {
        if (!complete) return zone('مركز هبوط أو ملحق البقاء', '#ef4444');
        const cGroups = groups.filter(g => (g.leagueLevel || parseNationsLeagueGroup(g.name)?.level) === 'C');
        const allCComplete =
          cGroups.length === 4 &&
          cGroups.every(g => Array.isArray(g.entries) && g.entries.length === 4 && g.entries.every(t => Number(t.played || 0) >= 6));
        if (allCComplete) {
          const fourths = cGroups
            .map(g => g.entries.find(t => t.rank === 4))
            .filter(Boolean);
          const hasComparableStats = fourths.length === 4 && fourths.every(t => Number.isFinite(Number(t.points)));
          if (hasComparableStats) {
            const uniquePtsOrGd = new Set(fourths.map(t => `${t.points}:${(t.goalsFor || 0) - (t.goalsAgainst || 0)}:${t.goalsFor || 0}`));
            if (uniquePtsOrGd.size > 1) {
              const sortedFourths = [...fourths].sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                const gdA = (a.goalsFor || 0) - (a.goalsAgainst || 0);
                const gdB = (b.goalsFor || 0) - (b.goalsAgainst || 0);
                if (gdB !== gdA) return gdB - gdA;
                if ((b.goalsFor || 0) !== (a.goalsFor || 0)) return (b.goalsFor || 0) - (a.goalsFor || 0);
                return (b.win || 0) - (a.win || 0);
              });
              const idx = sortedFourths.findIndex(t => t === team || (t.teamId !== undefined && String(t.teamId) === String(team.teamId)));
              if (idx === 0 || idx === 1) return zone('ملحق البقاء / الهبوط', '#f59e0b');
              if (idx === 2 || idx === 3) return zone('هبط إلى المستوى D', '#ef4444');
            }
          }
        }
        return zone('هبوط أو ملحق البقاء', '#ef4444');
      }
      return null;
    }
    if (level === 'D') {
      if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى C' : 'مركز صعود إلى المستوى C', '#3b82f6');
      if (team.rank === 2) return zone(complete ? 'ملحق الصعود إلى المستوى C' : 'مركز ملحق الصعود إلى المستوى C', '#06b6d4');
      return null;
    }
    return null;
  }

  // Historical seasons (< 2024: 2018/19, 2020/21, 2022/23)
  if (level === 'A') {
    if (team.rank === 1) return zone(complete ? 'تأهل إلى نصف النهائي' : 'مركز مؤهل إلى نصف النهائي', '#10b981');
    if (group.entries.length === 4 && team.rank === 4) {
      return zone(complete ? 'هبط إلى المستوى B' : 'مركز هبوط إلى المستوى B', '#ef4444');
    }
    return null;
  }
  if (level === 'B') {
    if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى A' : 'مركز صعود إلى المستوى A', '#3b82f6');
    if (group.entries.length === 4 && team.rank === 4) {
      return zone(complete ? 'هبط إلى المستوى C' : 'مركز هبوط إلى المستوى C', '#ef4444');
    }
    return null;
  }
  if (level === 'C') {
    if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى B' : 'مركز صعود إلى المستوى B', '#3b82f6');
    if (year >= 2020 && group.entries.length === 4 && team.rank === 4) {
      return zone(complete ? 'ملحق البقاء / الهبوط' : 'مركز ملحق البقاء / الهبوط', '#f59e0b');
    }
    return null;
  }
  if (level === 'D') {
    if (team.rank === 1) return zone(complete ? 'صعد إلى المستوى C' : 'مركز صعود إلى المستوى C', '#3b82f6');
    return null;
  }
  return null;
};

const qualify24TeamGroups = (team, groups, bracket) => {
  const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
  if (!group || group.entries.every(t => Number(t.played || 0) === 0)) return null;
  const complete = group.entries.length === 4 && group.entries.every(t => t.played >= 3);
  if (team.rank <= 2) return zone(complete ? 'تأهل إلى دور الـ16' : 'مركز مؤهل إلى دور الـ16');
  if (team.rank === 3) {
    const participants = new Set((bracket?.r16 || []).flatMap(m => [m.homeTeamId, m.awayTeamId]).filter(Boolean).map(String));
    if (participants.has(String(team.teamId))) return zone('تأهل ضمن أفضل 4 ثوالث', '#3b82f6');
    if (participants.size === 16) return zone('لم يتأهل ضمن أفضل الثوالث', '#ef4444');
    return zone('ينافس على أفضل 4 ثوالث — التأهل غير مؤكد', '#f59e0b');
  }
  return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
};

const qualify16TeamGroups = (team, groups) => {
  const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
  if (!group || group.entries.every(t => Number(t.played || 0) === 0)) return null;
  const complete = group.entries.length === 4 && group.entries.every(t => t.played >= 3);
  if (team.rank <= 2) return zone(complete ? 'تأهل إلى ربع النهائي' : 'مركز مؤهل إلى ربع النهائي');
  return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
};

export function qualification(id, team, groups, bracket) {
  if (!Number.isInteger(team.rank) || team.rank < 1) return null;
  const year = Number(groups[0]?.season?.year);
  if (id === 'uefa.nations') {
    return qualifyUefaNationsLeague(team, groups, year);
  }
  const entries = groups.flatMap(g => g.entries || []);
  if (isUefaClubTournament(id) && year >= 2024 && groups.length === 1 && entries.length === 36) {
    const requiredGames = id === 'uefa.europa.conf' ? 6 : 8;
    const complete = entries.every(t => t.played >= requiredGames);
    const prefix = complete ? 'تأهل إلى ' : 'مركز مؤهل إلى ';
    if (team.rank <= 8) return zone(prefix + 'دور الـ16');
    if (team.rank <= 24) return zone(prefix + 'الملحق الإقصائي', '#f59e0b');
    return zone(complete ? 'خرج من البطولة' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (id === 'fifa.world' && year === 2026 && groups.length === 12) {
    const group = groups.find(g => g.entries.some(t => t.teamId === team.teamId));
    const complete = group?.entries.length === 4 && group.entries.every(t => t.played === 3);
    if (team.rank <= 2) return zone(complete ? 'تأهل إلى دور الـ32' : 'مركز مؤهل إلى دور الـ32');
    if (team.rank === 3) {
      const participants = new Set((bracket?.r32 || []).flatMap(m => [m.homeTeamId, m.awayTeamId]).filter(Boolean));
      if (participants.has(team.teamId)) return zone('تأهل ضمن أفضل 8 ثوالث', '#3b82f6');
      if (participants.size === 32) return zone('لم يتأهل ضمن أفضل الثوالث', '#ef4444');
      return zone('ينافس على أفضل 8 ثوالث — التأهل غير مؤكد', '#f59e0b');
    }
    return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (
    ((id === 'caf.nations' && year >= 2019) || (id === 'uefa.euro' && year >= 2016) || (id === 'afc.asian.cup' && year >= 2019)) &&
    groups.length === 6 &&
    groups.every(g => g.entries.length === 4)
  ) {
    return qualify24TeamGroups(team, groups, bracket);
  }
  if (
    ((id === 'caf.nations' && year < 2019) || (id === 'uefa.euro' && year < 2016) || (id === 'afc.asian.cup' && year < 2019)) &&
    groups.length === 4 &&
    groups.every(g => g.entries.length === 4)
  ) {
    return qualify16TeamGroups(team, groups);
  }
  if (id === 'conmebol.america') {
    // 2024 & 2016 (16 teams): 4 groups of 4, 3 games each -> top 2 to Quarterfinals
    if (groups.length === 4 && groups.every(g => g.entries.length === 4)) {
      return qualify16TeamGroups(team, groups);
    }
    // 2021 edition (ESPN season.year = 2020, 10 teams): 2 groups of 5, 4 games each -> top 4 to Quarterfinals
    if (groups.length === 2 && groups.every(g => g.entries.length === 5)) {
      const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
      const complete = group?.entries.length === 5 && group.entries.every(t => t.played >= 4);
      if (team.rank <= 4) return zone(complete ? 'تأهل إلى ربع النهائي' : 'مركز مؤهل إلى ربع النهائي');
      return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
    }
    // 12-team editions (e.g. 2019, 2015): 3 groups of 4, 3 games each -> top 2 + best 2 thirds to Quarterfinals
    if (groups.length === 3 && groups.every(g => g.entries.length === 4)) {
      const group = groups.find(g => g.entries.some(t => String(t.teamId) === String(team.teamId)));
      const complete = group?.entries.length === 4 && group.entries.every(t => t.played >= 3);
      if (team.rank <= 2) return zone(complete ? 'تأهل إلى ربع النهائي' : 'مركز مؤهل إلى ربع النهائي');
      if (team.rank === 3) {
        const participants = new Set((bracket?.qf || []).flatMap(m => [m.homeTeamId, m.awayTeamId]).filter(Boolean).map(String));
        if (participants.has(String(team.teamId))) return zone('تأهل ضمن أفضل ثوالث', '#3b82f6');
        if (participants.size === 8) return zone('لم يتأهل ضمن أفضل الثوالث', '#ef4444');
        return zone('ينافس على أفضل ثوالث — التأهل غير مؤكد', '#f59e0b');
      }
      return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
    }
    return null;
  }
  // Historical group formats: do not apply a modern league-phase rule.
  if (id === 'fifa.world' && year >= 1998 && year <= 2022 && groups.length === 8 && team.rank <= 2)
    return zone('مركز مؤهل إلى دور الـ16');
  if (id === 'uefa.europa.conf' && year >= 2021 && year < 2024 && groups.length === 8 && groups.every(g => g.entries.length === 4)) {
    const group = groups.find(g => g.entries.some(t => t.teamId === team.teamId)) || groups[0];
    const complete = group?.entries.every(t => t.played >= 6);
    const prefix = complete ? 'تأهل إلى ' : 'مركز مؤهل إلى ';
    if (team.rank === 1) return zone(prefix + 'دور الـ16');
    if (team.rank === 2) return zone(prefix + 'الملحق الإقصائي', '#f59e0b');
    return zone(complete ? 'خرج من دور المجموعات' : 'خارج مراكز التأهل حالياً', '#ef4444');
  }
  if (isUefaClubTournament(id) && id !== 'uefa.europa.conf' && year < 2024 && groups.every(g => g.entries.length === 4) && team.rank <= 2)
    return zone('مركز مؤهل إلى الدور التالي');
  return null;
}
