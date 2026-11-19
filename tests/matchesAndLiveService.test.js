import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapKnockoutStage,
  translateRoundText,
  normalizeScoreboardMatches,
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
