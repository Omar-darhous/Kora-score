import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEAM_LOGO,
  isValidLogoUrl,
  resolveLeagueLogo,
  resolveTeamLogo,
  getLeagues
} from '../src/services/logoUtils.js';
import * as footballService from '../src/services/footballService.js';

test('isValidLogoUrl validates entity-specific URLs and rejects broken or unsafe paths', () => {
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/leaguelogos/soccer/500/23.png', 'league'), true);
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/teamlogos/soccer/500/364.png', 'team'), true);

  // Reject broken legacy paths
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/league-logos/soccer/500/23.png', 'league'), false);
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/teamlogos/default-soccer.png', 'team'), false);
  assert.equal(isValidLogoUrl('https://upload.wikimedia.org/Egyptian_Premier_League_logo.png', 'league'), false);

  // Reject cross-entity confusion
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/teamlogos/soccer/500/364.png', 'league'), false);
  assert.equal(isValidLogoUrl('https://a.espncdn.com/i/leaguelogos/soccer/500/23.png', 'team'), false);

  // Reject invalid / non-http values
  assert.equal(isValidLogoUrl('', 'team'), false);
  assert.equal(isValidLogoUrl(null, 'team'), false);
  assert.equal(isValidLogoUrl('javascript:alert(1)', 'team'), false);
});

test('resolveLeagueLogo prefers official API logo, falls back safely, and keeps Egyptian league empty', () => {
  assert.equal(
    resolveLeagueLogo(
      { logos: [{ href: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png' }] },
      'https://a.espncdn.com/i/leaguelogos/soccer/500/15.png'
    ),
    'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png'
  );

  // Falls back when API returns a broken or team-logo path
  assert.equal(
    resolveLeagueLogo(
      { logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' },
      'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png'
    ),
    'https://a.espncdn.com/i/leaguelogos/soccer/500/2488.png'
  );

  // Egyptian league fallback remains empty string
  const leagues = getLeagues();
  const egypt = leagues.find(l => l.id === 'egypt.1');
  assert.equal(egypt.logo, '');
  assert.equal(resolveLeagueLogo(null, egypt.logo), '');
});

test('resolveTeamLogo resolves valid team logos and falls back to DEFAULT_TEAM_LOGO safely', () => {
  assert.equal(
    resolveTeamLogo({ logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' }),
    'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'
  );
  assert.equal(
    resolveTeamLogo({ logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png' }] }),
    'https://a.espncdn.com/i/teamlogos/soccer/500/86.png'
  );
  assert.equal(resolveTeamLogo({ logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/23.png' }), DEFAULT_TEAM_LOGO);
  assert.equal(resolveTeamLogo(null), DEFAULT_TEAM_LOGO);
  assert.equal(resolveTeamLogo(null, ''), '');
});

test('footballService re-exports logo utilities and getLeagues with exact backward compatibility', () => {
  assert.equal(footballService.DEFAULT_TEAM_LOGO, DEFAULT_TEAM_LOGO);
  assert.equal(footballService.resolveLeagueLogo, resolveLeagueLogo);
  assert.equal(footballService.resolveTeamLogo, resolveTeamLogo);
  assert.equal(footballService.getLeagues, getLeagues);

  const leagues = footballService.getLeagues();
  assert.equal(leagues.length, 16);
  assert.deepEqual(
    leagues.map(l => l.id),
    ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'ksa.1', 'egypt.1', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf', 'fifa.world', 'caf.nations', 'uefa.euro', 'conmebol.america', 'afc.asian.cup', 'usa.1']
  );
});
