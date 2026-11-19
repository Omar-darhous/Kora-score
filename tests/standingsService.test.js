import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSeasonMetadata,
  parseStandingsEntries,
  getStandings,
  createStandingsController
} from '../src/services/standingsService.js';
import { getMockEgyptianStandings } from '../src/services/egyptianMockService.js';
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

test('parseSeasonMetadata and parseStandingsEntries normalize metadata, qualification notes, and sorting', () => {
  assert.equal(parseSeasonMetadata(null), null);
  assert.equal(parseSeasonMetadata({}), null);
  assert.deepEqual(
    parseSeasonMetadata({ year: 2026, displayName: '2026-27', startDate: '2026-08-01', endDate: '2027-05-30' }),
    { year: 2026, displayName: '2026-27', startDate: '2026-08-01', endDate: '2027-05-30' }
  );

  const entries = parseStandingsEntries([
    {
      team: { id: '359', displayName: 'Arsenal', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' },
      note: { description: 'Champions League' },
      stats: [
        { name: 'rank', value: 2 },
        { name: 'gamesPlayed', value: 10 },
        { name: 'wins', value: 7 },
        { name: 'ties', value: 2 },
        { name: 'losses', value: 1 },
        { name: 'pointsFor', value: 20 },
        { name: 'pointsAgainst', value: 8 },
        { name: 'points', value: 23 }
      ]
    },
    {
      team: { id: '364', displayName: 'Liverpool', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' },
      note: { description: 'Champions League' },
      stats: [
        { name: 'rank', value: 1 },
        { name: 'gamesPlayed', value: 10 },
        { name: 'wins', value: 8 },
        { name: 'ties', value: 1 },
        { name: 'losses', value: 1 },
        { name: 'pointsFor', value: 24 },
        { name: 'pointsAgainst', value: 7 },
        { name: 'points', value: 25 }
      ]
    }
  ]);

  assert.deepEqual(entries.map(e => e.teamId), ['364', '359']);
  assert.equal(entries[0].qualificationNote, 'Champions League');
  assert.equal(entries[0].points, 25);
});

test('getStandings handles ESPN success, valid empty standings, strict failures, forceRefresh retry, and Egyptian mock standings', async () => {
  const egy = await getStandings('egypt.1');
  assert.deepEqual(egy, getMockEgyptianStandings());

  // Successful ESPN standings
  const success = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      name: 'Premier League',
      season: { year: 2026, displayName: '2026-27' },
      children: [{
        standings: {
          entries: [{
            team: { id: '364', displayName: 'Liverpool', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' },
            stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 25 }]
          }]
        }
      }]
    })
  }), () => getStandings('test.standings.ok', { strict: true }));

  assert.equal(success.length, 1);
  assert.equal(success.season.year, 2026);
  assert.equal(success[0].entries[0].teamId, '364');

  // Valid empty standings response
  const empty = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      name: 'Empty League',
      children: [{ standings: { entries: [] } }]
    })
  }), () => getStandings('test.standings.empty', { strict: true }));
  assert.deepEqual(empty, []);

  // API failure with strict: true vs strict: false, then forceRefresh recovery
  let attempts = 0;
  await withMockFetch(async () => {
    attempts += 1;
    if (attempts <= 2) return { ok: false, status: 503, json: async () => ({}) };
    return {
      ok: true,
      json: async () => ({
        name: 'Recovered League',
        children: [{
          standings: {
            entries: [{ team: { id: '86', displayName: 'Real Madrid' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 30 }] }]
          }
        }]
      })
    };
  }, async () => {
    await assert.rejects(() => getStandings('test.standings.fail', { strict: true }));
    assert.deepEqual(await getStandings('test.standings.fail', { strict: false }), []);
    const recovered = await getStandings('test.standings.fail', { strict: true, forceRefresh: true });
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].entries[0].teamId, '86');
  });
});

test('createStandingsController preserves stale standings on failed refresh, blocks duplicate retries, and cleans up on dispose', async () => {
  let callCount = 0;
  let resolvePending;
  const states = [];

  const controller = createStandingsController({
    fetcher: async (leagueId, { forceRefresh }) => {
      callCount += 1;
      if (callCount === 1) {
        return [{ name: 'League', season: null, entries: [{ teamId: '1', rank: 1, team: 'A', points: 10 }] }];
      }
      if (callCount === 2) {
        assert.equal(forceRefresh, true);
        throw new Error('Upstream failure');
      }
      return new Promise((resolve) => {
        resolvePending = () => resolve([{ name: 'League', season: null, entries: [{ teamId: '1', rank: 1, team: 'A', points: 13 }] }]);
      });
    },
    onStateChange: (s) => states.push(s)
  });

  await controller.load('eng.1');
  assert.equal(controller.getState().standings.length, 1);
  assert.equal(controller.getState().isStale, false);

  // Failed retry preserves previous valid standings and marks isStale = true
  await controller.retry();
  assert.equal(controller.getState().standings.length, 1);
  assert.equal(controller.getState().isStale, true);
  assert.equal(typeof controller.getState().error, 'string');

  // Overlapping retry while loading is ignored
  const third = controller.retry();
  const duplicate = controller.retry();
  await duplicate;
  assert.equal(callCount, 3);

  // Dispose prevents late resolution from mutating state
  const countBeforeDispose = states.length;
  controller.dispose();
  resolvePending();
  await third;
  assert.equal(states.length, countBeforeDispose);
});

test('footballService re-exports standings service functions with exact backward compatibility', () => {
  assert.equal(footballService.getStandings, getStandings);
  assert.equal(footballService.createStandingsController, createStandingsController);
});
