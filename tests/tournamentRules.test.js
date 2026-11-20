import test from 'node:test';
import assert from 'node:assert/strict';
import { isTournament, isNationalTournament, isUefaClubTournament, classifyRound, qualification } from '../src/services/tournamentRules.js';
import { getTournamentKnockouts, getLeagues, resolveLeagueLogo, resolveTeamLogo, DEFAULT_TEAM_LOGO } from '../src/services/footballService.js';
import { getQuickSuggestions, searchAll } from '../src/services/searchService.js';
import { getSeasonCalendarYears, organizeHistoricalMatches } from '../src/services/historicalMatchesService.js';
import { parseAvailableSeasons } from '../src/services/standingsService.js';
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
    'conmebol.america': '83',
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
