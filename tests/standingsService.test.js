import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseSeasonMetadata,
  parseAvailableSeasons,
  parseSeasonQueryParam,
  buildSeasonSearchParams,
  isHistoricalSeasonSelected,
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

test('parseAvailableSeasons normalizes split-year and single-year seasons and ignores malformed items', () => {
  assert.deepEqual(parseAvailableSeasons(null), []);
  assert.deepEqual(parseAvailableSeasons([]), []);

  const euroSeasons = parseAvailableSeasons([
    { year: 2023, displayName: '2023-24 English Premier League', startDate: '2023-06-01' },
    { year: 2024, displayName: '2024-25 English Premier League', startDate: '2024-06-01' },
    { year: 2024, displayName: 'Duplicate 2024-25' },
    { year: 'invalid', displayName: 'Bad' },
    null
  ], { currentSeasonYear: 2024 });

  assert.deepEqual(euroSeasons.map(s => ({ year: s.year, label: s.label, isCurrent: s.isCurrent })), [
    { year: 2024, label: '2024/2025', isCurrent: true },
    { year: 2023, label: '2023/2024', isCurrent: false }
  ]);

  const wcSeasons = parseAvailableSeasons([
    { year: 2018, displayName: '2018 FIFA World Cup' },
    { year: 2026, displayName: '2026 FIFA World Cup' },
    { year: 2022, displayName: '2022 FIFA World Cup' }
  ], { currentSeasonYear: 2026 });

  assert.deepEqual(wcSeasons.map(s => ({ year: s.year, label: s.label, isCurrent: s.isCurrent })), [
    { year: 2026, label: '2026', isCurrent: true },
    { year: 2022, label: '2022', isCurrent: false },
    { year: 2018, label: '2018', isCurrent: false }
  ]);
});

test('getStandings supports historical seasons with distinct cache keys, validates returned season, and protects Egyptian mock league', async () => {
  const requestedUrls = [];

  await withMockFetch(async (url) => {
    const str = String(url);
    requestedUrls.push(str);

    if (str.includes('season=2024')) {
      return {
        ok: true,
        json: async () => ({
          name: '2024-25 Premier League',
          season: { year: 2024, displayName: '2024-25 English Premier League' },
          seasons: [
            { year: 2026, displayName: '2026-27 English Premier League' },
            { year: 2024, displayName: '2024-25 English Premier League' },
            { year: 2023, displayName: '2023-24 English Premier League' }
          ],
          children: [{
            standings: {
              entries: [{ team: { id: '364', displayName: 'Liverpool' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 84 }] }]
            }
          }]
        })
      };
    }

    if (str.includes('season=2023')) {
      return {
        ok: true,
        json: async () => ({
          name: '2023-24 Premier League',
          season: { year: 2023, displayName: '2023-24 English Premier League' },
          children: [{
            standings: {
              entries: [{ team: { id: '382', displayName: 'Manchester City' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 91 }] }]
            }
          }]
        })
      };
    }

    if (str.includes('season=2015')) {
      // Simulate ESPN returning HTTP 200 with a DIFFERENT season (fallback to 2026)
      return {
        ok: true,
        json: async () => ({
          name: '2026-27 League',
          season: { year: 2026, displayName: '2026-27 League' },
          children: [{
            standings: {
              entries: [{ team: { id: '1', displayName: 'Wrong Season Team' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 10 }] }]
            }
          }]
        })
      };
    }

    // Default current season (no ?season= param)
    return {
      ok: true,
      json: async () => ({
        name: '2026-27 Premier League',
        season: { year: 2026, displayName: '2026-27 English Premier League' },
        seasons: [
          { year: 2026, displayName: '2026-27 English Premier League' },
          { year: 2024, displayName: '2024-25 English Premier League' }
        ],
        children: [{
          standings: {
            entries: [{ team: { id: '359', displayName: 'Arsenal' }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 30 }] }]
          }
        }]
      })
    };
  }, async () => {
    const current = await getStandings('test.hist.eng', { strict: true });
    assert.equal(current.season.year, 2026);
    assert.equal(current[0].entries[0].team, 'Arsenal');
    assert.equal(current.availableSeasons[0].isCurrent, true);
    assert.equal(requestedUrls[0].includes('season='), false);

    const s2024 = await getStandings('test.hist.eng', { strict: true, season: 2024 });
    assert.equal(s2024.season.year, 2024);
    assert.equal(s2024[0].entries[0].team, 'Liverpool');
    assert.equal(s2024.availableSeasons.length, 3);

    const s2023 = await getStandings('test.hist.eng', { strict: true, season: 2023 });
    assert.equal(s2023.season.year, 2023);
    assert.equal(s2023[0].entries[0].team, 'Manchester City');

    // Distinct cache keys: re-reading 2024 uses cache without colliding with 2023
    const callsBeforeCached = requestedUrls.length;
    const s2024Cached = await getStandings('test.hist.eng', { strict: true, season: 2024 });
    assert.equal(requestedUrls.length, callsBeforeCached);
    assert.equal(s2024Cached[0].entries[0].team, 'Liverpool');

    // forceRefresh bypasses historical cache
    await getStandings('test.hist.eng', { strict: true, season: 2024, forceRefresh: true });
    assert.equal(requestedUrls.length, callsBeforeCached + 1);

    // Mismatched returned season is rejected when strict: true and returns [] when strict: false
    await assert.rejects(() => getStandings('test.hist.eng', { strict: true, season: 2015 }), /Season 2015 unavailable/);
    assert.deepEqual(await getStandings('test.hist.eng', { strict: false, season: 2015 }), []);
  });

  // Invalid season parameter
  await assert.rejects(() => getStandings('eng.1', { strict: true, season: 'abc' }), /Invalid season/);
  assert.deepEqual(await getStandings('eng.1', { strict: false, season: 'abc' }), []);

  // Egyptian mock league never invents historical seasons
  const egyDefault = await getStandings('egypt.1', { strict: true });
  assert.equal(egyDefault.availableSeasons, undefined);
  await assert.rejects(() => getStandings('egypt.1', { strict: true, season: 2023 }), /not available/);
  assert.deepEqual(await getStandings('egypt.1', { strict: false, season: 2023 }), []);
});

test('createStandingsController prevents out-of-order season overwrites and isolates stale data per league and season', async () => {
  let resolveSlow2024;
  let fail2023 = false;

  const controller = createStandingsController({
    fetcher: async (leagueId, { season }) => {
      if (season === 2024) {
        return new Promise((resolve) => {
          resolveSlow2024 = () => {
            const res = [{ name: '2024-25', season: { year: 2024 }, entries: [{ teamId: '364', rank: 1, team: 'Liverpool', points: 84 }] }];
            res.availableSeasons = [{ year: 2024, label: '2024/2025', isCurrent: false }];
            resolve(res);
          };
        });
      }
      if (season === 2023) {
        if (fail2023) throw new Error('2023 refresh failed');
        const res = [{ name: '2023-24', season: { year: 2023 }, entries: [{ teamId: '382', rank: 1, team: 'Man City', points: 91 }] }];
        res.availableSeasons = [
          { year: 2024, label: '2024/2025', isCurrent: false },
          { year: 2023, label: '2023/2024', isCurrent: false }
        ];
        return res;
      }
      if (season === 2022) {
        throw new Error('2022 unavailable');
      }
      return [];
    }
  });

  // Rapid season switch: start slow 2024, then switch to fast 2023
  const p2024 = controller.load('eng.1', { season: 2024 });
  const p2023 = controller.load('eng.1', { season: 2023 });
  await p2023;
  assert.equal(controller.getState().season, 2023);
  assert.equal(controller.getState().standings[0].entries[0].team, 'Man City');

  // Late 2024 response must NOT overwrite 2023
  resolveSlow2024();
  await p2024;
  assert.equal(controller.getState().season, 2023);
  assert.equal(controller.getState().standings[0].entries[0].team, 'Man City');

  // Failed retry on SAME league + SAME season (2023) retains stale 2023 standings
  fail2023 = true;
  await controller.retry();
  assert.equal(controller.getState().season, 2023);
  assert.equal(controller.getState().isStale, true);
  assert.equal(controller.getState().standings[0].entries[0].team, 'Man City');

  // Switching to a DIFFERENT failing season (2022) clears 2023 standings and does NOT mark cross-season stale
  await controller.load('eng.1', { season: 2022 });
  assert.equal(controller.getState().season, 2022);
  assert.equal(controller.getState().standings.length, 0);
  assert.equal(controller.getState().isStale, false);
  assert.equal(typeof controller.getState().error, 'string');
});

test('season URL helpers validate ?season=YYYY, clear season on league switch, and isolate historical match tabs', () => {
  // Valid URL params
  assert.deepEqual(parseSeasonQueryParam(null), { valid: true, season: null, raw: '' });
  assert.deepEqual(parseSeasonQueryParam(''), { valid: true, season: null, raw: '' });
  assert.deepEqual(parseSeasonQueryParam('2024'), { valid: true, season: 2024, raw: '2024' });
  assert.deepEqual(parseSeasonQueryParam('2022'), { valid: true, season: 2022, raw: '2022' });

  // Invalid URL params
  assert.equal(parseSeasonQueryParam('abc').valid, false);
  assert.equal(parseSeasonQueryParam('1800').valid, false);
  assert.equal(parseSeasonQueryParam('20245').valid, false);

  // Direct historical URL preserved on refresh
  const withSeason = buildSeasonSearchParams('league=uefa.champions', { leagueId: 'uefa.champions', season: 2023 });
  assert.equal(withSeason.get('league'), 'uefa.champions');
  assert.equal(withSeason.get('season'), '2023');

  // Switching leagues strips incompatible season parameter
  const switchedLeague = buildSeasonSearchParams(withSeason, { leagueId: 'ksa.1', leagueChanged: true });
  assert.equal(switchedLeague.get('league'), 'ksa.1');
  assert.equal(switchedLeague.get('season'), null);

  // Returning to current season removes ?season=
  const backToCurrent = buildSeasonSearchParams(withSeason, { leagueId: 'uefa.champions', season: null });
  assert.equal(backToCurrent.get('season'), null);

  // Historical season detection for match-tab isolation & domestic badge suppression
  const available = [
    { year: 2026, label: '2026/2027', isCurrent: true },
    { year: 2024, label: '2024/2025', isCurrent: false },
    { year: 2023, label: '2023/2024', isCurrent: false }
  ];
  assert.equal(isHistoricalSeasonSelected(null, available), false);
  assert.equal(isHistoricalSeasonSelected(2026, available), false);
  assert.equal(isHistoricalSeasonSelected(2024, available), true);
  assert.equal(isHistoricalSeasonSelected(2023, available), true);
});

test('createStandingsController resets season and availableSeasons when switching leagues', async () => {
  const seenCalls = [];
  const controller = createStandingsController({
    fetcher: async (leagueId, opts) => {
      seenCalls.push({ leagueId, season: opts.season ?? null });
      const res = [{ name: leagueId, season: { year: opts.season ?? 2026 }, entries: [{ teamId: '1', rank: 1, team: 'T', points: 10 }] }];
      res.availableSeasons = leagueId === 'egypt.1' ? [] : [{ year: 2026, label: '2026/2027', isCurrent: true }];
      return res;
    }
  });

  await controller.load('eng.1', { season: 2023 });
  assert.equal(controller.getState().leagueId, 'eng.1');
  assert.equal(controller.getState().season, 2023);

  // Switching to ksa.1 without specifying season resets season to null (current)
  await controller.load('ksa.1');
  assert.equal(controller.getState().leagueId, 'ksa.1');
  assert.equal(controller.getState().season, null);
  assert.equal(seenCalls[1].season, null);

  // Switching to egypt.1 clears previous league availableSeasons
  await controller.load('egypt.1');
  assert.deepEqual(controller.getState().availableSeasons, []);
});

test('mobile standings table preserves dedicated horizontal scroll container and mobile-only scroll hint', () => {
  const jsx = readFileSync(new URL('../src/components/LeagueStandings.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

  // Guard against the root-cause bug: inline overflow: hidden on table-responsive
  assert.equal(/table-responsive[^>]*overflow:\s*['"]hidden['"]/.test(jsx), false);
  assert.equal(jsx.includes('className="table-responsive standings-table-scroll"'), true);
  assert.equal(jsx.includes('اسحب الجدول يمينًا أو يسارًا لعرض باقي الإحصائيات'), true);

  // CSS contract: horizontal scroll enabled, touch momentum + vertical scroll preserved, mobile min-width, desktop hint hidden
  assert.equal(/\.standings-table-scroll\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*-webkit-overflow-scrolling:\s*touch;[\s\S]*touch-action:\s*pan-x pan-y;/.test(css), true);
  assert.equal(/\.standings-mobile-scroll-hint\s*\{\s*display:\s*none;\s*\}/.test(css), true);
  assert.equal(/@media\s*\(max-width:\s*767px\)[\s\S]*\.standings-table-scroll\s+\.standings-table\s*\{[\s\S]*min-width:\s*580px;/.test(css), true);
});
