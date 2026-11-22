import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTournament,
  isNationalTournament,
  isUefaClubTournament,
  isInternationalQualifier,
  isNationalTeamCompetition,
  isClubCompetition,
  COMPETITION_CATEGORIES,
  DEFAULT_CATEGORY_LEAGUES,
  NATIONAL_SECTIONS,
  getCompetitionClassification,
  organizeCompetitions,
  getDefaultCompetitionForCategory,
  resolveCategorySwitchSelection,
  classifyRound,
  qualification,
  parseNationsLeagueGroup
} from '../src/services/tournamentRules.js';
import { getTournamentKnockouts, getLeagues, getStandings, createStandingsController, resolveLeagueLogo, resolveTeamLogo, DEFAULT_TEAM_LOGO } from '../src/services/footballService.js';
import { getQuickSuggestions, searchAll, matchesCompetitionFilter } from '../src/services/searchService.js';
import { getSeasonCalendarYears, organizeHistoricalMatches } from '../src/services/historicalMatchesService.js';
import { parseAvailableSeasons, buildSeasonSearchParams } from '../src/services/standingsService.js';
import { buildBracket } from '../src/services/bracketLayout.js';

test('round classification keeps round of 32 and bronze distinct from final', () => {
  for (const [name, expected] of [['round-of-32','r32'],['round-of-16','r16'],['quarterfinals','qf'],['semifinals','sf'],['third-place-final','thirdPlace'],['final','final'],['knockout-phase-play-offs','playoff'],['qualifying-playoffs',null]]) assert.equal(classifyRound(name), expected);
});
test('UEFA boundaries and provisional vs completed standings', () => {
  const entries = Array.from({length:36}, (_,i) => ({rank:i+1,played:4,teamId:String(i)}));
  const groups = [{season:{year:2026},entries}];
  assert.match(qualification('uefa.champions', entries[7],groups)?.label,/مركز مؤهل.*16/);
  assert.match(qualification('uefa.champions', entries[8],groups)?.label,/الملحق/);
  assert.match(qualification('uefa.europa', entries[23],groups)?.label,/الملحق/);
  assert.match(qualification('uefa.europa', entries[24],groups)?.label,/خارج/);
  entries.forEach(t=>t.played=8);
  assert.match(qualification('uefa.champions', entries[0],groups)?.label,/^تأهل/);
  assert.equal(qualification('uefa.champions',{rank:0},groups),null);
});
test('third place requires real R32 participation, not a generic best-eight note', () => {
  const groups = Array.from({length:12},(_,g)=>({season:{year:2026},entries:Array.from({length:4},(_,i)=>({teamId:String(g*4+i),rank:i+1,played:3}))}));
  const third=groups[0].entries[2];
  assert.match(qualification('fifa.world',third,groups,null).label,/غير مؤكد/);
  assert.match(qualification('fifa.world',third,groups,{r32:[{homeTeamId:third.teamId}]}).label,/تأهل ضمن/);
  const r32=Array.from({length:16},(_,i)=>({homeTeamId:'x'+i,awayTeamId:'y'+i}));
  assert.match(qualification('fifa.world',third,groups,{r32}).label,/لم يتأهل/);
});
test('season schedule spans calendar years, deduplicates and retains penalty winner', async () => {
  const original=globalThis.fetch;
  const urls=[];
  const event={id:'1',season:{year:2026,slug:'round-of-16'},date:'2027-03-01T20:00Z',status:{type:{state:'post',detail:'After penalties'}},competitions:[{competitors:[{homeAway:'home',score:'1',winner:false,team:{id:'a'}},{homeAway:'away',score:'1',winner:true,team:{id:'b'}}]}]};
  globalThis.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>({events:[event,{...event,id:'old',season:{year:2025,slug:'final'}}]})}};
  try {
    const data=await getTournamentKnockouts('uefa.champions',2026);
    assert.equal(urls.filter(u=>u.includes('/scoreboard?')).length,2);
    assert.equal(urls.filter(u=>u.includes('/summary?')).length,1);
    assert.ok(urls.some(u=>u.includes('dates=2027')));
    assert.equal(data.r16.length,1);
    assert.equal(data.final.length,0);
    assert.equal(data.r16[0].awayWinner,true);
  } finally {globalThis.fetch=original;}
});
test('league and team logo URLs use verified ESPN leaguelogos/teamlogos paths, entity IDs and safe fallbacks', () => {
  const leagues = getLeagues();
  const expectedIds = {
    'eng.1': '23',
    'esp.1': '15',
    'ita.1': '12',
    'ger.1': '10',
    'fra.1': '9',
    'ksa.1': '2488',
    'uefa.champions': '2',
    'uefa.europa': '2310',
    'uefa.europa.conf': '20296',
    'fifa.world': '4',
    'caf.nations': '76',
    'uefa.euro': '74',
    'uefa.nations': '2395',
    'conmebol.america': '83',
    'afc.asian.cup': '2243',
    'usa.1': '19'
  };

  for (const league of leagues) {
    if (league.id === 'egypt.1') {
      assert.equal(league.logo, '');
    } else {
      const expectedUrl = `https://a.espncdn.com/i/leaguelogos/soccer/500/${expectedIds[league.id]}.png`;
      assert.equal(league.logo, expectedUrl);
      assert.equal(league.logo.includes('/i/league-logos/'), false);
      assert.equal(league.logo.includes('/i/teamlogos/'), false);
    }
  }

  const suggestions = getQuickSuggestions();
  for (const item of suggestions.popularLeagues) {
    const official = leagues.find(l => l.id === item.id);
    assert.equal(item.logo, official.logo);
  }

  // resolveLeagueLogo prefers official API logo and rejects team/broken URLs
  assert.equal(
    resolveLeagueLogo({ logos: [{ href: 'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png' }] }, ''),
    'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png'
  );
  assert.equal(
    resolveLeagueLogo({ logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/350.png' }, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png'),
    'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png'
  );
  assert.equal(
    resolveLeagueLogo({ logo: 'https://a.espncdn.com/i/league-logos/soccer/500/23.png' }, ''),
    ''
  );

  // resolveTeamLogo prefers valid team logo and falls back to DEFAULT_TEAM_LOGO without using broken default-soccer.png
  assert.equal(
    resolveTeamLogo({ logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' }),
    'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'
  );
  assert.equal(
    resolveTeamLogo({ logo: 'https://a.espncdn.com/i/teamlogos/default-soccer.png' }),
    DEFAULT_TEAM_LOGO
  );
  assert.equal(
    resolveTeamLogo({ logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png' }),
    DEFAULT_TEAM_LOGO
  );
  assert.equal(resolveTeamLogo(null, ''), '');
});

test('UEFA Conference League registration, search aliases, modern 6-match league phase, old 8-group format, and knockouts', async () => {
  const leagues = getLeagues();
  const conf = leagues.find(l => l.id === 'uefa.europa.conf');
  assert.ok(conf, 'uefa.europa.conf must be registered in getLeagues()');
  assert.equal(conf.name, 'دوري المؤتمر الأوروبي');
  assert.equal(conf.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png');
  assert.equal(isTournament('uefa.europa.conf'), true);

  // Arabic & English search aliases
  for (const query of ['دوري المؤتمر الأوروبي', 'دوري المؤتمر الاوروبي', 'دوري المؤتمر', 'كونفرنس ليج', 'conference league', 'uefa conference league', 'uecl']) {
    const result = searchAll({ query, leagues, matches: [] });
    assert.equal(
      result.leagues.some(l => l.id === 'uefa.europa.conf'),
      true,
      `search query "${query}" must match uefa.europa.conf`
    );
  }

  // Modern 36-team League Phase (>= 2024): completes at 6 games for UECL, while UCL & UEL still require 8 games
  const entries6 = Array.from({ length: 36 }, (_, i) => ({ rank: i + 1, played: 6, teamId: String(i + 1) }));
  const groups2024 = [{ season: { year: 2024 }, entries: entries6 }];

  // At 6 games: Conference League is COMPLETED
  assert.equal(qualification('uefa.europa.conf', entries6[0], groups2024)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('uefa.europa.conf', entries6[7], groups2024)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('uefa.europa.conf', entries6[8], groups2024)?.label, 'تأهل إلى الملحق الإقصائي');
  assert.equal(qualification('uefa.europa.conf', entries6[23], groups2024)?.label, 'تأهل إلى الملحق الإقصائي');
  assert.equal(qualification('uefa.europa.conf', entries6[24], groups2024)?.label, 'خرج من البطولة');
  assert.equal(qualification('uefa.europa.conf', entries6[35], groups2024)?.label, 'خرج من البطولة');

  // At 6 games: UCL & UEL remain PROVISIONAL (still require 8 games)
  assert.equal(qualification('uefa.champions', entries6[0], groups2024)?.label, 'مركز مؤهل إلى دور الـ16');
  assert.equal(qualification('uefa.europa', entries6[0], groups2024)?.label, 'مركز مؤهل إلى دور الـ16');

  // At 3 games (provisional): Conference League uses provisional labels
  const entries3 = Array.from({ length: 36 }, (_, i) => ({ rank: i + 1, played: 3, teamId: String(i + 1) }));
  const groups2026 = [{ season: { year: 2026 }, entries: entries3 }];
  assert.equal(qualification('uefa.europa.conf', entries3[0], groups2026)?.label, 'مركز مؤهل إلى دور الـ16');
  assert.equal(qualification('uefa.europa.conf', entries3[15], groups2026)?.label, 'مركز مؤهل إلى الملحق الإقصائي');
  assert.equal(qualification('uefa.europa.conf', entries3[30], groups2026)?.label, 'خارج مراكز التأهل حالياً');

  // Old 8-group format (2021-2023): 1st -> R16, 2nd -> Knockout Playoffs (NOT R16), 3rd & 4th -> Eliminated
  const oldGroups2023 = Array.from({ length: 8 }, (_, g) => ({
    name: `Group ${g + 1}`,
    season: { year: 2023 },
    entries: Array.from({ length: 4 }, (_, r) => ({ rank: r + 1, played: 6, teamId: `g${g}-t${r}` }))
  }));
  const g0 = oldGroups2023[0].entries;
  assert.equal(qualification('uefa.europa.conf', g0[0], oldGroups2023)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('uefa.europa.conf', g0[1], oldGroups2023)?.label, 'تأهل إلى الملحق الإقصائي');
  assert.equal(qualification('uefa.europa.conf', g0[2], oldGroups2023)?.label, 'خرج من دور المجموعات');
  assert.equal(qualification('uefa.europa.conf', g0[3], oldGroups2023)?.label, 'خرج من دور المجموعات');

  // Historical split-year calendar years & two-legged knockout bracket + single-match final
  assert.deepEqual(getSeasonCalendarYears('uefa.europa.conf', 2023), [2023, 2024]);
  assert.deepEqual(getSeasonCalendarYears('uefa.europa.conf', 2024), [2024, 2025]);

  const bracket = buildBracket({
    sf: [
      { id: 'sf-1', date: '2025-05-01T19:00Z', status: 'FT', homeTeamId: '363', awayTeamId: '900', homeTeam: 'Chelsea', awayTeam: 'Djurgarden', homeScore: 4, awayScore: 1, homeWinner: true, awayWinner: false },
      { id: 'sf-2', date: '2025-05-08T19:00Z', status: 'FT', homeTeamId: '900', awayTeamId: '363', homeTeam: 'Djurgarden', awayTeam: 'Chelsea', homeScore: 0, awayScore: 1, homeWinner: false, awayWinner: true }
    ],
    final: [
      { id: 'fin-1', date: '2025-05-28T19:00Z', status: 'FT', homeTeamId: '363', awayTeamId: '244', homeTeam: 'Chelsea', awayTeam: 'Real Betis', homeScore: 4, awayScore: 1, homeWinner: true, awayWinner: false }
    ]
  });
  const sfNode = bracket.nodes.find(n => n.round === 'sf');
  const finalNode = bracket.nodes.find(n => n.round === 'final');
  assert.equal(sfNode.match.isTwoLegged, true);
  assert.deepEqual(sfNode.match.aggregateScore, [5, 1]);
  assert.equal(sfNode.next, finalNode.id);
  assert.equal(Boolean(finalNode.match.isTwoLegged), false);
});

test('AFCON (caf.nations) registration, search, 24-team best-4-thirds rules, older 16-team format, cross-year knockouts, and stage grouping', async () => {
  const leagues = getLeagues();
  const afcon = leagues.find(l => l.id === 'caf.nations');
  assert.ok(afcon, 'caf.nations must be registered in getLeagues()');
  assert.equal(afcon.name, 'كأس الأمم الإفريقية');
  assert.equal(afcon.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/76.png');
  assert.equal(isTournament('caf.nations'), true);
  assert.equal(isNationalTournament('caf.nations'), true);
  assert.equal(isNationalTournament('uefa.champions'), false);

  // Arabic & English search aliases
  for (const query of ['كأس الأمم الإفريقية', 'كأس الامم الافريقية', 'أمم أفريقيا', 'افريقيا', 'AFCON', 'Africa Cup of Nations', 'CAN']) {
    const res = searchAll({ query, leagues, matches: [] });
    assert.equal(res.leagues.some(l => l.id === 'caf.nations'), true, `search query "${query}" must match caf.nations`);
  }

  // Modern 24-team AFCON format (2021, 2023, 2025): 6 groups x 4 teams
  const buildAfconGroups = (year, played = 3) =>
    Array.from({ length: 6 }, (_, g) => ({
      name: `Group ${String.fromCharCode(65 + g)}`,
      season: { year },
      entries: Array.from({ length: 4 }, (_, r) => ({
        teamId: `g${g}-r${r + 1}`,
        rank: r + 1,
        played
      }))
    }));

  // Completed group stage + verified R16 bracket with exactly 4 qualified third-placed teams (groups A,B,C,D) and 2 eliminated (E,F)
  const groups2023 = buildAfconGroups(2023, 3);
  const r16Participants = [
    ...groups2023.flatMap(g => [g.entries[0].teamId, g.entries[1].teamId]),
    'g0-r3', 'g1-r3', 'g2-r3', 'g3-r3'
  ];
  const r16Bracket = {
    r16: Array.from({ length: 8 }, (_, i) => ({
      homeTeamId: r16Participants[i * 2],
      awayTeamId: r16Participants[i * 2 + 1]
    }))
  };

  // Top 2 qualify for R16; 4th eliminated
  assert.equal(qualification('caf.nations', groups2023[0].entries[0], groups2023, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('caf.nations', groups2023[0].entries[1], groups2023, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('caf.nations', groups2023[0].entries[3], groups2023, r16Bracket)?.label, 'خرج من دور المجموعات');

  // Exactly 4 qualified third-placed teams and 2 non-qualified third-placed teams
  const thirdOutcomes = groups2023.map(g => qualification('caf.nations', g.entries[2], groups2023, r16Bracket)?.label);
  assert.equal(thirdOutcomes.filter(l => l === 'تأهل ضمن أفضل 4 ثوالث').length, 4);
  assert.equal(thirdOutcomes.filter(l => l === 'لم يتأهل ضمن أفضل الثوالث').length, 2);

  // Incomplete group stage / missing R16 bracket -> neutral provisional third-place label (never marks all 6 as qualified!)
  const groups2025Live = buildAfconGroups(2025, 2);
  assert.equal(qualification('caf.nations', groups2025Live[0].entries[0], groups2025Live, null)?.label, 'مركز مؤهل إلى دور الـ16');
  assert.equal(qualification('caf.nations', groups2025Live[0].entries[2], groups2025Live, null)?.label, 'ينافس على أفضل 4 ثوالث — التأهل غير مؤكد');
  assert.equal(qualification('caf.nations', groups2025Live[0].entries[3], groups2025Live, null)?.label, 'خارج مراكز التأهل حالياً');

  // Older 16-team AFCON edition (2017: 4 groups x 4 teams -> top 2 to Quarterfinals, no best-thirds)
  const oldGroups2017 = Array.from({ length: 4 }, (_, g) => ({
    name: `Group ${g + 1}`,
    season: { year: 2017 },
    entries: Array.from({ length: 4 }, (_, r) => ({ teamId: `old-${g}-${r}`, rank: r + 1, played: 3 }))
  }));
  assert.equal(qualification('caf.nations', oldGroups2017[0].entries[0], oldGroups2017, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('caf.nations', oldGroups2017[0].entries[2], oldGroups2017, null)?.label, 'خرج من دور المجموعات');

  // Cross-calendar-year editions (2021 -> 2022, 2023 -> 2024, 2025 -> 2025/2026)
  assert.deepEqual(getSeasonCalendarYears('caf.nations', 2021), [2021, 2022]);
  assert.deepEqual(getSeasonCalendarYears('caf.nations', 2023), [2023, 2024]);
  assert.deepEqual(getSeasonCalendarYears('caf.nations', 2025), [2025, 2026]);

  // Historical stage grouping preserves all 6 AFCON stages including 3rd-place match
  const afconFixtures = [
    { id: 'af-gs', date: '2024-01-13T20:00Z', dateKey: '2024-01-13', dateTs: Date.parse('2024-01-13T20:00Z'), seasonSlug: 'group-stage' },
    { id: 'af-r16', date: '2024-01-27T17:00Z', dateKey: '2024-01-27', dateTs: Date.parse('2024-01-27T17:00Z'), seasonSlug: 'round-of-16' },
    { id: 'af-qf', date: '2024-02-02T17:00Z', dateKey: '2024-02-02', dateTs: Date.parse('2024-02-02T17:00Z'), seasonSlug: 'quarterfinals' },
    { id: 'af-sf', date: '2024-02-07T17:00Z', dateKey: '2024-02-07', dateTs: Date.parse('2024-02-07T17:00Z'), seasonSlug: 'semifinals' },
    { id: 'af-3rd', date: '2024-02-10T20:00Z', dateKey: '2024-02-10', dateTs: Date.parse('2024-02-10T20:00Z'), seasonSlug: '3rd-place-match' },
    { id: 'af-fin', date: '2024-02-11T20:00Z', dateKey: '2024-02-11', dateTs: Date.parse('2024-02-11T20:00Z'), seasonSlug: 'final' }
  ];
  const organized = organizeHistoricalMatches(afconFixtures, 'caf.nations');
  assert.equal(organized.mode, 'stages');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-group-stage',
    'stage-r16',
    'stage-qf',
    'stage-sf',
    'stage-third-place',
    'stage-final'
  ]);

  // getTournamentKnockouts queries [year, year+1] for AFCON, filters season identity, and preserves AET/PEN + 3rd-place
  const originalFetch = globalThis.fetch;
  const fetchedUrls = [];
  globalThis.fetch = async (url) => {
    const str = String(url);
    fetchedUrls.push(str);
    if (str.includes('/summary?')) {
      return { ok: true, json: async () => ({}) };
    }
    if (str.includes('dates=2024')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'afcon23-3rd',
              season: { year: 2023, slug: '3rd-place-match' },
              date: '2024-02-10T20:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '0', shootoutScore: '6', winner: true, team: { id: '467', displayName: 'South Africa' } },
                  { homeAway: 'away', score: '0', shootoutScore: '5', winner: false, team: { id: '2847', displayName: 'DR Congo' } }
                ]
              }]
            },
            {
              id: 'afcon23-final',
              season: { year: 2023, slug: 'final' },
              date: '2024-02-11T20:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', winner: false, team: { id: '657', displayName: 'Nigeria' } },
                  { homeAway: 'away', score: '2', winner: true, team: { id: '4789', displayName: 'Ivory Coast' } }
                ]
              }]
            },
            {
              id: 'wrong-season-event',
              season: { year: 2021, slug: 'final' },
              date: '2022-02-06T19:00Z',
              status: { type: { state: 'post', completed: true } },
              competitions: [{ competitors: [] }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const knockouts = await getTournamentKnockouts('caf.nations', 2023);
    assert.ok(fetchedUrls.some(u => u.includes('dates=2023')));
    assert.ok(fetchedUrls.some(u => u.includes('dates=2024')));
    assert.equal(knockouts.thirdPlace.length, 1);
    assert.equal(knockouts.thirdPlace[0].finishType, 'penalties');
    assert.equal(knockouts.thirdPlace[0].homePenalties, 6);
    assert.equal(knockouts.final.length, 1);
    assert.equal(knockouts.final[0].awayWinner, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('EURO (uefa.euro) registration, UEFA club separation, 24-team and 16-team formats, EURO 2020 in 2021, and no third-place match', async () => {
  const leagues = getLeagues();
  const euro = leagues.find(l => l.id === 'uefa.euro');
  assert.ok(euro, 'uefa.euro must be registered in getLeagues()');
  assert.equal(euro.name, 'كأس أمم أوروبا');
  assert.equal(euro.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/74.png');

  // Strict separation between UEFA national tournament and UEFA club tournaments
  assert.equal(isTournament('uefa.euro'), true);
  assert.equal(isNationalTournament('uefa.euro'), true);
  assert.equal(isUefaClubTournament('uefa.euro'), false);
  assert.equal(isUefaClubTournament('uefa.champions'), true);
  assert.equal(isUefaClubTournament('uefa.europa'), true);
  assert.equal(isUefaClubTournament('uefa.europa.conf'), true);

  // Arabic & English search aliases
  for (const query of ['كأس أمم أوروبا', 'كأس الامم الاوروبية', 'أمم أوروبا', 'يورو', 'EURO', 'UEFA EURO', 'European Championship']) {
    const res = searchAll({ query, leagues, matches: [] });
    assert.equal(res.leagues.some(l => l.id === 'uefa.euro'), true, `search query "${query}" must match uefa.euro`);
  }

  // Modern 24-team EURO format (2016, 2020, 2024): 6 groups x 4 teams
  const buildEuroGroups = (year, played = 3) =>
    Array.from({ length: 6 }, (_, g) => ({
      name: `Group ${String.fromCharCode(65 + g)}`,
      season: { year },
      entries: Array.from({ length: 4 }, (_, r) => ({
        teamId: `eu-g${g}-r${r + 1}`,
        rank: r + 1,
        played
      }))
    }));

  const groups2024 = buildEuroGroups(2024, 3);
  const r16Teams = [
    ...groups2024.flatMap(g => [g.entries[0].teamId, g.entries[1].teamId]),
    'eu-g1-r3', 'eu-g2-r3', 'eu-g3-r3', 'eu-g4-r3'
  ];
  const r16Bracket = {
    r16: Array.from({ length: 8 }, (_, i) => ({
      homeTeamId: r16Teams[i * 2],
      awayTeamId: r16Teams[i * 2 + 1]
    }))
  };

  assert.equal(qualification('uefa.euro', groups2024[0].entries[0], groups2024, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('uefa.euro', groups2024[0].entries[1], groups2024, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('uefa.euro', groups2024[0].entries[3], groups2024, r16Bracket)?.label, 'خرج من دور المجموعات');

  // Exactly 4 qualified third-placed teams and 2 eliminated
  const thirdLabels = groups2024.map(g => qualification('uefa.euro', g.entries[2], groups2024, r16Bracket)?.label);
  assert.equal(thirdLabels.filter(l => l === 'تأهل ضمن أفضل 4 ثوالث').length, 4);
  assert.equal(thirdLabels.filter(l => l === 'لم يتأهل ضمن أفضل الثوالث').length, 2);

  // Older 16-team EURO format (2004, 2008, 2012): 4 groups x 4 -> top 2 to Quarterfinals, no best-thirds
  const groups2012 = Array.from({ length: 4 }, (_, g) => ({
    name: `Group ${String.fromCharCode(65 + g)}`,
    season: { year: 2012 },
    entries: Array.from({ length: 4 }, (_, r) => ({ teamId: `eu12-${g}-${r}`, rank: r + 1, played: 3 }))
  }));
  assert.equal(qualification('uefa.euro', groups2012[0].entries[0], groups2012, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('uefa.euro', groups2012[0].entries[1], groups2012, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('uefa.euro', groups2012[0].entries[2], groups2012, null)?.label, 'خرج من دور المجموعات');

  // EURO 2020 spans into calendar year 2021; stage ordering has NO third-place match
  assert.deepEqual(getSeasonCalendarYears('uefa.euro', 2020), [2020, 2021]);
  assert.deepEqual(getSeasonCalendarYears('uefa.euro', 2024), [2024, 2025]);

  const euro2024Fixtures = [
    { id: 'e24-gs', date: '2024-06-14T19:00Z', dateKey: '2024-06-14', dateTs: Date.parse('2024-06-14T19:00Z'), seasonSlug: 'group-stage' },
    { id: 'e24-r16', date: '2024-06-29T16:00Z', dateKey: '2024-06-29', dateTs: Date.parse('2024-06-29T16:00Z'), seasonSlug: 'round-of-16' },
    { id: 'e24-qf', date: '2024-07-05T16:00Z', dateKey: '2024-07-05', dateTs: Date.parse('2024-07-05T16:00Z'), seasonSlug: 'quarterfinals' },
    { id: 'e24-sf', date: '2024-07-09T19:00Z', dateKey: '2024-07-09', dateTs: Date.parse('2024-07-09T19:00Z'), seasonSlug: 'semifinals' },
    { id: 'e24-fin', date: '2024-07-14T19:00Z', dateKey: '2024-07-14', dateTs: Date.parse('2024-07-14T19:00Z'), seasonSlug: 'final' }
  ];
  const organized = organizeHistoricalMatches(euro2024Fixtures, 'uefa.euro');
  assert.equal(organized.mode, 'stages');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-group-stage',
    'stage-r16',
    'stage-qf',
    'stage-sf',
    'stage-final'
  ]);
  assert.equal(organized.groups.some(g => g.id === 'stage-third-place'), false);

  // getTournamentKnockouts retrieves EURO 2020 (played in 2021), preserves PEN/AET, filters wrong season, and keeps thirdPlace empty
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const str = String(url);
    urls.push(str);
    if (str.includes('/summary?')) return { ok: true, json: async () => ({}) };
    if (str.includes('dates=2021')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'euro2020-final',
              season: { year: 2020, slug: 'final' },
              date: '2021-07-11T19:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', shootoutScore: '3', winner: true, team: { id: '162', displayName: 'Italy' } },
                  { homeAway: 'away', score: '1', shootoutScore: '2', winner: false, team: { id: '448', displayName: 'England' } }
                ]
              }]
            },
            {
              id: 'euro2024-wrong-season',
              season: { year: 2024, slug: 'final' },
              date: '2024-07-14T19:00Z',
              status: { type: { state: 'post', completed: true } },
              competitions: [{ competitors: [] }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const knockouts2020 = await getTournamentKnockouts('uefa.euro', 2020);
    assert.ok(urls.some(u => u.includes('dates=2020')));
    assert.ok(urls.some(u => u.includes('dates=2021')));
    assert.equal(knockouts2020.thirdPlace.length, 0);
    assert.equal(knockouts2020.final.length, 1);
    assert.equal(knockouts2020.final[0].finishType, 'penalties');
    assert.equal(knockouts2020.final[0].homePenalties, 3);
    assert.equal(knockouts2020.final[0].homeWinner, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Copa America (conmebol.america) registration, search, 2024 vs 2021 formats, 2020/2021 season label, knockouts, and no R16', async () => {
  const leagues = getLeagues();
  const copa = leagues.find(l => l.id === 'conmebol.america');
  assert.ok(copa, 'conmebol.america must be registered in getLeagues()');
  assert.equal(copa.name, 'كوبا أمريكا');
  assert.equal(copa.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/83.png');
  assert.equal(isTournament('conmebol.america'), true);
  assert.equal(isNationalTournament('conmebol.america'), true);
  assert.equal(isUefaClubTournament('conmebol.america'), false);

  // Arabic & English search aliases
  for (const query of ['كوبا أمريكا', 'كوبا امريكا', 'كوبا', 'Copa América', 'Copa America', 'CONMEBOL Copa America']) {
    const res = searchAll({ query, leagues, matches: [] });
    assert.equal(res.leagues.some(l => l.id === 'conmebol.america'), true, `search query "${query}" must match conmebol.america`);
  }

  // Internal season ID 2020 preserved while user-facing label displays official edition year 2021
  const parsedSeasons = parseAvailableSeasons([
    { year: 2024, displayName: '2024 Copa América' },
    { year: 2020, displayName: '2021 Copa América' },
    { year: 2019, displayName: '2019 Copa América' }
  ], { currentSeasonYear: 2024 });
  const copa2021Season = parsedSeasons.find(s => s.year === 2020);
  assert.equal(copa2021Season?.year, 2020);
  assert.equal(copa2021Season?.label, '2021');
  assert.equal(parsedSeasons[0]?.label, '2024');

  // 2024 format: 4 groups x 4 teams, 3 games -> top 2 directly to Quarterfinals, 3rd & 4th eliminated (no R16, no best-thirds)
  const groups2024 = Array.from({ length: 4 }, (_, g) => ({
    name: `Group ${String.fromCharCode(65 + g)}`,
    season: { year: 2024 },
    entries: Array.from({ length: 4 }, (_, r) => ({ teamId: `ca24-${g}-${r}`, rank: r + 1, played: 3 }))
  }));
  assert.equal(qualification('conmebol.america', groups2024[0].entries[0], groups2024, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('conmebol.america', groups2024[0].entries[1], groups2024, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('conmebol.america', groups2024[0].entries[2], groups2024, null)?.label, 'خرج من دور المجموعات');
  assert.equal(qualification('conmebol.america', groups2024[0].entries[3], groups2024, null)?.label, 'خرج من دور المجموعات');

  // 2024 provisional during group stage (2 games played)
  const groups2024Live = Array.from({ length: 4 }, (_, g) => ({
    name: `Group ${String.fromCharCode(65 + g)}`,
    season: { year: 2024 },
    entries: Array.from({ length: 4 }, (_, r) => ({ teamId: `ca24l-${g}-${r}`, rank: r + 1, played: 2 }))
  }));
  assert.equal(qualification('conmebol.america', groups2024Live[0].entries[0], groups2024Live, null)?.label, 'مركز مؤهل إلى ربع النهائي');
  assert.equal(qualification('conmebol.america', groups2024Live[0].entries[2], groups2024Live, null)?.label, 'خارج مراكز التأهل حالياً');

  // 2021 edition (ESPN season.year = 2020): 2 groups x 5 teams, 4 games -> top 4 to Quarterfinals, 5th eliminated
  const groups2021 = Array.from({ length: 2 }, (_, g) => ({
    name: `Group ${g + 1}`,
    season: { year: 2020 },
    entries: Array.from({ length: 5 }, (_, r) => ({ teamId: `ca21-${g}-${r}`, rank: r + 1, played: 4 }))
  }));
  assert.equal(qualification('conmebol.america', groups2021[0].entries[0], groups2021, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('conmebol.america', groups2021[0].entries[3], groups2021, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('conmebol.america', groups2021[0].entries[4], groups2021, null)?.label, 'خرج من دور المجموعات');

  // Cross-year fetching for 2020/2021 edition & stage sequence without Round of 16
  assert.deepEqual(getSeasonCalendarYears('conmebol.america', 2020), [2020, 2021]);
  assert.deepEqual(getSeasonCalendarYears('conmebol.america', 2024), [2024, 2025]);

  const copaFixtures = [
    { id: 'ca-gs', date: '2024-06-20T23:00Z', dateKey: '2024-06-20', dateTs: Date.parse('2024-06-20T23:00Z'), seasonSlug: 'group-stage' },
    { id: 'ca-qf', date: '2024-07-04T23:00Z', dateKey: '2024-07-04', dateTs: Date.parse('2024-07-04T23:00Z'), seasonSlug: 'quarterfinals' },
    { id: 'ca-sf', date: '2024-07-09T23:00Z', dateKey: '2024-07-09', dateTs: Date.parse('2024-07-09T23:00Z'), seasonSlug: 'semifinals' },
    { id: 'ca-3rd', date: '2024-07-13T23:00Z', dateKey: '2024-07-13', dateTs: Date.parse('2024-07-13T23:00Z'), seasonSlug: '3rd-place-match' },
    { id: 'ca-fin', date: '2024-07-14T23:00Z', dateKey: '2024-07-14', dateTs: Date.parse('2024-07-14T23:00Z'), seasonSlug: 'final' }
  ];
  const organized = organizeHistoricalMatches(copaFixtures, 'conmebol.america');
  assert.equal(organized.mode, 'stages');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-group-stage',
    'stage-qf',
    'stage-sf',
    'stage-third-place',
    'stage-final'
  ]);
  assert.equal(organized.groups.some(g => g.id === 'stage-r16'), false);

  // getTournamentKnockouts queries [2020, 2021] for Copa 2021 (season.year=2020) and captures 3rd-place + PEN + final
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const str = String(url);
    urls.push(str);
    if (str.includes('/summary?')) return { ok: true, json: async () => ({}) };
    if (str.includes('dates=2021')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'copa21-sf-pen',
              season: { year: 2020, slug: 'semifinals' },
              date: '2021-07-07T01:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', shootoutScore: '3', winner: true, team: { id: '202', displayName: 'Argentina' } },
                  { homeAway: 'away', score: '1', shootoutScore: '2', winner: false, team: { id: '208', displayName: 'Colombia' } }
                ]
              }]
            },
            {
              id: 'copa21-3rd',
              season: { year: 2020, slug: '3rd-place' },
              date: '2021-07-10T00:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '3', winner: true, team: { id: '208', displayName: 'Colombia' } },
                  { homeAway: 'away', score: '2', winner: false, team: { id: '211', displayName: 'Peru' } }
                ]
              }]
            },
            {
              id: 'copa21-final',
              season: { year: 2020, slug: 'final' },
              date: '2021-07-11T00:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', winner: true, team: { id: '202', displayName: 'Argentina' } },
                  { homeAway: 'away', score: '0', winner: false, team: { id: '205', displayName: 'Brazil' } }
                ]
              }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const knockouts2021 = await getTournamentKnockouts('conmebol.america', 2020);
    assert.ok(urls.some(u => u.includes('dates=2020')));
    assert.ok(urls.some(u => u.includes('dates=2021')));
    assert.equal(knockouts2021.r16.length, 0);
    assert.equal(knockouts2021.sf.length, 1);
    assert.equal(knockouts2021.sf[0].finishType, 'penalties');
    assert.equal(knockouts2021.thirdPlace.length, 1);
    assert.equal(knockouts2021.final.length, 1);
    assert.equal(knockouts2021.final[0].homeWinner, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AFC Asian Cup (afc.asian.cup) registration, search, 24-team rules, 2019/2023/2027 editions, 2023 in 2024 knockouts, and no third-place match', async () => {
  const leagues = getLeagues();
  const asianCup = leagues.find(l => l.id === 'afc.asian.cup');
  assert.ok(asianCup, 'afc.asian.cup must be registered in getLeagues()');
  assert.equal(asianCup.name, 'كأس آسيا');
  assert.equal(asianCup.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2243.png');
  assert.equal(isTournament('afc.asian.cup'), true);
  assert.equal(isNationalTournament('afc.asian.cup'), true);
  assert.equal(isUefaClubTournament('afc.asian.cup'), false);

  // Arabic & English search aliases
  for (const query of ['كأس آسيا', 'كاس اسيا', 'كأس الأمم الآسيوية', 'كأس الامم الاسيوية', 'Asian Cup', 'AFC Asian Cup', 'AFC']) {
    const res = searchAll({ query, leagues, matches: [] });
    assert.equal(res.leagues.some(l => l.id === 'afc.asian.cup'), true, `search query "${query}" must match afc.asian.cup`);
  }

  const buildAsianCupGroups = (year, played = 3) =>
    Array.from({ length: 6 }, (_, g) => ({
      name: `Group ${String.fromCharCode(65 + g)}`,
      season: { year },
      entries: Array.from({ length: 4 }, (_, r) => ({
        teamId: `ac-${year}-g${g}-r${r + 1}`,
        rank: r + 1,
        played
      }))
    }));

  // 2023 completed edition (6 groups x 4 teams) with exactly 4 qualified third-placed teams & 2 eliminated
  const groups2023 = buildAsianCupGroups(2023, 3);
  const r16Teams = [
    ...groups2023.flatMap(g => [g.entries[0].teamId, g.entries[1].teamId]),
    'ac-2023-g0-r3', 'ac-2023-g1-r3', 'ac-2023-g2-r3', 'ac-2023-g3-r3'
  ];
  const r16Bracket = {
    r16: Array.from({ length: 8 }, (_, i) => ({
      homeTeamId: r16Teams[i * 2],
      awayTeamId: r16Teams[i * 2 + 1]
    }))
  };

  assert.equal(qualification('afc.asian.cup', groups2023[0].entries[0], groups2023, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('afc.asian.cup', groups2023[0].entries[1], groups2023, r16Bracket)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('afc.asian.cup', groups2023[0].entries[3], groups2023, r16Bracket)?.label, 'خرج من دور المجموعات');

  const thirdLabels = groups2023.map(g => qualification('afc.asian.cup', g.entries[2], groups2023, r16Bracket)?.label);
  assert.equal(thirdLabels.filter(l => l === 'تأهل ضمن أفضل 4 ثوالث').length, 4);
  assert.equal(thirdLabels.filter(l => l === 'لم يتأهل ضمن أفضل الثوالث').length, 2);

  // Historical 2019 edition (24-team) & older 2015 edition (16-team: 4 groups x 4 -> top 2 to Quarterfinals)
  const groups2019 = buildAsianCupGroups(2019, 3);
  assert.equal(qualification('afc.asian.cup', groups2019[0].entries[0], groups2019, null)?.label, 'تأهل إلى دور الـ16');
  assert.equal(qualification('afc.asian.cup', groups2019[0].entries[2], groups2019, null)?.label, 'ينافس على أفضل 4 ثوالث — التأهل غير مؤكد');

  const groups2015 = Array.from({ length: 4 }, (_, g) => ({
    name: `Group ${String.fromCharCode(65 + g)}`,
    season: { year: 2015 },
    entries: Array.from({ length: 4 }, (_, r) => ({ teamId: `ac15-${g}-${r}`, rank: r + 1, played: 3 }))
  }));
  assert.equal(qualification('afc.asian.cup', groups2015[0].entries[0], groups2015, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('afc.asian.cup', groups2015[0].entries[2], groups2015, null)?.label, 'خرج من دور المجموعات');

  // Upcoming 2027 edition (played === 0): NEVER marks teams as qualified or eliminated!
  const groups2027 = buildAsianCupGroups(2027, 0);
  for (const entry of groups2027[0].entries) {
    assert.equal(qualification('afc.asian.cup', entry, groups2027, null), null);
  }

  // Cross-year fetching for 2023 edition played in 2024 & stage ordering without third-place match
  assert.deepEqual(getSeasonCalendarYears('afc.asian.cup', 2023), [2023, 2024]);
  assert.deepEqual(getSeasonCalendarYears('afc.asian.cup', 2019), [2019, 2020]);

  const asianFixtures = [
    { id: 'ac-gs', date: '2024-01-12T16:00Z', dateKey: '2024-01-12', dateTs: Date.parse('2024-01-12T16:00Z'), seasonSlug: 'group-stage' },
    { id: 'ac-r16', date: '2024-01-28T11:30Z', dateKey: '2024-01-28', dateTs: Date.parse('2024-01-28T11:30Z'), seasonSlug: 'round-of-16' },
    { id: 'ac-qf', date: '2024-02-02T11:30Z', dateKey: '2024-02-02', dateTs: Date.parse('2024-02-02T11:30Z'), seasonSlug: 'quarterfinals' },
    { id: 'ac-sf', date: '2024-02-06T15:00Z', dateKey: '2024-02-06', dateTs: Date.parse('2024-02-06T15:00Z'), seasonSlug: 'semifinals' },
    { id: 'ac-fin', date: '2024-02-10T15:00Z', dateKey: '2024-02-10', dateTs: Date.parse('2024-02-10T15:00Z'), seasonSlug: 'final' }
  ];
  const organized = organizeHistoricalMatches(asianFixtures, 'afc.asian.cup');
  assert.equal(organized.mode, 'stages');
  assert.deepEqual(organized.groups.map(g => g.id), [
    'stage-group-stage',
    'stage-r16',
    'stage-qf',
    'stage-sf',
    'stage-final'
  ]);
  assert.equal(organized.groups.some(g => g.id === 'stage-third-place'), false);

  // getTournamentKnockouts fetches [2023, 2024] for Asian Cup 2023, preserves PEN/AET, and keeps upcoming 2027 as NS
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const str = String(url);
    urls.push(str);
    if (str.includes('/summary?')) return { ok: true, json: async () => ({}) };
    if (str.includes('dates=2024')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'ac23-qf-pen',
              season: { year: 2023, slug: 'quarterfinals' },
              date: '2024-02-03T15:30Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', shootoutScore: '3', winner: true, team: { id: '4398', displayName: 'Qatar' } },
                  { homeAway: 'away', score: '1', shootoutScore: '2', winner: false, team: { id: '2918', displayName: 'Uzbekistan' } }
                ]
              }]
            },
            {
              id: 'ac23-final',
              season: { year: 2023, slug: 'final' },
              date: '2024-02-10T15:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', winner: false, team: { id: '2915', displayName: 'Jordan' } },
                  { homeAway: 'away', score: '3', winner: true, team: { id: '4398', displayName: 'Qatar' } }
                ]
              }]
            }
          ]
        })
      };
    }
    if (str.includes('dates=2027')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'ac27-r16-future',
              season: { year: 2027, slug: 'round-of-16' },
              date: '2027-01-24T15:00Z',
              status: { type: { state: 'pre', completed: false, name: 'STATUS_SCHEDULED' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '', team: { id: '655', displayName: 'Saudi Arabia' } },
                  { homeAway: 'away', score: '', team: { id: '627', displayName: 'Japan' } }
                ]
              }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const knockouts2023 = await getTournamentKnockouts('afc.asian.cup', 2023);
    assert.ok(urls.some(u => u.includes('dates=2023')));
    assert.ok(urls.some(u => u.includes('dates=2024')));
    assert.equal(knockouts2023.thirdPlace.length, 0);
    assert.equal(knockouts2023.qf.length, 1);
    assert.equal(knockouts2023.qf[0].finishType, 'penalties');
    assert.equal(knockouts2023.final.length, 1);
    assert.equal(knockouts2023.final[0].awayWinner, true);

    const knockouts2027 = await getTournamentKnockouts('afc.asian.cup', 2027);
    assert.equal(knockouts2027.r16.length, 1);
    assert.equal(knockouts2027.r16[0].status, 'NS');
    assert.equal(knockouts2027.r16[0].homeScore, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('UEFA Nations League (uefa.nations) registration, search, League A/B/C/D rules, 2018 seasontypes, season labels, two-legged QFs, and playoff exclusion from title bracket', async () => {
  const leagues = getLeagues();
  const unl = leagues.find(l => l.id === 'uefa.nations');
  assert.ok(unl, 'uefa.nations must be registered in getLeagues()');
  assert.equal(unl.name, 'دوري الأمم الأوروبية');
  assert.equal(unl.logo, 'https://a.espncdn.com/i/leaguelogos/soccer/500/2395.png');

  // Strict national-team classification (never confused with UEFA club tournaments)
  assert.equal(isTournament('uefa.nations'), true);
  assert.equal(isNationalTournament('uefa.nations'), true);
  assert.equal(isUefaClubTournament('uefa.nations'), false);

  // Search aliases in Arabic and English
  for (const query of [
    'دوري الأمم الأوروبية',
    'دوري الامم الاوروبية',
    'دوري الأمم',
    'الأمم الأوروبية',
    'UEFA Nations League',
    'Nations League',
    'UNL'
  ]) {
    const res = searchAll({ query, leagues, matches: [] });
    assert.equal(res.leagues.some(l => l.id === 'uefa.nations'), true, `search query "${query}" must match uefa.nations`);
  }

  // Season labels formatted as 2026/27, 2024/25, 2022/23, 2020/21, 2018/19 while preserving ESPN internal year IDs
  const unlSeasons = parseAvailableSeasons([
    { year: 2026, displayName: '2026-27 UEFA Nations League' },
    { year: 2024, displayName: '2024-25 UEFA Nations League' },
    { year: 2022, displayName: '2022-23 UEFA Nations League' },
    { year: 2020, displayName: '2020-21 UEFA Nations League' },
    { year: 2018, displayName: '2018-19 UEFA Nations League' }
  ], { currentSeasonYear: 2026, leagueId: 'uefa.nations' });
  assert.deepEqual(
    unlSeasons.map(s => ({ year: s.year, label: s.label })),
    [
      { year: 2026, label: '2026/27' },
      { year: 2024, label: '2024/25' },
      { year: 2022, label: '2022/23' },
      { year: 2020, label: '2020/21' },
      { year: 2018, label: '2018/19' }
    ]
  );

  // Group name parsing across 2026/2024/2022 ("Group A1"), 2020 ("GROUP C3"), and 2018 ("LEAGUE B - GROUP 2")
  assert.deepEqual(parseNationsLeagueGroup('Group A1'), {
    level: 'A',
    levelOrder: 1,
    number: 1,
    key: 'A1',
    arabicName: 'المستوى A — المجموعة 1'
  });
  assert.deepEqual(parseNationsLeagueGroup('LEAGUE D - GROUP 2'), {
    level: 'D',
    levelOrder: 4,
    number: 2,
    key: 'D2',
    arabicName: 'المستوى D — المجموعة 2'
  });

  // Helper to build all 14 modern groups (A1..A4, B1..B4, C1..C4, D1..D2)
  const buildModernUnlGroups = (year, played4 = 6, played3 = 4) => {
    const groups = [];
    for (const level of ['A', 'B', 'C']) {
      for (let g = 1; g <= 4; g += 1) {
        groups.push({
          name: `المستوى ${level} — المجموعة ${g}`,
          leagueLevel: level,
          season: { year },
          entries: Array.from({ length: 4 }, (_, r) => ({
            teamId: `${level}${g}-r${r + 1}`,
            rank: r + 1,
            played: played4,
            points: (4 - r) * 4 - (level === 'C' && r === 3 ? g : 0),
            goalsFor: 8 - r,
            goalsAgainst: 3 + r,
            win: 3 - Math.min(3, r)
          }))
        });
      }
    }
    for (let g = 1; g <= 2; g += 1) {
      groups.push({
        name: `المستوى D — المجموعة ${g}`,
        leagueLevel: 'D',
        season: { year },
        entries: Array.from({ length: 3 }, (_, r) => ({
          teamId: `D${g}-r${r + 1}`,
          rank: r + 1,
          played: played3,
          points: (3 - r) * 3
        }))
      });
    }
    return groups;
  };

  // 1. Modern completed season (2024/25):
  const modern2024 = buildModernUnlGroups(2024, 6, 4);
  const groupA1 = modern2024.find(g => g.name === 'المستوى A — المجموعة 1');
  const groupB1 = modern2024.find(g => g.name === 'المستوى B — المجموعة 1');
  const groupC1 = modern2024.find(g => g.name === 'المستوى C — المجموعة 1');
  const groupC4 = modern2024.find(g => g.name === 'المستوى C — المجموعة 4');
  const groupD1 = modern2024.find(g => g.name === 'المستوى D — المجموعة 1');

  // League A: 1st & 2nd -> Quarterfinals, 3rd -> Relegation playoff, 4th -> Relegated to B
  assert.equal(qualification('uefa.nations', groupA1.entries[0], modern2024, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('uefa.nations', groupA1.entries[1], modern2024, null)?.label, 'تأهل إلى ربع النهائي');
  assert.equal(qualification('uefa.nations', groupA1.entries[2], modern2024, null)?.label, 'ملحق البقاء / الهبوط');
  assert.equal(qualification('uefa.nations', groupA1.entries[3], modern2024, null)?.label, 'هبط إلى المستوى B');

  // League B: 1st -> Promoted to A, 2nd -> Promotion playoff to A, 3rd -> Relegation playoff, 4th -> Relegated to C
  assert.equal(qualification('uefa.nations', groupB1.entries[0], modern2024, null)?.label, 'صعد إلى المستوى A');
  assert.equal(qualification('uefa.nations', groupB1.entries[1], modern2024, null)?.label, 'ملحق الصعود إلى المستوى A');
  assert.equal(qualification('uefa.nations', groupB1.entries[2], modern2024, null)?.label, 'ملحق البقاء / الهبوط');
  assert.equal(qualification('uefa.nations', groupB1.entries[3], modern2024, null)?.label, 'هبط إلى المستوى C');

  // League C: 1st -> Promoted to B, 2nd -> Promotion playoff to B, 3rd -> null, 4th -> top 2 to Relegation playoff, bottom 2 Relegated to D
  assert.equal(qualification('uefa.nations', groupC1.entries[0], modern2024, null)?.label, 'صعد إلى المستوى B');
  assert.equal(qualification('uefa.nations', groupC1.entries[1], modern2024, null)?.label, 'ملحق الصعود إلى المستوى B');
  assert.equal(qualification('uefa.nations', groupC1.entries[2], modern2024, null), null);
  assert.equal(qualification('uefa.nations', groupC1.entries[3], modern2024, null)?.label, 'ملحق البقاء / الهبوط');
  assert.equal(qualification('uefa.nations', groupC4.entries[3], modern2024, null)?.label, 'هبط إلى المستوى D');

  // League D: 1st -> Promoted to C, 2nd -> Promotion playoff to C, 3rd -> null
  assert.equal(qualification('uefa.nations', groupD1.entries[0], modern2024, null)?.label, 'صعد إلى المستوى C');
  assert.equal(qualification('uefa.nations', groupD1.entries[1], modern2024, null)?.label, 'ملحق الصعود إلى المستوى C');
  assert.equal(qualification('uefa.nations', groupD1.entries[2], modern2024, null), null);

  // 2. Incomplete modern season (provisional labels)
  const modernLive = buildModernUnlGroups(2026, 3, 2);
  assert.equal(qualification('uefa.nations', modernLive[0].entries[0], modernLive, null)?.label, 'مركز مؤهل إلى ربع النهائي');
  assert.equal(qualification('uefa.nations', modernLive[0].entries[2], modernLive, null)?.label, 'مركز ملحق البقاء / الهبوط');
  assert.equal(qualification('uefa.nations', modernLive[0].entries[3], modernLive, null)?.label, 'مركز هبوط إلى المستوى B');
  assert.equal(qualification('uefa.nations', modernLive[4].entries[0], modernLive, null)?.label, 'مركز صعود إلى المستوى A');
  assert.equal(qualification('uefa.nations', modernLive[4].entries[1], modernLive, null)?.label, 'مركز ملحق الصعود إلى المستوى A');

  // 3. Zero-played matches (never marks anyone as qualified, promoted, or relegated)
  const unstarted = buildModernUnlGroups(2026, 0, 0);
  for (const g of unstarted) {
    for (const entry of g.entries) {
      assert.equal(qualification('uefa.nations', entry, unstarted, null), null);
    }
  }

  // 4. Historical 2022/23 season (season.year = 2022): League A 1st -> Semifinals (NO quarterfinals!), 2nd & 3rd -> null, 4th -> Relegated to B
  const hist2022 = buildModernUnlGroups(2022, 6, 4);
  const hist22A1 = hist2022[0];
  const hist22B1 = hist2022[4];
  const hist22C1 = hist2022[8];
  const hist22D1 = hist2022[12];
  assert.equal(qualification('uefa.nations', hist22A1.entries[0], hist2022, null)?.label, 'تأهل إلى نصف النهائي');
  assert.equal(qualification('uefa.nations', hist22A1.entries[1], hist2022, null), null);
  assert.equal(qualification('uefa.nations', hist22A1.entries[2], hist2022, null), null);
  assert.equal(qualification('uefa.nations', hist22A1.entries[3], hist2022, null)?.label, 'هبط إلى المستوى B');
  assert.equal(qualification('uefa.nations', hist22B1.entries[0], hist2022, null)?.label, 'صعد إلى المستوى A');
  assert.equal(qualification('uefa.nations', hist22B1.entries[1], hist2022, null), null);
  assert.equal(qualification('uefa.nations', hist22B1.entries[3], hist2022, null)?.label, 'هبط إلى المستوى C');
  assert.equal(qualification('uefa.nations', hist22C1.entries[0], hist2022, null)?.label, 'صعد إلى المستوى B');
  assert.equal(qualification('uefa.nations', hist22C1.entries[3], hist2022, null)?.label, 'ملحق البقاء / الهبوط');
  assert.equal(qualification('uefa.nations', hist22D1.entries[0], hist2022, null)?.label, 'صعد إلى المستوى C');
  assert.equal(qualification('uefa.nations', hist22D1.entries[1], hist2022, null), null);

  // 5. 2018 edition seasontype=1,2,3,4 merging, deduplication, and A -> B -> C -> D ordering in getStandings
  const originalFetch = globalThis.fetch;
  const calledUrls = [];
  globalThis.fetch = async (url) => {
    const str = String(url);
    calledUrls.push(str);
    const makeGroup = (name, teamId, teamName, gp = 4) => ({
      name,
      standings: {
        entries: [
          {
            team: { id: teamId, displayName: teamName, logo: `https://a.espncdn.com/i/teamlogos/countries/500/${teamId}.png` },
            stats: [{ name: 'rank', value: 1 }, { name: 'gamesPlayed', value: gp }, { name: 'points', value: 10 }]
          }
        ]
      }
    });
    if (str.includes('uefa.nations/standings?season=2018&seasontype=1')) {
      return { ok: true, json: async () => ({ season: { year: 2018 }, children: [makeGroup('LEAGUE A - GROUP 2', 'por', 'Portugal'), makeGroup('LEAGUE A - GROUP 1', 'ned', 'Netherlands')] }) };
    }
    if (str.includes('uefa.nations/standings?season=2018&seasontype=2')) {
      return { ok: true, json: async () => ({ season: { year: 2018 }, children: [makeGroup('LEAGUE B - GROUP 1', 'ukr', 'Ukraine')] }) };
    }
    if (str.includes('uefa.nations/standings?season=2018&seasontype=3')) {
      return { ok: true, json: async () => ({ season: { year: 2018 }, children: [makeGroup('LEAGUE C - GROUP 1', 'sco', 'Scotland')] }) };
    }
    if (str.includes('uefa.nations/standings?season=2018&seasontype=4') || str.endsWith('uefa.nations/standings?season=2018')) {
      return {
        ok: true,
        json: async () => ({
          season: { year: 2018, displayName: '2018-19 UEFA Nations League' },
          seasons: [{ year: 2018, displayName: '2018-19 UEFA Nations League' }],
          children: [makeGroup('LEAGUE D - GROUP 1', 'geo', 'Georgia', 6)]
        })
      };
    }
    if (str.includes('/summary?')) return { ok: true, json: async () => ({}) };
    if (str.includes('uefa.nations/scoreboard?dates=2025')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            // Promotion/relegation playoff match (MUST be excluded from championship bracket)
            {
              id: 'unl24-rel-po',
              season: { year: 2024, slug: 'relegation-playoffs' },
              date: '2025-03-20T19:45Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                notes: [{ text: 'Playoffs - 1st Leg' }],
                competitors: [
                  { homeAway: 'home', score: '0', winner: false, team: { id: 'arm', displayName: 'Armenia' } },
                  { homeAway: 'away', score: '3', winner: true, team: { id: 'geo', displayName: 'Georgia' } }
                ]
              }]
            },
            // Two-legged Quarterfinal tie (Netherlands vs Spain, resolved on penalties in leg 2)
            {
              id: 'unl24-qf-leg1',
              season: { year: 2024, slug: 'quarterfinals' },
              date: '2025-03-20T19:45Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '2', winner: false, team: { id: 'ned', displayName: 'Netherlands' } },
                  { homeAway: 'away', score: '2', winner: false, team: { id: 'esp', displayName: 'Spain' } }
                ]
              }]
            },
            {
              id: 'unl24-qf-leg2',
              season: { year: 2024, slug: 'quarterfinals' },
              date: '2025-03-23T19:45Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '3', shootoutScore: '5', winner: true, team: { id: 'esp', displayName: 'Spain' } },
                  { homeAway: 'away', score: '3', shootoutScore: '4', winner: false, team: { id: 'ned', displayName: 'Netherlands' } }
                ]
              }]
            },
            // Semifinal
            {
              id: 'unl24-sf1',
              season: { year: 2024, slug: 'semifinals' },
              date: '2025-06-04T19:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', winner: false, team: { id: 'ger', displayName: 'Germany' } },
                  { homeAway: 'away', score: '2', winner: true, team: { id: 'por', displayName: 'Portugal' } }
                ]
              }]
            },
            // Third-place match
            {
              id: 'unl24-3rd',
              season: { year: 2024, slug: '3rd-place-match' },
              date: '2025-06-08T13:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '0', winner: false, team: { id: 'ger', displayName: 'Germany' } },
                  { homeAway: 'away', score: '2', winner: true, team: { id: 'fra', displayName: 'France' } }
                ]
              }]
            },
            // Final (decided on penalties)
            {
              id: 'unl24-final',
              season: { year: 2024, slug: 'final' },
              date: '2025-06-08T19:00Z',
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', detail: 'FT-Pens' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '2', shootoutScore: '5', winner: true, team: { id: 'por', displayName: 'Portugal' } },
                  { homeAway: 'away', score: '2', shootoutScore: '3', winner: false, team: { id: 'esp', displayName: 'Spain' } }
                ]
              }]
            },
            // Postponed match with state='post' and '0' scores (must be POSTPONED, not FT 0-0)
            {
              id: 'unl24-postponed',
              season: { year: 2024, slug: 'semifinals' },
              date: '2025-06-05T19:00Z',
              status: { type: { state: 'post', completed: false, name: 'STATUS_POSTPONED', detail: 'Postponed' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '0', team: { id: 'esp', displayName: 'Spain' } },
                  { homeAway: 'away', score: '0', team: { id: 'fra', displayName: 'France' } }
                ]
              }]
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ events: [] }) };
  };

  try {
    const standings2018 = await getStandings('uefa.nations', { season: 2018, strict: true, forceRefresh: true });
    assert.deepEqual(
      standings2018.map(g => g.name),
      [
        'المستوى A — المجموعة 1',
        'المستوى A — المجموعة 2',
        'المستوى B — المجموعة 1',
        'المستوى C — المجموعة 1',
        'المستوى D — المجموعة 1'
      ]
    );
    assert.equal(standings2018.availableSeasons[0].label, '2018/19');

    // Cross-year historical fixtures & promotion/relegation playoff stage grouping
    assert.deepEqual(getSeasonCalendarYears('uefa.nations', 2024), [2024, 2025]);
    const unlFixtures = [
      { id: 'f-gs', date: '2024-09-05T18:45Z', dateKey: '2024-09-05', dateTs: Date.parse('2024-09-05T18:45Z'), seasonSlug: 'group-stage' },
      { id: 'f-po', date: '2025-03-20T19:45Z', dateKey: '2025-03-20', dateTs: Date.parse('2025-03-20T19:45Z'), seasonSlug: 'relegation-playoffs' },
      { id: 'f-qf', date: '2025-03-20T19:45Z', dateKey: '2025-03-20', dateTs: Date.parse('2025-03-20T19:45Z'), seasonSlug: 'quarterfinals' },
      { id: 'f-sf', date: '2025-06-04T19:00Z', dateKey: '2025-06-04', dateTs: Date.parse('2025-06-04T19:00Z'), seasonSlug: 'semifinals' },
      { id: 'f-3rd', date: '2025-06-08T13:00Z', dateKey: '2025-06-08', dateTs: Date.parse('2025-06-08T13:00Z'), seasonSlug: '3rd-place-match' },
      { id: 'f-fin', date: '2025-06-08T19:00Z', dateKey: '2025-06-08', dateTs: Date.parse('2025-06-08T19:00Z'), seasonSlug: 'final' }
    ];
    const organized = organizeHistoricalMatches(unlFixtures, 'uefa.nations');
    assert.equal(organized.mode, 'stages');
    assert.deepEqual(organized.groups.map(g => g.id), [
      'stage-group-stage',
      'stage-relegation-playoff',
      'stage-qf',
      'stage-sf',
      'stage-third-place',
      'stage-final'
    ]);
    assert.equal(organized.groups[1].label, 'ملحق الصعود والهبوط');

    // Knockout bracket excludes relegation-playoffs and aggregates two-legged quarterfinals
    const knockouts2024 = await getTournamentKnockouts('uefa.nations', 2024);
    assert.ok(calledUrls.some(u => u.includes('dates=2024')));
    assert.ok(calledUrls.some(u => u.includes('dates=2025')));
    assert.equal(knockouts2024.playoff.length, 0, 'relegation playoffs must not enter the championship bracket');
    assert.equal(knockouts2024.qf.length, 2);
    assert.equal(knockouts2024.thirdPlace.length, 1);
    assert.equal(knockouts2024.final.length, 1);
    assert.equal(knockouts2024.final[0].finishType, 'penalties');
    assert.equal(knockouts2024.final[0].homeWinner, true);

    const postponedSf = knockouts2024.sf.find(m => m.id === 'unl24-postponed');
    assert.equal(postponedSf.status, 'POSTPONED');
    assert.equal(postponedSf.homeScore, null);
    assert.equal(postponedSf.awayScore, null);

    const layout = buildBracket(knockouts2024);
    const qfNode = layout.nodes.find(n => n.round === 'qf');
    assert.equal(qfNode.match.isTwoLegged, true);
    assert.deepEqual(qfNode.match.aggregateScore, [5, 5]);
    assert.equal(qfNode.match.finishType, 'penalties');
    assert.equal(qfNode.match.awayWinner, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('competition navigation organization separates club vs national-team competitions, subcategories, search filter, and future qualifier readiness', () => {
  const leagues = getLeagues();
  assert.equal(leagues.length, 17);

  // 1. Club competitions (11 total: 8 domestic leagues + 3 UEFA continental club competitions)
  const expectedDomesticClubIds = ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ksa.1', 'egypt.1', 'usa.1'];
  const expectedContinentalClubIds = ['uefa.champions', 'uefa.europa', 'uefa.europa.conf'];
  for (const id of expectedDomesticClubIds) {
    assert.equal(isClubCompetition(id), true, `${id} must be a club competition`);
    assert.equal(isNationalTeamCompetition(id), false);
    const meta = getCompetitionClassification(id);
    assert.equal(meta.category, COMPETITION_CATEGORIES.CLUB);
    assert.equal(meta.categoryLabel, 'بطولات الأندية');
    assert.equal(meta.subCategory, 'domestic');
    assert.equal(meta.subCategoryLabel, 'الدوريات المحلية');
  }
  for (const id of expectedContinentalClubIds) {
    assert.equal(isClubCompetition(id), true, `${id} must be a club competition`);
    assert.equal(isNationalTeamCompetition(id), false);
    const meta = getCompetitionClassification(id);
    assert.equal(meta.category, COMPETITION_CATEGORIES.CLUB);
    assert.equal(meta.subCategory, 'continental_club');
    assert.equal(meta.subCategoryLabel, 'البطولات القارية للأندية');
  }

  // 2. National-team competitions (6 total: World Cup, 4 continental championships, and UEFA Nations League)
  // Crucially, uefa.euro and uefa.nations start with "uefa." but are national-team competitions, NOT club competitions.
  const expectedNationalIds = ['fifa.world', 'caf.nations', 'uefa.euro', 'uefa.nations', 'conmebol.america', 'afc.asian.cup'];
  for (const id of expectedNationalIds) {
    assert.equal(isNationalTeamCompetition(id), true, `${id} must be a national-team competition`);
    assert.equal(isClubCompetition(id), false, `${id} must NOT be classified as a club competition`);
    assert.equal(isUefaClubTournament(id), false);
    assert.equal(isInternationalQualifier(id), false);
    const meta = getCompetitionClassification(id);
    assert.equal(meta.category, COMPETITION_CATEGORIES.NATIONAL);
    assert.equal(meta.categoryLabel, 'بطولات المنتخبات');
    assert.equal(meta.nationalSection, NATIONAL_SECTIONS.TOURNAMENTS);
    assert.equal(meta.nationalSectionLabel, 'البطولات');
  }

  assert.equal(getCompetitionClassification('fifa.world').subCategory, 'world_cup');
  assert.equal(getCompetitionClassification('uefa.nations').subCategory, 'nations_league');
  assert.equal(getCompetitionClassification('uefa.euro').subCategory, 'continental_national');
  assert.equal(getCompetitionClassification('caf.nations').subCategory, 'continental_national');
  assert.equal(getCompetitionClassification('conmebol.america').subCategory, 'continental_national');
  assert.equal(getCompetitionClassification('afc.asian.cup').subCategory, 'continental_national');

  // 3. organizeCompetitions(leagues) produces exact ordered groups with zero duplicates and zero registered qualifiers
  const organized = organizeCompetitions([...leagues, leagues[0], leagues[10]]);
  const allOrganizedIds = [
    ...organized.club.competitions.map(l => l.id),
    ...organized.national.competitions.map(l => l.id)
  ];
  assert.equal(allOrganizedIds.length, 17);
  assert.equal(new Set(allOrganizedIds).size, 17, 'must never duplicate competitions');
  assert.deepEqual(
    organized.club.competitions.map(l => l.id),
    [...expectedDomesticClubIds, ...expectedContinentalClubIds]
  );
  assert.deepEqual(
    organized.club.subGroups.map(g => g.id),
    ['domestic', 'continental_club']
  );
  assert.deepEqual(
    organized.national.competitions.map(l => l.id),
    ['fifa.world', 'caf.nations', 'uefa.euro', 'conmebol.america', 'afc.asian.cup', 'uefa.nations']
  );
  assert.deepEqual(
    organized.national.subGroups.map(g => g.id),
    ['world_cup', 'continental_national', 'nations_league']
  );
  assert.equal(organized.national.sectionsByKey.tournaments.length, 6);
  assert.equal(organized.national.sectionsByKey.qualifiers.length, 0, 'no qualifiers registered yet in getLeagues()');

  // 4. Future qualifier category support (البطولات vs التصفيات) without registering qualifiers in LEAGUES
  const withFutureQualifiers = organizeCompetitions([
    ...leagues,
    { id: 'fifa.worldq.caf', name: 'تصفيات كأس العالم - أفريقيا', country: 'أفريقيا' },
    { id: 'fifa.worldq.uefa', name: 'تصفيات كأس العالم - أوروبا', country: 'أوروبا' },
    { id: 'caf.nations_qual', name: 'تصفيات كأس الأمم الإفريقية', country: 'أفريقيا' },
    { id: 'uefa.euroq', name: 'تصفيات كأس أمم أوروبا', country: 'أوروبا' }
  ]);
  assert.equal(isNationalTeamCompetition('uefa.euroq'), true);
  assert.equal(isClubCompetition('uefa.euroq'), false);
  assert.equal(isInternationalQualifier('uefa.euroq'), true);
  assert.equal(isInternationalQualifier('fifa.worldq.caf'), true);
  assert.equal(isInternationalQualifier('caf.nations_qual'), true);
  assert.deepEqual(
    withFutureQualifiers.national.sections.map(s => ({ id: s.id, label: s.label, count: s.competitions.length })),
    [
      { id: 'tournaments', label: 'البطولات', count: 6 },
      { id: 'qualifiers', label: 'التصفيات', count: 4 }
    ]
  );

  // 5. Inline competition filter and deep-link URL params remain intact
  const unlObj = organized.national.competitions.find(l => l.id === 'uefa.nations');
  const uclObj = organized.club.competitions.find(l => l.id === 'uefa.champions');
  assert.equal(matchesCompetitionFilter(unlObj, 'الأمم الأوروبية'), true);
  assert.equal(matchesCompetitionFilter(unlObj, 'UNL'), true);
  assert.equal(matchesCompetitionFilter(uclObj, 'تشامبيونز'), true);
  assert.equal(matchesCompetitionFilter(uclObj, 'كأس العالم'), false);

  const deepLinkParams = buildSeasonSearchParams('league=eng.1&season=2024', { leagueId: 'uefa.nations', leagueChanged: true });
  assert.equal(deepLinkParams.get('league'), 'uefa.nations');
  assert.equal(deepLinkParams.get('season'), null);
});

test('category switching selects default competition (eng.1 vs fifa.world), updates URL & standings, preserves direct links, and restores history', async () => {
  const leagues = getLeagues();

  // 1. Canonical defaults for Club and National categories
  assert.equal(DEFAULT_CATEGORY_LEAGUES[COMPETITION_CATEGORIES.CLUB], 'eng.1');
  assert.equal(DEFAULT_CATEGORY_LEAGUES[COMPETITION_CATEGORIES.NATIONAL], 'fifa.world');
  assert.equal(getDefaultCompetitionForCategory(COMPETITION_CATEGORIES.CLUB, leagues), 'eng.1');
  assert.equal(getDefaultCompetitionForCategory(COMPETITION_CATEGORIES.NATIONAL, leagues), 'fifa.world');

  // 2. Club -> National switches active competition to fifa.world (FIFA World Cup)
  const fromEplToNational = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.NATIONAL, 'eng.1', leagues);
  assert.deepEqual(fromEplToNational, {
    category: COMPETITION_CATEGORIES.NATIONAL,
    leagueId: 'fifa.world',
    changed: true
  });

  const fromUclToNational = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.NATIONAL, 'uefa.champions', leagues);
  assert.deepEqual(fromUclToNational, {
    category: COMPETITION_CATEGORIES.NATIONAL,
    leagueId: 'fifa.world',
    changed: true
  });

  // 3. National -> Club switches active competition to eng.1 (English Premier League)
  const fromWcToClub = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.CLUB, 'fifa.world', leagues);
  assert.deepEqual(fromWcToClub, {
    category: COMPETITION_CATEGORIES.CLUB,
    leagueId: 'eng.1',
    changed: true
  });

  const fromUnlToClub = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.CLUB, 'uefa.nations', leagues);
  assert.deepEqual(fromUnlToClub, {
    category: COMPETITION_CATEGORIES.CLUB,
    leagueId: 'eng.1',
    changed: true
  });

  // 4. Tapping the already-active category preserves the user's explicit selection (no unwanted reset)
  const stayOnUnl = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.NATIONAL, 'uefa.nations', leagues);
  assert.deepEqual(stayOnUnl, {
    category: COMPETITION_CATEGORIES.NATIONAL,
    leagueId: 'uefa.nations',
    changed: false
  });
  const stayOnUcl = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.CLUB, 'uefa.champions', leagues);
  assert.deepEqual(stayOnUcl, {
    category: COMPETITION_CATEGORIES.CLUB,
    leagueId: 'uefa.champions',
    changed: false
  });

  // 5. Direct links (/standings?league=uefa.nations & /standings?league=uefa.champions) and browser back/forward history
  const historyStack = [];
  let currentParams = new URLSearchParams('league=uefa.nations');
  historyStack.push(currentParams.toString());

  // Initial load from direct link /standings?league=uefa.nations
  let activeLeague = currentParams.get('league');
  let activeCategory = getCompetitionClassification(activeLeague).category;
  assert.equal(activeLeague, 'uefa.nations');
  assert.equal(activeCategory, COMPETITION_CATEGORIES.NATIONAL);

  // User switches category National -> Club
  const switchToClub = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.CLUB, activeLeague, leagues);
  assert.equal(switchToClub.changed, true);
  currentParams = buildSeasonSearchParams(currentParams, { leagueId: switchToClub.leagueId, leagueChanged: true });
  historyStack.push(currentParams.toString());
  activeLeague = currentParams.get('league');
  activeCategory = getCompetitionClassification(activeLeague).category;
  assert.equal(activeLeague, 'eng.1');
  assert.equal(activeCategory, COMPETITION_CATEGORIES.CLUB);

  // User manually selects UEFA Champions League
  currentParams = buildSeasonSearchParams(currentParams, { leagueId: 'uefa.champions', leagueChanged: true });
  historyStack.push(currentParams.toString());
  activeLeague = currentParams.get('league');
  activeCategory = getCompetitionClassification(activeLeague).category;
  assert.equal(activeLeague, 'uefa.champions');
  assert.equal(activeCategory, COMPETITION_CATEGORIES.CLUB);

  // User switches category Club -> National (automatically selects fifa.world)
  const switchToNational = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.NATIONAL, activeLeague, leagues);
  assert.equal(switchToNational.changed, true);
  currentParams = buildSeasonSearchParams(currentParams, { leagueId: switchToNational.leagueId, leagueChanged: true });
  historyStack.push(currentParams.toString());
  activeLeague = currentParams.get('league');
  activeCategory = getCompetitionClassification(activeLeague).category;
  assert.equal(activeLeague, 'fifa.world');
  assert.equal(activeCategory, COMPETITION_CATEGORIES.NATIONAL);

  // Browser Back button restoration: fifa.world -> uefa.champions -> eng.1 -> uefa.nations
  const poppedUcl = new URLSearchParams(historyStack[2]);
  assert.equal(poppedUcl.get('league'), 'uefa.champions');
  assert.equal(getCompetitionClassification(poppedUcl.get('league')).category, COMPETITION_CATEGORIES.CLUB);

  const poppedEpl = new URLSearchParams(historyStack[1]);
  assert.equal(poppedEpl.get('league'), 'eng.1');
  assert.equal(getCompetitionClassification(poppedEpl.get('league')).category, COMPETITION_CATEGORIES.CLUB);

  const poppedUnl = new URLSearchParams(historyStack[0]);
  assert.equal(poppedUnl.get('league'), 'uefa.nations');
  assert.equal(getCompetitionClassification(poppedUnl.get('league')).category, COMPETITION_CATEGORIES.NATIONAL);

  // 6. Standings controller loads new competition standings immediately upon category switch without stale cross-league data
  const loadedLeagues = [];
  const controller = createStandingsController({
    fetcher: async (id) => {
      loadedLeagues.push(id);
      return [{ name: id, season: { year: 2026 }, entries: [{ teamId: id + '-1', rank: 1, team: id.toUpperCase(), points: 12 }] }];
    }
  });

  await controller.load('eng.1');
  assert.equal(controller.getState().leagueId, 'eng.1');
  assert.equal(controller.getState().standings[0].entries[0].team, 'ENG.1');

  const nextNational = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.NATIONAL, controller.getState().leagueId, leagues);
  await controller.load(nextNational.leagueId);
  assert.equal(controller.getState().leagueId, 'fifa.world');
  assert.equal(controller.getState().standings[0].entries[0].team, 'FIFA.WORLD');

  const nextClub = resolveCategorySwitchSelection(COMPETITION_CATEGORIES.CLUB, controller.getState().leagueId, leagues);
  await controller.load(nextClub.leagueId);
  assert.equal(controller.getState().leagueId, 'eng.1');
  assert.equal(controller.getState().standings[0].entries[0].team, 'ENG.1');
  assert.deepEqual(loadedLeagues, ['eng.1', 'fifa.world', 'eng.1']);
  controller.dispose();
});
