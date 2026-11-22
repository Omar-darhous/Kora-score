/**
 * أدوات مساعدة آمنة للتنقل إلى صفحات الأندية من داخل تفاصيل المباراة أو أي مدخل آخر.
 */

export const isValidTeamNavigationId = (teamId) => {
  if (teamId === null || teamId === undefined || typeof teamId === 'boolean') {
    return false;
  }
  const clean = String(teamId).trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  return lower !== 'null' && lower !== 'undefined' && lower !== 'nan';
};

export const normalizeTeamNavigationId = (teamId) => {
  if (!isValidTeamNavigationId(teamId)) return null;
  return String(teamId).trim();
};

export const buildTeamRoute = (teamId, leagueId = '') => {
  const cleanTeamId = normalizeTeamNavigationId(teamId);
  if (!cleanTeamId) return null;

  const basePath = `/team/${encodeURIComponent(cleanTeamId)}`;
  const cleanLeagueId = typeof leagueId === 'string' ? leagueId.trim() : '';

  if (cleanLeagueId && cleanLeagueId.toLowerCase() !== 'null' && cleanLeagueId.toLowerCase() !== 'undefined') {
    return `${basePath}?league=${encodeURIComponent(cleanLeagueId)}`;
  }

  return basePath;
};

export const buildTeamNavigationState = ({ teamId, teamName = '', teamLogo = '', leagueId = '' } = {}) => {
  const cleanTeamId = normalizeTeamNavigationId(teamId);
  if (!cleanTeamId) return null;

  const cleanLeagueId = typeof leagueId === 'string' ? leagueId.trim() : '';
  return {
    leagueId: cleanLeagueId || undefined,
    team: {
      teamId: cleanTeamId,
      team: String(teamName || '').trim(),
      logo: String(teamLogo || '').trim()
    }
  };
};

export const resolveMatchSideTeamId = (match, details, side) => {
  if (side === 'home') {
    return (
      normalizeTeamNavigationId(match?.homeTeamId) ||
      normalizeTeamNavigationId(details?.match?.homeTeamId) ||
      normalizeTeamNavigationId(details?.rosters?.home?.teamId) ||
      null
    );
  }
  if (side === 'away') {
    return (
      normalizeTeamNavigationId(match?.awayTeamId) ||
      normalizeTeamNavigationId(details?.match?.awayTeamId) ||
      normalizeTeamNavigationId(details?.rosters?.away?.teamId) ||
      null
    );
  }
  return null;
};

export const lockBodyScroll = (doc = typeof document !== 'undefined' ? document : null) => {
  if (!doc?.body) return;
  doc.body.classList.add('modal-open');
  doc.body.style.overflow = 'hidden';
};

export const releaseBodyScrollLock = (doc = typeof document !== 'undefined' ? document : null) => {
  if (!doc?.body) return;
  doc.body.classList.remove('modal-open');
  doc.body.style.overflow = '';
  if (doc.documentElement?.style) {
    doc.documentElement.style.overflow = '';
  }
};
