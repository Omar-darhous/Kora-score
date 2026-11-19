import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getTeamMatchOutcome,
  parseMatchResult,
  finishedMatchLabel,
  isUpcomingMatch,
  getFavoriteMatchDisplay
} from '../src/services/matchResult.js';
import { getTeamSchedule } from '../src/services/teamsService.js';

const withMockFetch = async (mockImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('getTeamMatchOutcome classifies home/away wins, losses, and regular-time draws accurately', () => {
  const homeWinMatch = {
    homeTeamId: '359',
    awayTeamId: '364',
    homeScore: 3,
    awayScore: 1,
    status: 'FT',
    finishType: 'regular'
  };
  assert.equal(getTeamMatchOutcome(homeWinMatch, '359'), 'win');
  assert.equal(getTeamMatchOutcome(homeWinMatch, '364'), 'loss');

  const awayWinMatch = {
    homeTeamId: '359',
    awayTeamId: '364',
    homeScore: 0,
    awayScore: 2,
    status: 'FT',
    finishType: 'regular'
  };
  assert.equal(getTeamMatchOutcome(awayWinMatch, '364'), 'win');
  assert.equal(getTeamMatchOutcome(awayWinMatch, '359'), 'loss');

  const drawMatch = {
    homeTeamId: '359',
    awayTeamId: '364',
    homeScore: 1,
    awayScore: 1,
    status: 'FT',
    finishType: 'regular'
  };
  assert.equal(getTeamMatchOutcome(drawMatch, '359'), 'draw');
  assert.equal(getTeamMatchOutcome(drawMatch, '364'), 'draw');
});

test('getTeamMatchOutcome handles extra time, penalty shootouts, and ambiguous penalty data safely', () => {
  // Extra-time victory/loss uses final post-ET result
  const etMatch = {
    homeTeamId: '86',
    awayTeamId: '382',
    homeScore: 2,
    awayScore: 1,
    extraTimeScore: [2, 1],
    status: 'FT',
    finishType: 'extra-time'
  };
  assert.equal(getTeamMatchOutcome(etMatch, '86'), 'win');
  assert.equal(getTeamMatchOutcome(etMatch, '382'), 'loss');

  // Penalty shootout decided by shootout scores (never classified as draw!)
  const penMatch = {
    homeTeamId: '86',
    awayTeamId: '382',
    homeScore: 1,
    awayScore: 1,
    homePenalties: 4,
    awayPenalties: 3,
    homeWinner: true,
    awayWinner: false,
    status: 'FT',
    finishType: 'penalties'
  };
  assert.equal(getTeamMatchOutcome(penMatch, '86'), 'win');
  assert.equal(getTeamMatchOutcome(penMatch, '382'), 'loss');

  // Penalty shootout with unambiguous winner flag when shootout scores omitted
  const penWinnerFlagOnly = {
    homeTeamId: '86',
    awayTeamId: '382',
    homeScore: 2,
    awayScore: 2,
    homePenalties: null,
    awayPenalties: null,
    homeWinner: false,
    awayWinner: true,
    status: 'FT',
    finishType: 'penalties'
  };
  assert.equal(getTeamMatchOutcome(penWinnerFlagOnly, '382'), 'win');
  assert.equal(getTeamMatchOutcome(penWinnerFlagOnly, '86'), 'loss');

  // Missing or ambiguous penalty data -> null (never draw, never invented winner)
  const penAmbiguous = {
    homeTeamId: '86',
    awayTeamId: '382',
    homeScore: 1,
    awayScore: 1,
    homePenalties: null,
    awayPenalties: null,
    homeWinner: false,
    awayWinner: false,
    status: 'FT',
    finishType: 'penalties'
  };
  assert.equal(getTeamMatchOutcome(penAmbiguous, '86'), null);
  assert.equal(getTeamMatchOutcome(penAmbiguous, '382'), null);
});

test('getTeamMatchOutcome distinguishes individual match outcome from aggregate tie advancement', () => {
  // Leg 2: Home team lost 0-1 on the night, but ESPN flagged homeWinner: true due to 3-1 aggregate
  const leg2AggregateDiffers = {
    homeTeamId: '359',
    awayTeamId: '86',
    homeScore: 0,
    awayScore: 1,
    homeWinner: true,
    awayWinner: false,
    status: 'FT',
    finishType: 'regular'
  };
  assert.equal(getTeamMatchOutcome(leg2AggregateDiffers, '359'), 'loss');
  assert.equal(getTeamMatchOutcome(leg2AggregateDiffers, '86'), 'win');
});

test('getTeamMatchOutcome returns null for unfinished, postponed, cancelled, missing scores, or unknown team IDs', () => {
  for (const status of ['NS', 'UPCOMING', 'LIVE', 'POSTPONED', 'CANCELLED']) {
    assert.equal(
      getTeamMatchOutcome({ homeTeamId: '1', awayTeamId: '2', homeScore: 1, awayScore: 0, status }, '1'),
      null,
      `status ${status} must not produce win/loss/draw`
    );
  }

  // Missing scores
  assert.equal(
    getTeamMatchOutcome({ homeTeamId: '1', awayTeamId: '2', homeScore: null, awayScore: null, status: 'FT' }, '1'),
    null
  );

  // Missing or non-matching team IDs (never falls back to display names)
  assert.equal(
    getTeamMatchOutcome({ homeTeamId: '1', awayTeamId: '2', homeTeam: 'Arsenal', homeScore: 2, awayScore: 0, status: 'FT' }, '999'),
    null
  );
  assert.equal(
    getTeamMatchOutcome({ homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeScore: 2, awayScore: 0, status: 'FT' }, 'Arsenal'),
    null
  );
});

test('getTeamSchedule integrates team-centric outcomes for ESPN and Egyptian mock teams', async () => {
  // Egyptian mock teams: Ahly beat Zamalek 2-1, Masry drew Ittihad 1-1
  const ahlySchedule = await getTeamSchedule('egypt.1', 'egy-team-ahly');
  const zamalekSchedule = await getTeamSchedule('egypt.1', 'egy-team-zamalek');
  const masrySchedule = await getTeamSchedule('egypt.1', 'egy-team-masry');

  assert.equal(getTeamMatchOutcome(ahlySchedule[0], 'egy-team-ahly'), 'win');
  assert.equal(getTeamMatchOutcome(zamalekSchedule[0], 'egy-team-zamalek'), 'loss');
  assert.equal(getTeamMatchOutcome(masrySchedule[0], 'egy-team-masry'), 'draw');

  // ESPN schedule with postponed + upcoming + away win
  const espnSchedule = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      events: [
        {
          id: 'evt-postponed',
          date: '2026-11-18T19:00:00Z',
          status: { type: { state: 'post', completed: false, name: 'STATUS_POSTPONED', description: 'Postponed' } },
          competitions: [{
            competitors: [
              { id: '35901', homeAway: 'home', team: { id: '35901', displayName: 'Arsenal' } },
              { id: '36401', homeAway: 'away', team: { id: '36401', displayName: 'Liverpool' } }
            ]
          }]
        },
        {
          id: 'evt-away-win',
          date: '2026-11-15T16:30:00Z',
          status: { type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } },
          competitions: [{
            competitors: [
              { id: '36401', homeAway: 'home', score: { value: 1 }, team: { id: '36401', displayName: 'Liverpool' } },
              { id: '35901', homeAway: 'away', score: { value: 2 }, team: { id: '35901', displayName: 'Arsenal' } }
            ]
          }]
        }
      ]
    })
  }), () => getTeamSchedule('eng.1', '35901'));

  assert.equal(espnSchedule[0].status, 'POSTPONED');
  assert.equal(espnSchedule[0].outcome, null);
  assert.equal(espnSchedule[0].result, null);

  assert.equal(espnSchedule[1].status, 'FT');
  assert.equal(espnSchedule[1].outcome, 'win');
  assert.equal(espnSchedule[1].result, 'W');
});

test('existing matchResult helpers stay backward compatible and win badge uses green rather than red --live', () => {
  const parsed = parseMatchResult({ type: { state: 'post', completed: true, name: 'STATUS_FULL_TIME' } }, []);
  assert.equal(parsed.finishType, 'regular');
  assert.equal(finishedMatchLabel({ finishType: 'regular' }), 'انتهت');
  assert.equal(isUpcomingMatch({ status: 'NS' }), true);
  assert.equal(getFavoriteMatchDisplay({ status: 'NS', time: '20:00' }).centerText, 'VS');

  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const winRule = css.match(/\.team-result-badge\.win\s*\{[^}]*\}/)?.[0] || '';
  assert.equal(winRule.includes('var(--live)'), false, 'win badge must never use red --live variable');
  assert.equal(winRule.includes('#34d399'), true, 'win badge must use green text');
});
