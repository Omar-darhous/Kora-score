import test from 'node:test';
import assert from 'node:assert/strict';
import { isTournament, classifyRound, qualification } from '../src/services/tournamentRules.js';
import { getTournamentKnockouts, getLeagues, resolveLeagueLogo, resolveTeamLogo, DEFAULT_TEAM_LOGO } from '../src/services/footballService.js';
import { getQuickSuggestions, searchAll } from '../src/services/searchService.js';
import { getSeasonCalendarYears } from '../src/services/historicalMatchesService.js';
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
