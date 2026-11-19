import { LEAGUES } from './mockData.js';

export const DEFAULT_TEAM_LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo-500.png';

export const isValidLogoUrl = (url, entityType = 'team') => {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) return false;
  if (
    clean.includes('/i/league-logos/') ||
    clean.includes('/teamlogos/default-soccer.png') ||
    clean.includes('Egyptian_Premier_League_logo.png')
  ) {
    return false;
  }
  if (entityType === 'league' && clean.includes('/i/teamlogos/')) return false;
  if (entityType === 'team' && clean.includes('/i/leaguelogos/')) return false;
  return true;
};

export const resolveLeagueLogo = (apiLeague, fallbackLogo = '') => {
  const candidates = [apiLeague?.logos?.[0]?.href, apiLeague?.logo, fallbackLogo];
  return candidates.find((url) => isValidLogoUrl(url, 'league')) || '';
};

export const resolveTeamLogo = (team, fallbackLogo = DEFAULT_TEAM_LOGO) => {
  const candidates = [team?.logo, team?.logos?.[0]?.href];
  const valid = candidates.find((url) => isValidLogoUrl(url, 'team'));
  if (valid) return valid;
  return isValidLogoUrl(fallbackLogo, 'team') ? fallbackLogo : '';
};

export const getLeagues = () => {
  return LEAGUES;
};
