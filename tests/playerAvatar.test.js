import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isValidPlayerPhotoUrl,
  resolvePlayerPhoto,
  getPlayerInitials,
  getAvatarRenderState
} from '../src/utils/playerAvatar.js';
import { getTeamRoster } from '../src/services/teamsService.js';

const withMockFetch = async (mockImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('isValidPlayerPhotoUrl and resolvePlayerPhoto accept official ESPN headshots and reject unsafe or guessed URLs', () => {
  const validEspn = 'https://a.espncdn.com/i/headshots/soccer/players/full/282716.png';
  assert.equal(isValidPlayerPhotoUrl(validEspn), true);
  assert.equal(resolvePlayerPhoto({ id: '282716', headshot: { href: `  ${validEspn}  ` } }), validEspn);

  // Missing photo must return '' and NEVER invent an ESPN CDN URL from athlete.id
  assert.equal(resolvePlayerPhoto({ id: '196176', displayName: 'David Raya' }), '');
  assert.equal(resolvePlayerPhoto({ id: '196876', headshot: null }), '');
  assert.equal(resolvePlayerPhoto(''), '');
  assert.equal(resolvePlayerPhoto(null), '');

  // Unsafe, non-HTTPS, untrusted, or non-portrait logo URLs rejected
  const invalidUrls = [
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'http://a.espncdn.com/i/headshots/soccer/players/full/282716.png',
    'https://evil.example.com/headshots/282716.png',
    'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
    'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png',
    'https://a.espncdn.com/i/headshots/soccer/players/full/nophoto.png',
    '/relative/path.png'
  ];
  for (const url of invalidUrls) {
    assert.equal(isValidPlayerPhotoUrl(url), false, `expected invalid: ${url}`);
    assert.equal(resolvePlayerPhoto(url), '', `expected empty for: ${url}`);
  }
});

test('getPlayerInitials handles Arabic, English, accented, single-word, and empty names cleanly', () => {
  // Arabic names (separated by space so letters do not join into ligatures)
  assert.equal(getPlayerInitials('مصطفى شوبير'), 'م ش');
  assert.equal(getPlayerInitials('وسام أبو علي'), 'و ع');
  assert.equal(getPlayerInitials('مابولولو'), 'م');

  // English & accented Latin names
  assert.equal(getPlayerInitials('Mohamed Salah'), 'MS');
  assert.equal(getPlayerInitials('Jurriën Timber'), 'JT');
  assert.equal(getPlayerInitials('Virgil van Dijk'), 'VD');
  assert.equal(getPlayerInitials('Pedri'), 'P');

  // Empty / invalid inputs
  assert.equal(getPlayerInitials(''), 'ل');
  assert.equal(getPlayerInitials('   '), 'ل');
  assert.equal(getPlayerInitials(null), 'ل');
});

test('getAvatarRenderState falls back on image error and resets immediately when playerId or photo changes', () => {
  const photoA = 'https://a.espncdn.com/i/headshots/soccer/players/full/282716.png';
  const photoB = 'https://a.espncdn.com/i/headshots/soccer/players/full/293236.png';

  // Initial valid photo renders image
  const initial = getAvatarRenderState({ playerId: '282716', photo: photoA, failedKey: null });
  assert.equal(initial.showImage, true);
  assert.equal(initial.validPhoto, photoA);

  // After onError records failedKey, falls back to initials (never empty circle)
  const failed = getAvatarRenderState({ playerId: '282716', photo: photoA, failedKey: initial.avatarKey });
  assert.equal(failed.showImage, false);

  // Switching to another player resets failure state automatically
  const switchedPlayer = getAvatarRenderState({ playerId: '293236', photo: photoB, failedKey: initial.avatarKey });
  assert.equal(switchedPlayer.showImage, true);

  // Updating photo URL on same player also resets failure state
  const updatedUrl = getAvatarRenderState({ playerId: '282716', photo: photoB, failedKey: initial.avatarKey });
  assert.equal(updatedUrl.showImage, true);

  // Missing or invalid URL skips image entirely
  const missing = getAvatarRenderState({ playerId: '196176', photo: '', failedKey: null });
  assert.equal(missing.showImage, false);
});

test('getTeamRoster sanitizes unsafe photo URLs while preserving valid headshots and Egyptian mock roster', async () => {
  const roster = await withMockFetch(async () => ({
    ok: true,
    json: async () => ({
      athletes: [
        {
          id: '282716',
          displayName: 'Jurriën Timber',
          jersey: '12',
          position: { displayName: 'Defender' },
          headshot: { href: 'https://a.espncdn.com/i/headshots/soccer/players/full/282716.png' }
        },
        {
          id: '196176',
          displayName: 'David Raya',
          jersey: '1',
          position: { displayName: 'Goalkeeper' }
        },
        {
          id: '999999',
          displayName: 'Unsafe Photo Player',
          jersey: '99',
          position: { displayName: 'Forward' },
          headshot: { href: 'javascript:alert(1)' }
        }
      ]
    })
  }), () => getTeamRoster('eng.1', '359999'));

  assert.equal(roster.length, 3);
  assert.equal(roster[0].photo, 'https://a.espncdn.com/i/headshots/soccer/players/full/282716.png');
  assert.equal(roster[1].photo, '');
  assert.equal(roster[2].photo, '');

  // Egyptian mock team roster preserved with empty photo and Arabic initials
  const ahlyRoster = await getTeamRoster('egypt.1', 'egy-team-ahly');
  assert.equal(ahlyRoster.length, 11);
  assert.equal(ahlyRoster.every((p) => p.photo === ''), true);
  assert.equal(getPlayerInitials(ahlyRoster[0].name), 'م ش');
});

test('TeamPage uses PlayerAvatar across all 5 roster groups including other players with lazy loading', () => {
  const teamPageSrc = readFileSync(new URL('../src/pages/TeamPage.jsx', import.meta.url), 'utf8');
  const avatarSrc = readFileSync(new URL('../src/components/PlayerAvatar.jsx', import.meta.url), 'utf8');

  const avatarUsages = teamPageSrc.match(/<PlayerAvatar\b/g) || [];
  assert.equal(avatarUsages.length, 5, 'PlayerAvatar must be used in all 5 roster groups (GK, DEF, MID, FWD, OTHER)');
  assert.equal(teamPageSrc.includes('className="player-photo"'), false, 'TeamPage should delegate player photos to PlayerAvatar');

  assert.equal(avatarSrc.includes('loading="lazy"'), true);
  assert.equal(avatarSrc.includes('decoding="async"'), true);
  assert.equal(avatarSrc.includes("e.target.style.display = 'none'"), false);
});
