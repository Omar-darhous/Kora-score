import test from 'node:test';
import assert from 'node:assert/strict';
import { getTournamentKnockouts } from '../src/services/knockoutsService.js';
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

test('getTournamentKnockouts handles World Cup knockout rounds, third-place match, and penalty summary enrichment', async () => {
  const requestedUrls = [];
  const bracket = await withMockFetch(async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes('/summary?event=wc-final')) {
      return {
        ok: true,
        json: async () => ({
          header: {
            competitions: [{
              status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', shortDetail: 'FT-Pens' } },
              competitors: [
                { homeAway: 'home', score: '3', shootoutScore: '4', winner: true, linescores: [{ value: 1 }, { value: 1 }, { value: 1 }, { value: 0 }] },
                { homeAway: 'away', score: '3', shootoutScore: '2', winner: false, linescores: [{ value: 1 }, { value: 1 }, { value: 0 }, { value: 1 }] }
              ]
            }]
          }
        })
      };
    }

    return {
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'wc-bronze',
            date: '2026-07-18T15:00:00Z',
            season: { year: 2026, slug: 'third-place' },
            status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
            competitions: [{
              competitors: [
                { homeAway: 'home', score: '2', winner: true, team: { id: 'cro', displayName: 'Croatia' } },
                { homeAway: 'away', score: '1', winner: false, team: { id: 'mar', displayName: 'Morocco' } }
              ]
            }]
          },
          {
            id: 'wc-final',
            date: '2026-07-19T15:00:00Z',
            season: { year: 2026, slug: 'final' },
            status: { type: { state: 'post', completed: true, name: 'STATUS_FINAL_PEN', shortDetail: 'FT-Pens' } },
            competitions: [{
              competitors: [
                { homeAway: 'home', score: '3', shootoutScore: '4', winner: true, team: { id: 'arg', displayName: 'Argentina' } },
                { homeAway: 'away', score: '3', shootoutScore: '2', winner: false, team: { id: 'fra', displayName: 'France' } }
              ]
            }]
          }
        ]
      })
    };
  }, () => getTournamentKnockouts('fifa.world', 2026));

  assert.equal(requestedUrls.filter(u => u.includes('/scoreboard')).length, 1);
  assert.equal(bracket.thirdPlace.length, 1);
  assert.equal(bracket.thirdPlace[0].id, 'wc-bronze');
  assert.equal(bracket.final.length, 1);
  assert.equal(bracket.final[0].id, 'wc-final');
  assert.equal(bracket.final[0].finishType, 'penalties');
  assert.equal(bracket.final[0].homePenalties, 4);
  assert.equal(bracket.final[0].awayPenalties, 2);
  assert.deepEqual(bracket.final[0].regulationScore, [2, 2]);
  assert.deepEqual(bracket.final[0].extraTimeScore, [3, 3]);
});

test('getTournamentKnockouts spans two calendar years for two-legged UEFA competitions and deduplicates events', async () => {
  const requestedUrls = [];
  const bracket = await withMockFetch(async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes('dates=2025')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: 'ucl-sf-leg1',
              date: '2026-04-28T19:00:00Z',
              season: { year: 2025, slug: 'semifinals' },
              status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
              competitions: [{
                competitors: [
                  { homeAway: 'home', score: '1', winner: false, team: { id: '86', displayName: 'Real Madrid' } },
                  { homeAway: 'away', score: '1', winner: false, team: { id: '364', displayName: 'Liverpool' } }
                ]
              }]
            }
          ]
        })
      };
    }
    return {
      ok: true,
      json: async () => ({
        events: [
          {
            id: 'ucl-sf-leg1',
            date: '2026-04-28T19:00:00Z',
            season: { year: 2025, slug: 'semifinals' },
            status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
            competitions: [{
              competitors: [
                { homeAway: 'home', score: '1', winner: false, team: { id: '86', displayName: 'Real Madrid' } },
                { homeAway: 'away', score: '1', winner: false, team: { id: '364', displayName: 'Liverpool' } }
              ]
            }]
          },
          {
            id: 'ucl-sf-leg2',
            date: '2026-05-05T19:00:00Z',
            season: { year: 2025, slug: 'semifinals' },
            status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
            competitions: [{
              competitors: [
                { homeAway: 'home', score: '2', winner: true, team: { id: '364', displayName: 'Liverpool' } },
                { homeAway: 'away', score: '0', winner: false, team: { id: '86', displayName: 'Real Madrid' } }
              ]
            }]
          }
        ]
      })
    };
  }, () => getTournamentKnockouts('uefa.champions', 2025));

  assert.equal(requestedUrls.length, 2);
  assert.equal(bracket.sf.length, 2);
  assert.deepEqual(bracket.sf.map(m => m.id), ['ucl-sf-leg1', 'ucl-sf-leg2']);
});

test('getTournamentKnockouts handles empty/incomplete fixtures, invalid seasons, and network errors', async () => {
  await assert.rejects(() => getTournamentKnockouts('fifa.world', 'invalid'), /Season unavailable/);
  await assert.rejects(() => getTournamentKnockouts('fifa.world', 1800), /Season unavailable/);

  // Incomplete upcoming match without teams or scores
  const incomplete = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      events: [{
        id: 'tbd-match',
        date: '2027-07-01T18:00:00Z',
        season: { year: 2027, slug: 'quarterfinals' },
        status: { type: { state: 'pre' } },
        competitions: [{ competitors: [{ homeAway: 'home', score: '' }, { homeAway: 'away', score: null }] }]
      }]
    })
  }), () => getTournamentKnockouts('fifa.world', 2027));

  assert.equal(incomplete.qf.length, 1);
  assert.equal(incomplete.qf[0].homeTeam, 'لم يتحدد بعد');
  assert.equal(incomplete.qf[0].homeScore, null);
  assert.equal(incomplete.qf[0].status, 'NS');
  assert.deepEqual(incomplete.final, []);

  // Network failure rejects cleanly
  await withMockFetch(async () => ({
    ok: false,
    status: 503,
    json: async () => ({})
  }), async () => {
    await assert.rejects(() => getTournamentKnockouts('fifa.world', 2028), /Request failed: 503/);
  });
});

test('footballService re-exports getTournamentKnockouts with exact backward compatibility', () => {
  assert.equal(footballService.getTournamentKnockouts, getTournamentKnockouts);
});
