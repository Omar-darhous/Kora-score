import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMockEgyptianMatches,
  getMockEgyptianMatchDetails,
  getMockEgyptianStandings,
  EGYPTIAN_MOCK_TEAMS_DATA,
  getEgyptianTeamDetails,
  getEgyptianTeamRoster,
  getEgyptianTeamSchedule
} from '../src/services/egyptianMockService.js';
import {
  getMatchDetails,
  getStandings,
  getTeamDetails,
  getTeamRoster,
  getTeamSchedule
} from '../src/services/footballService.js';

test('Egyptian mock matches and teams preserve exact IDs, scores, and cross-reference consistency', () => {
  const matches = getMockEgyptianMatches();
  assert.equal(matches.length, 3);
  assert.deepEqual(matches.map(m => m.id), ['egy-match-1', 'egy-match-2', 'egy-match-3']);

  const standings = getMockEgyptianStandings();
  const standingTeamIds = new Set(standings[0].entries.map(e => e.teamId).filter(Boolean));

  for (const match of matches) {
    assert.equal(match.leagueId, 'egypt.1');
    assert.equal(match.leagueLogo, '');
    assert.equal(match.homeLogo, '');
    assert.equal(match.awayLogo, '');
    assert.equal(Boolean(EGYPTIAN_MOCK_TEAMS_DATA[match.homeTeamId]), true);
    assert.equal(Boolean(EGYPTIAN_MOCK_TEAMS_DATA[match.awayTeamId]), true);
    assert.equal(standingTeamIds.has(match.homeTeamId), true);
    assert.equal(standingTeamIds.has(match.awayTeamId), true);
  }

  assert.equal(matches[0].homeScore, 2);
  assert.equal(matches[0].awayScore, 1);
  assert.equal(matches[1].homeScore, 3);
  assert.equal(matches[1].awayScore, 0);
  assert.equal(matches[2].homeScore, 1);
  assert.equal(matches[2].awayScore, 1);
});

test('Egyptian mock standings preserve structure, season nullability, and ranking order', () => {
  const standings = getMockEgyptianStandings();
  assert.equal(standings.length, 1);
  assert.equal(standings.season, null);
  assert.equal(standings[0].season, null);
  assert.equal(standings[0].entries.length, 18);
  assert.equal(standings[0].entries[0].teamId, 'egy-team-zamalek');
  assert.equal(standings[0].entries[0].points, 56);
  assert.equal(standings[0].entries[2].teamId, 'egy-team-ahly');
  assert.equal(standings[0].entries[2].points, 51);
  assert.equal(standings[0].entries[17].rank, 18);
});

test('Egyptian team details, rosters, and schedules preserve shapes and fallback behavior', () => {
  const ahly = getEgyptianTeamDetails('egy-team-ahly');
  assert.equal(ahly.id, 'egy-team-ahly');
  assert.equal(ahly.abbreviation, 'AHL');
  assert.equal(ahly.venue.name, 'ستاد القاهرة الدولي');

  const fallback = getEgyptianTeamDetails('egy-team-unknown');
  assert.equal(fallback.id, 'egy-team-unknown');
  assert.equal(fallback.abbreviation, 'EGY');
  assert.equal(fallback.venue, null);
  assert.equal(fallback.defaultLeague.id, 'egypt.1');

  const ahlyRoster = getEgyptianTeamRoster('egy-team-ahly');
  assert.equal(ahlyRoster.length, 11);
  assert.equal(ahlyRoster[0].positionGroup, 'goalkeepers');
  assert.equal(ahlyRoster[1].positionGroup, 'defenders');
  assert.equal(ahlyRoster[5].positionGroup, 'midfielders');
  assert.equal(ahlyRoster[8].positionGroup, 'forwards');

  const ahlySchedule = getEgyptianTeamSchedule('egy-team-ahly');
  assert.equal(ahlySchedule.length, 1);
  assert.equal(ahlySchedule[0].result, 'W');
  assert.equal(ahlySchedule[0].isHome, true);

  const zamalekSchedule = getEgyptianTeamSchedule('egy-team-zamalek');
  assert.equal(zamalekSchedule.length, 1);
  assert.equal(zamalekSchedule[0].result, 'L');
  assert.equal(zamalekSchedule[0].isHome, false);

  const masrySchedule = getEgyptianTeamSchedule('egy-team-masry');
  assert.equal(masrySchedule.length, 1);
  assert.equal(masrySchedule[0].result, 'D');
});

test('footballService delegates Egyptian mock endpoints with identical backward-compatible outputs', async () => {
  const standings = await getStandings('egypt.1');
  assert.deepEqual(standings, getMockEgyptianStandings());
  assert.equal(standings.season, null);

  const matchDetails = await getMatchDetails('egypt.1', 'egy-match-1');
  assert.deepEqual(matchDetails, getMockEgyptianMatchDetails('egy-match-1'));
  assert.equal(await getMatchDetails('egypt.1', 'egy-match-missing'), null);

  const teamDetails = await getTeamDetails('egy-team-pyramids');
  assert.deepEqual(teamDetails, getEgyptianTeamDetails('egy-team-pyramids'));

  const roster = await getTeamRoster('egypt.1', 'egy-team-zamalek');
  assert.deepEqual(roster, getEgyptianTeamRoster('egy-team-zamalek'));

  const schedule = await getTeamSchedule('egypt.1', 'egy-team-ismaily');
  assert.deepEqual(schedule, getEgyptianTeamSchedule('egy-team-ismaily'));
});
