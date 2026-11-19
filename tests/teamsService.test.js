import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categorizePosition,
  translatePosition,
  getTeamDetails,
  getTeamSchedule,
  getTeamRoster
} from '../src/services/teamsService.js';
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

test('categorizePosition and translatePosition map soccer roles accurately', () => {
  assert.equal(categorizePosition('Goalkeeper'), 'goalkeepers');
  assert.equal(categorizePosition('Center-Back'), 'defenders');
  assert.equal(categorizePosition('Central Midfielder'), 'midfielders');
  assert.equal(categorizePosition('Striker'), 'forwards');
  assert.equal(categorizePosition('Right Winger'), 'forwards');
  assert.equal(categorizePosition('Unknown Role'), 'other');

  assert.equal(translatePosition('Goalkeeper'), 'حارس مرمى');
  assert.equal(translatePosition('Center-Back'), 'قلب دفاع');
  assert.equal(translatePosition('Left-Back'), 'ظهير أيسر');
  assert.equal(translatePosition('Right-Back'), 'ظهير أيمن');
  assert.equal(translatePosition('Midfielder'), 'لاعب وسط');
  assert.equal(translatePosition('Attacking Midfield'), 'وسط هجومي');
  assert.equal(translatePosition('Left Wing'), 'جناح أيسر');
  assert.equal(translatePosition('Right Wing'), 'جناح أيمن');
  assert.equal(translatePosition('Striker'), 'رأس حربة');
  assert.equal(translatePosition(''), 'لاعب');
});

test('getTeamDetails normalizes ESPN team data, delegates Egyptian mock teams, and handles invalid inputs', async () => {
  assert.equal(await getTeamDetails(null), null);
  assert.equal(await getTeamDetails('undefined'), null);

  const egy = await getTeamDetails('egy-team-ahly');
  assert.equal(egy.id, 'egy-team-ahly');
  assert.equal(egy.name, 'الأهلي');
  assert.equal(egy.venue.name, 'ستاد القاهرة الدولي');

  const espnTeam = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      team: {
        id: '364001',
        displayName: 'Liverpool',
        shortDisplayName: 'Liverpool',
        abbreviation: 'LIV',
        logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' }],
        venue: { fullName: 'Anfield', capacity: 61276, address: { city: 'Liverpool' } },
        defaultLeague: { id: '23', name: 'English Premier League', midsizeName: 'eng.1' }
      }
    })
  }), () => getTeamDetails('364001'));

  assert.deepEqual(espnTeam, {
    id: '364001',
    name: 'Liverpool',
    shortName: 'Liverpool',
    abbreviation: 'LIV',
    logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    venue: { name: 'Anfield', capacity: 61276, city: 'Liverpool' },
    defaultLeague: { id: '23', name: 'English Premier League', midsizeName: 'eng.1' }
  });
});

test('getTeamSchedule and getTeamRoster normalize ESPN fixtures and handle missing or malformed API data', async () => {
  assert.deepEqual(await getTeamSchedule('', '364002'), []);
  assert.deepEqual(await getTeamRoster('', '364002'), []);

  const schedule = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      events: [
        {
          id: 'evt-1',
          date: '2026-11-18T19:00:00Z',
          name: 'Liverpool vs Arsenal',
          status: { type: { state: 'post', completed: true } },
          competitions: [{
            competitors: [
              { id: '364002', homeAway: 'home', winner: true, score: { value: 2 }, team: { id: '364002', displayName: 'Liverpool' } },
              { id: '359002', homeAway: 'away', winner: false, score: { value: 1 }, team: { id: '359002', displayName: 'Arsenal', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' }] } }
            ]
          }]
        }
      ]
    })
  }), () => getTeamSchedule('eng.1', '364002'));

  assert.equal(schedule.length, 1);
  assert.equal(schedule[0].isHome, true);
  assert.equal(schedule[0].result, 'W');
  assert.equal(schedule[0].status, 'FT');
  assert.equal(schedule[0].opponentName, 'Arsenal');
  assert.equal(schedule[0].opponentLogo, 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png');

  const roster = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      athletes: [
        { id: '11', displayName: 'Mohamed Salah', jersey: '11', position: { displayName: 'Right Winger' }, citizenship: 'Egypt', headshot: { href: 'https://a.espncdn.com/headshot.png' } }
      ]
    })
  }), () => getTeamRoster('eng.1', '364002'));

  assert.deepEqual(roster, [{
    id: '11',
    name: 'Mohamed Salah',
    jersey: '11',
    position: 'جناح أيمن',
    positionGroup: 'forwards',
    citizenship: 'Egypt',
    photo: 'https://a.espncdn.com/headshot.png'
  }]);

  // Malformed / failing responses fail safely without throwing
  const malformedDetails = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({})
  }), () => getTeamDetails('364003'));
  assert.equal(malformedDetails, null);

  const failedSchedule = await withMockFetch(async () => ({
    ok: false,
    status: 500,
    json: async () => ({})
  }), () => getTeamSchedule('eng.1', '364003'));
  assert.deepEqual(failedSchedule, []);

  const failedRoster = await withMockFetch(async () => {
    throw new Error('Network down');
  }, () => getTeamRoster('eng.1', '364003'));
  assert.deepEqual(failedRoster, []);
});

test('footballService re-exports team service functions with exact backward compatibility', () => {
  assert.equal(footballService.getTeamDetails, getTeamDetails);
  assert.equal(footballService.getTeamSchedule, getTeamSchedule);
  assert.equal(footballService.getTeamRoster, getTeamRoster);
});

test('categorizePosition and translatePosition accurately classify defensive/attacking midfield, wingers, defenders, abbreviations, and unknown roles', async () => {
  // Defensive Midfield MUST be Midfielder (never Defender despite containing "defen")
  for (const pos of ['Defensive Midfielder', 'Defensive Midfield', 'CDM', 'DM']) {
    assert.equal(categorizePosition(pos), 'midfielders', `expected midfielder for ${pos}`);
    assert.equal(translatePosition(pos), 'وسط دفاعي', `expected وسط دفاعي for ${pos}`);
  }

  // Attacking & Central Midfield
  for (const pos of ['Attacking Midfielder', 'Attacking Midfield', 'CAM', 'AM']) {
    assert.equal(categorizePosition(pos), 'midfielders');
    assert.equal(translatePosition(pos), 'وسط هجومي');
  }
  assert.equal(categorizePosition('Central Midfielder'), 'midfielders');
  assert.equal(translatePosition('Central Midfielder'), 'وسط مركزي');
  assert.equal(categorizePosition('CM'), 'midfielders');
  assert.equal(translatePosition('CM'), 'وسط مركزي');

  // Wingers -> Forwards
  for (const pos of ['Left Wing', 'Left Winger', 'LW']) {
    assert.equal(categorizePosition(pos), 'forwards', `expected forward for ${pos}`);
    assert.equal(translatePosition(pos), 'جناح أيسر');
  }
  for (const pos of ['Right Wing', 'Right Winger', 'RW']) {
    assert.equal(categorizePosition(pos), 'forwards', `expected forward for ${pos}`);
    assert.equal(translatePosition(pos), 'جناح أيمن');
  }

  // Centre Back, Fullbacks & Wing-Backs -> Defenders
  for (const pos of ['Centre Back', 'Center Back', 'Center-Back', 'Centre-Back', 'CB', 'Central Defender']) {
    assert.equal(categorizePosition(pos), 'defenders');
    assert.equal(translatePosition(pos), 'قلب دفاع');
  }
  for (const pos of ['Left Back', 'Left-Back', 'LB', 'Left Wing-Back', 'LWB']) {
    assert.equal(categorizePosition(pos), 'defenders');
    assert.equal(translatePosition(pos), 'ظهير أيسر');
  }
  for (const pos of ['Right Back', 'Right-Back', 'RB', 'Right Wing-Back', 'RWB']) {
    assert.equal(categorizePosition(pos), 'defenders');
    assert.equal(translatePosition(pos), 'ظهير أيمن');
  }

  // Goalkeepers & Strikers / Center Forwards
  for (const pos of ['Goalkeeper', 'GK', 'G']) {
    assert.equal(categorizePosition(pos), 'goalkeepers');
    assert.equal(translatePosition(pos), 'حارس مرمى');
  }
  for (const pos of ['Center Forward', 'Centre Forward', 'CF']) {
    assert.equal(categorizePosition(pos), 'forwards');
    assert.equal(translatePosition(pos), 'مهاجم صريح');
  }
  assert.equal(categorizePosition('ST'), 'forwards');
  assert.equal(translatePosition('ST'), 'رأس حربة');

  // ESPN single-letter abbreviations & position objects
  assert.equal(categorizePosition('D'), 'defenders');
  assert.equal(categorizePosition('M'), 'midfielders');
  assert.equal(categorizePosition('F'), 'forwards');
  assert.equal(categorizePosition({ abbreviation: 'CDM' }), 'midfielders');
  assert.equal(translatePosition({ abbreviation: 'CDM' }), 'وسط دفاعي');

  // Missing / Unknown / Ambiguous -> other without guessing
  assert.equal(categorizePosition(''), 'other');
  assert.equal(categorizePosition(null), 'other');
  assert.equal(categorizePosition('Utility Player'), 'other');
  assert.equal(translatePosition(''), 'لاعب');
  assert.equal(translatePosition('Utility Player'), 'Utility Player');

  // Egyptian mock players preserve their existing position groups
  const ahlyRoster = await getTeamRoster('egypt.1', 'egy-team-ahly');
  assert.equal(ahlyRoster.filter((p) => p.positionGroup === 'goalkeepers').length, 1);
  assert.equal(ahlyRoster.filter((p) => p.positionGroup === 'defenders').length, 4);
  assert.equal(ahlyRoster.filter((p) => p.positionGroup === 'midfielders').length, 3);
  assert.equal(ahlyRoster.filter((p) => p.positionGroup === 'forwards').length, 3);
});
