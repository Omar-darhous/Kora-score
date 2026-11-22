import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mapKnockoutStage,
  translateRoundText,
  parseRoundFromText,
  resolveMatchRound,
  extractReliableRoundNumber,
  isValidLeagueRoundNumber,
  getMaxLeagueMatchweeks,
  normalizeScoreboardMatches,
  parseEventClock,
  compareMatchEvents,
  classifyMatchEvent,
  resolveMatchTeamIds,
  normalizeMatchEvents,
  normalizeMatchRosters,
  getMatchDetails
} from '../src/services/matchesService.js';
import {
  getMatches,
  subscribeToLiveMatches
} from '../src/services/liveMatchesService.js';
import { getFavoriteMatchDisplay } from '../src/services/matchResult.js';
import * as footballService from '../src/services/footballService.js';

const withMockFetch = async (mockImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const makeScoreboardResponse = (events = [], leagueMeta = {}) => ({
  ok: true,
  json: async () => ({
    leagues: [{
      logos: [{ href: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png' }],
      calendar: ['2026-11-19T00:00Z'],
      ...leagueMeta
    }],
    events
  })
});

test('normalizes ESPN matches across NS, LIVE, FT, AET, PEN and preserves upcoming VS display', () => {
  assert.equal(translateRoundText('Matchday 12'), 'الجولة 12');
  assert.equal(translateRoundText('Week 5'), 'الأسبوع 5');
  assert.equal(mapKnockoutStage('semifinals'), 'نصف النهائي');
  assert.equal(mapKnockoutStage('group-stage'), 'مرحلة المجموعات / الدوري');

  const league = { id: 'eng.1', name: 'الدوري الإنجليزي الممتاز', logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png' };
  const normalized = normalizeScoreboardMatches({
    leagues: [{ calendar: [{ date: '2026-11-19T00:00Z', label: 'Matchday 12' }] }],
    events: [
      {
        id: 'm-ns',
        date: '2026-11-19T20:00:00Z',
        status: { type: { state: 'pre' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '0', team: { id: '364', displayName: 'Liverpool' } },
            { homeAway: 'away', score: '0', team: { id: '359', displayName: 'Arsenal' } }
          ]
        }]
      },
      {
        id: 'm-aet',
        date: '2026-11-19T17:00:00Z',
        status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_AET', shortDetail: 'AET' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '2', winner: true, team: { id: '86', displayName: 'Real Madrid' } },
            { homeAway: 'away', score: '1', winner: false, team: { id: '83', displayName: 'Barcelona' } }
          ]
        }]
      },
      {
        id: 'm-pen',
        date: '2026-11-19T16:00:00Z',
        status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', shortDetail: 'FT-Pens' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '1', shootoutScore: '5', winner: true, team: { id: '1', displayName: 'Team A' } },
            { homeAway: 'away', score: '1', shootoutScore: '4', winner: false, team: { id: '2', displayName: 'Team B' } }
          ]
        }]
      }
    ]
  }, league, '20261119');

  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].status, 'NS');
  assert.equal(normalized[0].roundName, 'الجولة 12');

  const favDisplay = getFavoriteMatchDisplay(normalized[0]);
  assert.equal(favDisplay.isUpcoming, true);
  assert.equal(favDisplay.centerText, 'VS');

  assert.equal(normalized[1].status, 'FT');
  assert.equal(normalized[1].finishType, 'extra-time');

  assert.equal(normalized[2].status, 'FT');
  assert.equal(normalized[2].finishType, 'penalties');
  assert.equal(normalized[2].homePenalties, 5);
  assert.equal(normalized[2].awayPenalties, 4);
});

test('getMatchDetails handles both Egyptian mock matches and ESPN summary payloads', async () => {
  const egy = await getMatchDetails('egypt.1', 'egy-match-1');
  assert.equal(egy.events.length, 5);
  assert.equal(egy.lineups.home.length, 11);

  const espn = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      boxscore: {
        teams: [
          { team: { id: '364' }, statistics: [{ name: 'possessionPct', displayValue: '61' }, { name: 'totalShots', displayValue: '15' }] },
          { team: { id: '359' }, statistics: [{ name: 'possessionPct', displayValue: '39' }, { name: 'totalShots', displayValue: '7' }] }
        ]
      },
      keyEvents: [
        { type: { text: 'Goal' }, clock: { displayValue: "45'" }, team: { id: '364' }, text: 'Mohamed Salah' }
      ],
      rosters: {
        '0': { team: { id: '364' }, roster: [{ starter: true, athlete: { displayName: 'Alisson' } }] },
        '1': { team: { id: '359' }, roster: [{ starter: true, athlete: { displayName: 'Raya' } }] }
      },
      header: {
        competitions: [{
          status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
          competitors: [
            { homeAway: 'home', score: '1', winner: true, team: { id: '364', displayName: 'Liverpool' } },
            { homeAway: 'away', score: '0', winner: false, team: { id: '359', displayName: 'Arsenal' } }
          ]
        }]
      }
    })
  }), () => getMatchDetails('eng.1', '999001'));

  assert.deepEqual(espn.stats.possession, [61, 39]);
  assert.equal(espn.events.length, 1);
  assert.equal(espn.events[0].team, 'home');
  assert.deepEqual(espn.lineups.home, ['Alisson']);
  assert.deepEqual(espn.lineups.away, ['Raya']);
  assert.equal(espn.match.homeScore, 1);
});

test('getMatches includes Egyptian mock matches on 20260529, retains snapshots on partial failure, and supports AbortController', async () => {
  let failEng = false;
  let partialCalled = 0;

  await withMockFetch(async (url) => {
    const str = String(url);
    if (str.includes('/eng.1/')) {
      if (failEng) return { ok: false, status: 503, json: async () => ({}) };
      return makeScoreboardResponse([{
        id: 'eng-live-1',
        date: '2026-05-29T18:00:00Z',
        status: { type: { state: 'in' }, displayClock: "60'" },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: '2', team: { id: '364', displayName: 'Liverpool' } },
            { homeAway: 'away', score: '0', team: { id: '359', displayName: 'Arsenal' } }
          ]
        }]
      }]);
    }
    return makeScoreboardResponse([]);
  }, async () => {
    const initial = await getMatches('20260529', { strict: true, forceRefresh: true });
    assert.equal(initial.some(m => m.id === 'egy-match-1'), true);
    assert.equal(initial.some(m => m.id === 'eng-live-1'), true);

    // Partial failure on eng.1 preserves snapshot for eng.1 and triggers onPartial
    failEng = true;
    const afterPartial = await getMatches('20260529', {
      strict: true,
      forceRefresh: true,
      onPartial: () => { partialCalled += 1; }
    });
    assert.equal(partialCalled, 1);
    assert.equal(afterPartial.some(m => m.id === 'eng-live-1'), true);
  });

  // AbortController cancels cleanly without poisoning snapshots
  const abortController = new AbortController();
  await withMockFetch((_url, { signal }) => new Promise((_res, rej) => {
    signal.addEventListener('abort', () => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      rej(err);
    }, { once: true });
  }), async () => {
    const pending = getMatches('20261201', { strict: true, forceRefresh: true, signal: abortController.signal });
    abortController.abort();
    await assert.rejects(() => pending, (err) => err?.name === 'AbortError');
  });
});

test('subscribeToLiveMatches deduplicates duplicate subscribers, notifies on changes, and cleans up timer', async () => {
  let pollFn = null;
  let cleared = false;
  let score = 0;

  await withMockFetch(async (url) => {
    if (String(url).includes('/eng.1/')) {
      return makeScoreboardResponse([{
        id: 'live-sub-1',
        date: '2026-12-02T19:00:00Z',
        status: { type: { state: 'in' }, displayClock: "30'" },
        competitions: [{
          competitors: [
            { homeAway: 'home', score: String(score), team: { id: '364', displayName: 'Liverpool' } },
            { homeAway: 'away', score: '0', team: { id: '359', displayName: 'Arsenal' } }
          ]
        }]
      }]);
    }
    return makeScoreboardResponse([]);
  }, async () => {
    const received = [];
    const callback = (matches) => received.push(matches.find(m => m.id === 'live-sub-1')?.homeScore);

    // Register same callback twice -> must only be notified once per poll
    const unsub1 = subscribeToLiveMatches(callback, {
      dateStr: '20261202',
      setIntervalFn: (fn) => { pollFn = fn; return 99; },
      clearIntervalFn: () => { cleared = true; }
    });
    const unsub2 = subscribeToLiveMatches(callback, {
      dateStr: '20261202',
      setIntervalFn: () => 100,
      clearIntervalFn: () => { cleared = true; }
    });

    await pollFn();
    assert.deepEqual(received, [0]);

    // Same score -> no duplicate notification
    await pollFn();
    assert.deepEqual(received, [0]);

    // Score changes -> notified once
    score = 1;
    await pollFn();
    assert.deepEqual(received, [0, 1]);

    unsub1();
    unsub2();
    assert.equal(cleared, true);
  });
});

test('footballService facade preserves ALL 19 public exports with exact function identity', () => {
  const expectedExports = [
    'DEFAULT_TEAM_LOGO',
    'createArticleImageResolver',
    'createStandingsController',
    'enrichNewsImages',
    'extractArticleMetaImage',
    'getLeagues',
    'getMatchDetails',
    'getMatches',
    'getNews',
    'getStandings',
    'getTeamDetails',
    'getTeamRoster',
    'getTeamSchedule',
    'getTournamentKnockouts',
    'isTrustedDwArticleUrl',
    'isTrustedDwImageUrl',
    'resolveLeagueLogo',
    'resolveTeamLogo',
    'subscribeToLiveMatches'
  ];

  assert.deepEqual(Object.keys(footballService).sort(), expectedExports);
  assert.equal(footballService.getMatchDetails, getMatchDetails);
  assert.equal(footballService.getMatches, getMatches);
  assert.equal(footballService.subscribeToLiveMatches, subscribeToLiveMatches);
});

test('matchweek resolver rejects fabricated calendar date indices (La Liga 54, Serie A 39), validates per-league round limits, and preserves live cards & knockouts', () => {
  // 1. Reproduced bug payloads: La Liga (Barcelona vs Villarreal, 54th calendar date) & Serie A (Juventus vs Venezia, 39th calendar date)
  const laLigaCalendar = Array.from({ length: 88 }, (_, i) =>
    i === 53 ? '2026-11-22T08:00Z' : `2026-08-${String((i % 28) + 1).padStart(2, '0')}T08:00Z`
  );
  const serieACalendar = Array.from({ length: 82 }, (_, i) =>
    i === 38 ? '2026-11-22T08:00Z' : `2026-08-${String((i % 28) + 1).padStart(2, '0')}T08:00Z`
  );

  const laLigaNormalized = normalizeScoreboardMatches({
    leagues: [{ calendar: laLigaCalendar }],
    events: [{
      id: '401882804',
      date: '2026-11-22T15:15:00Z',
      season: { year: 2026, type: 14357, slug: '2026-27-laliga' },
      status: { type: { state: 'in' }, displayClock: "70'" },
      competitions: [{
        altGameNote: 'LALIGA',
        notes: [],
        competitors: [
          { homeAway: 'home', score: '1', team: { id: '83', displayName: 'Barcelona' } },
          { homeAway: 'away', score: '1', team: { id: '102', displayName: 'Villarreal' } }
        ]
      }]
    }]
  }, { id: 'esp.1', name: 'الدوري الإسباني', logo: '' }, '20261122');

  assert.equal(laLigaNormalized[0].status, 'LIVE');
  assert.equal(laLigaNormalized[0].minute, '70');
  assert.equal(laLigaNormalized[0].homeScore, 1);
  assert.equal(laLigaNormalized[0].awayScore, 1);
  assert.equal(laLigaNormalized[0].roundNumber, null, 'must never fabricate round 54 from calendar array index');
  assert.equal(laLigaNormalized[0].roundName, null, 'must omit round label when ESPN provides no valid matchweek');

  const serieANormalized = normalizeScoreboardMatches({
    leagues: [{ calendar: serieACalendar }],
    events: [{
      id: '401875008',
      date: '2026-11-22T14:00:00Z',
      season: { year: 2026, type: 14240, slug: '2026-27-italian-serie-a' },
      status: { type: { state: 'in' }, displayClock: "90'+6'" },
      competitions: [{
        altGameNote: 'Serie A',
        notes: [],
        competitors: [
          { homeAway: 'home', score: '3', team: { id: '111', displayName: 'Juventus' } },
          { homeAway: 'away', score: '1', team: { id: '3486', displayName: 'Venezia' } }
        ]
      }]
    }]
  }, { id: 'ita.1', name: 'الدوري الإيطالي', logo: '' }, '20261122');

  assert.equal(serieANormalized[0].status, 'LIVE');
  assert.equal(serieANormalized[0].minute, '90+6');
  assert.equal(serieANormalized[0].homeScore, 3);
  assert.equal(serieANormalized[0].awayScore, 1);
  assert.equal(serieANormalized[0].roundNumber, null, 'must never fabricate round 39 from calendar array index');
  assert.equal(serieANormalized[0].roundName, null);

  // 2. Reject explicit out-of-range round numbers (e.g. 54 in La Liga, 39 in Serie A, 0, negative, or 35 in 34-round Bundesliga)
  assert.equal(isValidLeagueRoundNumber(54, { leagueId: 'esp.1' }), false);
  assert.equal(isValidLeagueRoundNumber(39, { leagueId: 'ita.1' }), false);
  assert.equal(isValidLeagueRoundNumber(39, { leagueId: 'eng.1' }), false);
  assert.equal(isValidLeagueRoundNumber(0, { leagueId: 'esp.1' }), false);
  assert.equal(isValidLeagueRoundNumber(-3, { leagueId: 'esp.1' }), false);
  assert.equal(translateRoundText('Matchday 54', { leagueId: 'esp.1' }), '');
  assert.equal(translateRoundText('Giornata 39', { leagueId: 'ita.1' }), '');
  assert.deepEqual(
    resolveMatchRound({ week: { number: 54 }, competitions: [{}] }, { leagueId: 'esp.1' }),
    { roundNumber: null, roundName: null }
  );
  assert.deepEqual(
    resolveMatchRound({ week: { number: 39 }, competitions: [{}] }, { leagueId: 'ita.1' }),
    { roundNumber: null, roundName: null }
  );

  // 3. Valid league rounds 1–38 in 20-team leagues, 1–34 in 18-team leagues (Bundesliga & Saudi Pro League), and 1–46 in 24-team leagues
  for (const validRound of [1, 13, 14, 38]) {
    assert.equal(isValidLeagueRoundNumber(validRound, { leagueId: 'esp.1' }), true);
    assert.equal(isValidLeagueRoundNumber(validRound, { leagueId: 'ita.1' }), true);
    assert.equal(isValidLeagueRoundNumber(validRound, { leagueId: 'eng.1' }), true);
    const resolved = resolveMatchRound({ week: { number: validRound }, competitions: [{}] }, { leagueId: 'esp.1' });
    assert.deepEqual(resolved, { roundNumber: validRound, roundName: `الجولة ${validRound}` });
  }
  assert.equal(getMaxLeagueMatchweeks('ger.1'), 34);
  assert.equal(getMaxLeagueMatchweeks('ksa.1'), 34);
  assert.equal(isValidLeagueRoundNumber(34, { leagueId: 'ger.1' }), true);
  assert.equal(isValidLeagueRoundNumber(35, { leagueId: 'ger.1' }), false);
  assert.equal(isValidLeagueRoundNumber(34, { leagueId: 'ksa.1' }), true);
  assert.equal(isValidLeagueRoundNumber(35, { leagueId: 'ksa.1' }), false);
  assert.equal(isValidLeagueRoundNumber(46, { leagueId: 'eng.2', maxRounds: 46 }), true);
  assert.equal(isValidLeagueRoundNumber(47, { leagueId: 'eng.2', maxRounds: 46 }), false);

  // 4. Unrelated ESPN round/stage type identifiers (e.g. season.type = 14357, round = { type: 14357, name: '2026-27 LALIGA' }, Round of 16)
  assert.deepEqual(
    resolveMatchRound({
      season: { year: 2026, type: 14357, slug: '2026-27-laliga' },
      round: { id: '1', type: 14357, number: 14357, name: '2026-27 LALIGA' },
      competitions: [{ altGameNote: 'LALIGA', notes: [{ text: 'Spotify Camp Nou' }] }]
    }, { leagueId: 'esp.1' }),
    { roundNumber: null, roundName: null }
  );
  assert.equal(parseRoundFromText('Round of 16', { leagueId: 'uefa.champions' }), null);
  assert.equal(translateRoundText('Round of 16'), 'دور الـ 16');

  // 5. Postponed and rescheduled fixtures
  // Postponed fixture WITH its own verified Matchday 10 retains الجولة 10 despite calendar saying Matchday 15
  assert.deepEqual(
    resolveMatchRound({
      week: { number: 10 },
      competitions: [{ notes: [{ text: 'Postponed from October' }] }]
    }, { leagueId: 'esp.1', calendarLabel: 'Matchday 15', statusStr: 'POSTPONED' }),
    { roundNumber: 10, roundName: 'الجولة 10' }
  );
  // Postponed fixture WITHOUT event-level round does NOT inherit the current calendar date's Matchday 15
  assert.deepEqual(
    resolveMatchRound({
      competitions: [{ notes: [{ text: 'Match Postponed' }] }]
    }, { leagueId: 'esp.1', calendarLabel: 'Matchday 15', statusStr: 'POSTPONED' }),
    { roundNumber: null, roundName: null }
  );

  // 6. Cups and knockout competitions preserve Arabic stage names and return null for numeric roundNumber
  assert.deepEqual(
    resolveMatchRound({ season: { slug: 'quarterfinals' }, competitions: [{}] }, { leagueId: 'uefa.nations' }),
    { roundNumber: null, roundName: 'ربع النهائي' }
  );
  assert.deepEqual(
    resolveMatchRound({ season: { slug: 'relegation-playoffs' }, competitions: [{}] }, { leagueId: 'uefa.nations' }),
    { roundNumber: null, roundName: 'ملحق الصعود والهبوط' }
  );
  assert.deepEqual(
    resolveMatchRound({ season: { slug: 'league-phase' }, competitions: [{}] }, { leagueId: 'uefa.champions' }),
    { roundNumber: null, roundName: 'مرحلة المجموعات / الدوري' }
  );
  assert.equal(extractReliableRoundNumber({ season: { slug: 'semifinals' }, week: { number: 2 }, competitions: [{}] }, { leagueId: 'uefa.champions' }), null);
});

test('match details normalization extracts real jersey numbers, substitutes, appearance minutes, and canonical home/away mapping even when boxscore/rosters are reversed', async () => {
  // Reversed boxscore & array rosters (away team Villarreal ID 102 listed first, home team Barcelona ID 83 listed second)
  const summaryPayload = {
    header: {
      competitions: [{
        status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
        competitors: [
          { homeAway: 'home', score: '2', winner: false, team: { id: '83', displayName: 'Barcelona' } },
          { homeAway: 'away', score: '2', winner: false, team: { id: '102', displayName: 'Villarreal' } }
        ]
      }]
    },
    boxscore: {
      teams: [
        {
          homeAway: 'away',
          team: { id: '102', displayName: 'Villarreal' },
          statistics: [{ name: 'possessionPct', displayValue: '36' }, { name: 'totalShots', displayValue: '9' }]
        },
        {
          homeAway: 'home',
          team: { id: '83', displayName: 'Barcelona' },
          statistics: [{ name: 'possessionPct', displayValue: '64' }, { name: 'totalShots', displayValue: '18' }]
        }
      ]
    },
    rosters: [
      {
        homeAway: 'away',
        formation: '4-4-2',
        team: { id: '102', displayName: 'Villarreal' },
        roster: [
          {
            starter: true,
            jersey: '1',
            formationPlace: '1',
            position: { name: 'Goalkeeper', abbreviation: 'G' },
            athlete: { id: '2001', displayName: 'Luiz Junior' }
          },
          {
            starter: true,
            jersey: '17',
            formationPlace: '9',
            subbedOut: true,
            plays: [{ clock: { displayValue: "74'" }, substitution: true }],
            position: { name: 'Forward', abbreviation: 'F' },
            athlete: { id: '2002', displayName: 'Ayoze Perez' }
          },
          {
            starter: false,
            jersey: '22',
            subbedIn: true,
            plays: [{ clock: { displayValue: "74'" }, substitution: true }],
            position: { name: 'Substitute', abbreviation: 'SUB' },
            athlete: { id: '2003', displayName: 'Gerard Moreno' }
          },
          {
            starter: false,
            jersey: null,
            subbedIn: false,
            position: { name: 'Substitute', abbreviation: 'SUB' },
            athlete: { id: '2004', displayName: 'Unused Villarreal Sub' }
          }
        ]
      },
      {
        homeAway: 'home',
        formation: '4-3-3',
        team: { id: '83', displayName: 'Barcelona' },
        roster: [
          {
            starter: true,
            jersey: '13',
            formationPlace: '1',
            position: { name: 'Goalkeeper', abbreviation: 'G' },
            athlete: { id: '3001', displayName: 'Joan Garcia' }
          },
          {
            starter: true,
            jersey: '19',
            formationPlace: '7',
            position: { name: 'Right Winger', abbreviation: 'RW' },
            athlete: { id: '362150', displayName: 'Lamine Yamal' }
          },
          {
            starter: true,
            jersey: '8',
            formationPlace: '8',
            subbedOut: true,
            position: { name: 'Central Midfielder', abbreviation: 'CM' },
            athlete: { id: '3003', displayName: 'Pedri' }
          },
          {
            starter: false,
            jersey: '16',
            subbedIn: false,
            position: { name: 'Substitute', abbreviation: 'SUB' },
            athlete: { id: '3004', displayName: 'Fermin Lopez' }
          },
          {
            starter: false,
            jersey: '32',
            subbedIn: false,
            position: { name: 'Substitute', abbreviation: 'SUB' },
            athlete: { id: '3005', displayName: 'Hector Fort' }
          }
        ]
      }
    ],
    keyEvents: [
      {
        id: 'ev-sub-home',
        type: { id: '76', text: 'Substitution' },
        clock: { displayValue: "68'" },
        period: { number: 2 },
        team: { id: '83' },
        participants: [
          { athlete: { id: '3004', displayName: 'Fermin Lopez' } },
          { athlete: { id: '3003', displayName: 'Pedri' } }
        ]
      },
      {
        id: 'ev-pen-missed',
        type: { id: '113', text: 'Penalty - Missed' },
        clock: { value: 1359, displayValue: "23'" },
        period: { number: 1 },
        scoringPlay: false,
        team: { id: '83', displayName: 'Barcelona' },
        shortText: 'Lamine Yamal Penalty - Missed',
        text: 'Penalty missed! Still Barcelona 0, Villarreal 2. Lamine Yamal (Barcelona) hits the right post with a left footed shot.',
        participants: [{ athlete: { id: '362150', displayName: 'Lamine Yamal' } }]
      },
      {
        id: 'ev-sub-away',
        type: { id: '76', text: 'Substitution' },
        clock: { displayValue: "74'" },
        period: { number: 2 },
        team: { id: '102' },
        participants: [
          { athlete: { id: '2003', displayName: 'Gerard Moreno' } },
          { athlete: { id: '2002', displayName: 'Ayoze Perez' } }
        ]
      }
    ],
    commentary: [
      {
        time: "20'",
        text: 'VAR Decision: Penalty Barcelona.',
        play: {
          id: 'var-55534080',
          clock: { displayValue: "20'" },
          period: { number: 1 },
          type: { id: '172', text: 'VAR - Referee decision cancelled' }
        }
      }
    ]
  };

  const details = await withMockFetch(async () => ({
    ok: true,
    json: async () => summaryPayload
  }), () => getMatchDetails('esp.1', '401882804'));

  // 1. Canonical home/away stats mapping despite reversed boxscore.teams
  assert.deepEqual(details.stats.possession, [64, 36]);
  assert.deepEqual(details.stats.shots, [18, 9]);

  // 2. Canonical home/away rosters mapping & real jersey numbers (never 1..11, formationPlace, or athlete.id)
  assert.equal(details.rosters.home.teamId, '83');
  assert.equal(details.rosters.home.formation, '4-3-3');
  assert.deepEqual(details.rosters.home.starters.map(p => [p.name, p.jersey]), [
    ['Joan Garcia', '13'],
    ['Lamine Yamal', '19'],
    ['Pedri', '8']
  ]);
  assert.equal(details.rosters.home.starters[0].position, 'حارس مرمى');
  assert.equal(details.rosters.home.starters[1].position, 'جناح أيمن');

  assert.equal(details.rosters.away.teamId, '102');
  assert.equal(details.rosters.away.formation, '4-4-2');
  assert.deepEqual(details.rosters.away.starters.map(p => [p.name, p.jersey]), [
    ['Luiz Junior', '1'],
    ['Ayoze Perez', '17']
  ]);

  // 3. Substitutes separated cleanly, generic "Substitute" position omitted, missing jersey stays null
  assert.deepEqual(details.rosters.home.substitutes.map(p => [p.name, p.jersey]), [
    ['Fermin Lopez', '16'],
    ['Hector Fort', '32']
  ]);
  assert.equal(details.rosters.home.substitutes[0].position, '');
  assert.equal(details.rosters.away.substitutes[1].jersey, null, 'missing jersey must remain null, never synthetic index');

  // 4. Substitution appearance tracking (from plays AND cross-referenced from SUBSTITUTION events)
  assert.equal(details.rosters.home.starters[2].subbedOut, true);
  assert.equal(details.rosters.home.starters[2].subOutMinute, '68');
  assert.equal(details.rosters.home.substitutes[0].subbedIn, true);
  assert.equal(details.rosters.home.substitutes[0].subInMinute, '68');
  assert.equal(details.rosters.home.substitutes[1].subbedIn, false);
  assert.equal(details.rosters.home.substitutes[1].subInMinute, null);
  assert.equal(details.rosters.away.starters[1].subOutMinute, '74');
  assert.equal(details.rosters.away.substitutes[0].subInMinute, '74');

  // 5. Barcelona missed penalty & VAR decision captured accurately in chronological order
  assert.deepEqual(details.events.map(e => [e.time, e.eventType, e.team]), [
    ['20', 'VAR_DECISION', null],
    ['23', 'PENALTY_MISSED', 'home'],
    ['68', 'SUBSTITUTION', 'home'],
    ['74', 'SUBSTITUTION', 'away']
  ]);

  const missedPenalty = details.events[1];
  assert.equal(missedPenalty.type, 'penalty_missed', 'missed penalty must NEVER be classified as a goal');
  assert.equal(missedPenalty.label, 'ركلة جزاء ضائعة');
  assert.equal(missedPenalty.player, 'Lamine Yamal');
  assert.equal(details.events[0].detail, 'احتساب ركلة جزاء بعد مراجعة VAR');

  // 6. Backward-compatible lineups.home/away string arrays preserved
  assert.deepEqual(details.lineups.home, ['Joan Garcia', 'Lamine Yamal', 'Pedri']);
  assert.deepEqual(details.lineups.away, ['Luiz Junior', 'Ayoze Perez']);
});

test('match event classification, stoppage-time chronological sorting, unavailable substitutes, and UI guardrails work deterministically', () => {
  // 1. Parse clocks including stoppage time and seconds fallback
  assert.deepEqual(parseEventClock({ displayValue: "45'+2'" }), { time: '45+2', minute: 45, addedTime: 2 });
  assert.deepEqual(parseEventClock({ displayValue: "90'+5'" }), { time: '90+5', minute: 90, addedTime: 5 });
  assert.deepEqual(parseEventClock({ value: 1359 }), { time: '23', minute: 23, addedTime: 0 });
  assert.deepEqual(parseEventClock(null), { time: '', minute: null, addedTime: 0 });

  // 2. All 10 meaningful event types + ignored status entries + disallowed VAR goal guard
  assert.equal(classifyMatchEvent({ type: { text: 'Kickoff' } }), null);
  assert.equal(classifyMatchEvent({ type: { text: 'Halftime' } }), null);
  assert.equal(classifyMatchEvent({ type: { text: 'End Regular Time' } }), null);

  assert.equal(classifyMatchEvent({ type: { id: '70', text: 'Goal' }, scoringPlay: true }).eventType, 'GOAL');
  assert.equal(classifyMatchEvent({ type: { id: '98', text: 'Penalty - Scored' }, scoringPlay: true }).eventType, 'PENALTY_GOAL');
  assert.equal(classifyMatchEvent({ type: { id: '97', text: 'Own Goal' }, ownGoal: true, scoringPlay: true }).eventType, 'OWN_GOAL');
  assert.equal(classifyMatchEvent({ type: { id: '113', text: 'Penalty - Missed' }, scoringPlay: false }).eventType, 'PENALTY_MISSED');
  assert.equal(classifyMatchEvent({ type: { id: '112', text: 'Penalty - Saved' }, scoringPlay: false }).eventType, 'PENALTY_SAVED');
  assert.equal(classifyMatchEvent({ type: { id: '94', text: 'Yellow Card' } }).eventType, 'YELLOW_CARD');
  assert.equal(classifyMatchEvent({ type: { id: '95', text: 'Second Yellow Card' } }).eventType, 'SECOND_YELLOW_RED');
  assert.equal(classifyMatchEvent({ type: { id: '93', text: 'Red Card' } }).eventType, 'RED_CARD');
  assert.equal(classifyMatchEvent({ type: { id: '76', text: 'Substitution' } }).eventType, 'SUBSTITUTION');

  const disallowedVar = classifyMatchEvent({
    type: { text: 'VAR - Goal Disallowed' },
    text: 'VAR Decision: No Goal. Offside.'
  });
  assert.equal(disallowedVar.eventType, 'VAR_DECISION');
  assert.equal(disallowedVar.type, 'var', 'disallowed VAR goal must NEVER be classified as goal');
  assert.equal(disallowedVar.detail, 'إلغاء هدف بعد مراجعة VAR');

  // 3. Full unsorted timeline with stoppage time, cards, own goal, saved penalty, neutral event, and missing team ID
  const events = normalizeMatchEvents({
    keyEvents: [
      { id: 'e6', type: { id: '93', text: 'Red Card' }, clock: { displayValue: "90'+5'" }, period: { number: 2 }, team: { id: '20' }, participants: [{ athlete: { displayName: 'Away Defender' } }] },
      { id: 'e3', type: { id: '98', text: 'Penalty - Scored' }, scoringPlay: true, clock: { displayValue: "45'+2'" }, period: { number: 1 }, team: { id: '10' }, participants: [{ athlete: { displayName: 'Home Striker' } }] },
      { id: 'e4', type: { id: '95', text: 'Second Yellow Card' }, clock: { displayValue: "46'" }, period: { number: 2 }, team: { id: '20' }, participants: [{ athlete: { displayName: 'Away Midfielder' } }] },
      { id: 'e1', type: { id: '70', text: 'Goal' }, scoringPlay: true, clock: { displayValue: "12'" }, period: { number: 1 }, team: { id: '10' }, participants: [{ athlete: { displayName: 'Scorer One' } }, { athlete: { displayName: 'Assister One' } }] },
      { id: 'e2', type: { id: '112', text: 'Penalty - Saved' }, scoringPlay: false, clock: { displayValue: "45'" }, period: { number: 1 }, team: { id: '20' }, participants: [{ athlete: { displayName: 'Away Taker' } }] },
      { id: 'e5', type: { id: '97', text: 'Own Goal' }, ownGoal: true, scoringPlay: true, clock: { displayValue: "90'" }, period: { number: 2 }, team: { id: '10' }, participants: [{ athlete: { displayName: 'Unlucky Defender' } }] },
      { id: 'e7', type: { id: '94', text: 'Yellow Card' }, clock: { displayValue: "70'" }, period: { number: 2 }, participants: [{ athlete: { displayName: 'Unknown Team Player' } }] }
    ]
  }, { homeTeamId: '10', awayTeamId: '20' });

  assert.deepEqual(events.map(e => [e.time, e.eventType, e.team]), [
    ['12', 'GOAL', 'home'],
    ['45', 'PENALTY_SAVED', 'away'],
    ['45+2', 'PENALTY_GOAL', 'home'],
    ['46', 'SECOND_YELLOW_RED', 'away'],
    ['70', 'YELLOW_CARD', null],
    ['90', 'OWN_GOAL', 'home'],
    ['90+5', 'RED_CARD', 'away']
  ]);
  assert.equal(events[0].assist, 'Assister One');
  assert.equal(events[1].type, 'penalty_saved');
  assert.equal(events[3].cardType, 'second_yellow');
  assert.equal(events[4].team, null, 'missing team.id must never default to away');

  // 4. compareMatchEvents direct check for 120+1 extra time
  assert.ok(compareMatchEvents({ period: 4, minute: 120, addedTime: 1 }, { period: 4, minute: 120, addedTime: 3 }) < 0);

  // 5. Unavailable substitutes & empty payloads remain clean without fabrication
  const teamIds = resolveMatchTeamIds({});
  assert.deepEqual(teamIds, { homeTeamId: null, awayTeamId: null, homeTeamName: '', awayTeamName: '' });
  const startersOnlyRosters = normalizeMatchRosters({
    rosters: [
      { homeAway: 'home', team: { id: '10', displayName: 'Home FC' }, roster: [{ starter: true, jersey: '9', athlete: { displayName: 'No9' } }] },
      { homeAway: 'away', team: { id: '20', displayName: 'Away FC' }, roster: [{ starter: true, jersey: '7', athlete: { displayName: 'No7' } }] }
    ]
  }, { homeTeamId: '10', awayTeamId: '20' });
  assert.equal(startersOnlyRosters.home.substitutes.length, 0, 'must never fabricate substitutes when API omits them');
  assert.equal(startersOnlyRosters.away.substitutes.length, 0);

  // 6. UI component regression guardrails in MatchDetailModal.jsx
  const modalSource = readFileSync(new URL('../src/components/MatchDetailModal.jsx', import.meta.url), 'utf8');
  assert.equal(modalSource.includes('{i + 1}'), false, 'MatchDetailModal must never render synthetic {i + 1} jersey numbers');
  assert.equal(modalSource.includes('التشكيل الأساسي'), true);
  assert.equal(modalSource.includes('البدلاء'), true);
  assert.equal(modalSource.includes('بيانات البدلاء غير متاحة حالياً'), true);
  assert.equal(modalSource.includes('ركلة جزاء ضائعة'), true);
});
