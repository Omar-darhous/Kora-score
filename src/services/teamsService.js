import { cachedJson } from './requestCache.js';
import { parseMatchResult } from './matchResult.js';
import { resolveTeamLogo } from './logoUtils.js';
import {
  getEgyptianTeamDetails,
  getEgyptianTeamRoster,
  getEgyptianTeamSchedule
} from './egyptianMockService.js';

export const categorizePosition = (posName = '') => {
  const p = (posName || '').toLowerCase();
  if (p.includes('goal') || p.includes('keeper')) return 'goalkeepers';
  if (p.includes('defen') || p.includes('back')) return 'defenders';
  if (p.includes('midfield')) return 'midfielders';
  if (p.includes('forward') || p.includes('striker') || p.includes('winger') || p.includes('att')) return 'forwards';
  return 'other';
};

export const translatePosition = (posName = '') => {
  const p = (posName || '').toLowerCase();
  if (p.includes('goal') || p.includes('keeper')) return 'حارس مرمى';
  if (p.includes('center-back') || p.includes('central defender')) return 'قلب دفاع';
  if (p.includes('left-back') || p.includes('left back')) return 'ظهير أيسر';
  if (p.includes('right-back') || p.includes('right back')) return 'ظهير أيمن';
  if (p.includes('defen') || p.includes('back')) return 'مدافع';
  if (p.includes('defensive midfield')) return 'وسط دفاعي';
  if (p.includes('attacking midfield')) return 'وسط هجومي';
  if (p.includes('midfield')) return 'لاعب وسط';
  if (p.includes('left wing')) return 'جناح أيسر';
  if (p.includes('right wing')) return 'جناح أيمن';
  if (p.includes('striker') || p.includes('center forward')) return 'رأس حربة';
  if (p.includes('forward') || p.includes('att')) return 'مهاجم';
  return posName || 'لاعب';
};

// جلب تفاصيل وهوية النادي
export const getTeamDetails = async (teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return null;
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return getEgyptianTeamDetails(cleanId);
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/teams/${cleanId}`;
    const data = await cachedJson(url, { ttl: 300000 });
    const t = data.team;
    if (!t) return null;

    return {
      id: String(t.id || cleanId),
      name: t.displayName || t.name || 'فريق كروي',
      shortName: t.shortDisplayName || t.displayName || '',
      abbreviation: t.abbreviation || '',
      logo: resolveTeamLogo(t, ''),
      venue: t.venue ? {
        name: t.venue.fullName || '',
        capacity: t.venue.capacity || null,
        city: t.venue.address?.city || ''
      } : null,
      defaultLeague: t.defaultLeague ? {
        id: t.defaultLeague.id,
        name: t.defaultLeague.name,
        midsizeName: t.defaultLeague.midsizeName
      } : null
    };
  } catch (err) {
    console.error(`Failed to fetch details for team ${cleanId}:`, err);
    return null;
  }
};

// جلب نتائج ومباريات النادي الأخيرة
export const getTeamSchedule = async (leagueId, teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return [];
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return getEgyptianTeamSchedule(cleanId);
  }

  if (!leagueId) {
    return [];
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams/${cleanId}/schedule`;
    const data = await cachedJson(url, { ttl: 15000 });
    const events = data.events || [];

    return events.map(event => {
      const comp = event.competitions?.[0] || {};
      const competitors = comp.competitors || [];
      const homeComp = competitors.find(c => c.homeAway === 'home') || {};
      const awayComp = competitors.find(c => c.homeAway === 'away') || {};

      const isHome = String(homeComp.id || homeComp.team?.id) === cleanId;
      const teamComp = isHome ? homeComp : awayComp;
      const opponentComp = isHome ? awayComp : homeComp;

      const homeScore = parseInt(homeComp.score?.value ?? homeComp.score?.displayValue ?? homeComp.score ?? 0, 10);
      const awayScore = parseInt(awayComp.score?.value ?? awayComp.score?.displayValue ?? awayComp.score ?? 0, 10);
      const teamScore = isHome ? homeScore : awayScore;
      const opponentScore = isHome ? awayScore : homeScore;

      let result = 'D';
      if (teamComp.winner === true) {
        result = 'W';
      } else if (opponentComp.winner === true) {
        result = 'L';
      } else if (teamScore > opponentScore) {
        result = 'W';
      } else if (teamScore < opponentScore) {
        result = 'L';
      }

      const eventStatus = event.status || comp.status;
      let status = 'FT';
      if (eventStatus?.type?.state === 'in') {
        status = 'LIVE';
      } else if (eventStatus?.type?.state === 'pre') {
        status = 'NS';
      }

      return {
        id: event.id,
        leagueId,
        date: event.date,
        name: event.name || `${homeComp.team?.displayName || ''} ضد ${awayComp.team?.displayName || ''}`,
        homeTeam: homeComp.team?.displayName || 'فريق مستضيف',
        awayTeam: awayComp.team?.displayName || 'فريق ضيف',
        homeScore,
        awayScore,
        isHome,
        opponentName: opponentComp.team?.displayName || '',
        opponentLogo: resolveTeamLogo(opponentComp.team, ''),
        result,
        status,
        ...parseMatchResult(event.status || comp.status, competitors),
        rawEvent: event
      };
    });
  } catch (err) {
    console.error(`Failed to fetch schedule for team ${cleanId} in league ${leagueId}:`, err);
    return [];
  }
};

// جلب قائمة لاعبي النادي
export const getTeamRoster = async (leagueId, teamId) => {
  if (!teamId || teamId === 'null' || teamId === 'undefined') {
    return [];
  }
  const cleanId = String(teamId).trim();
  if (cleanId.startsWith('egy-team-')) {
    return getEgyptianTeamRoster(cleanId);
  }

  if (!leagueId) {
    return [];
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/teams/${cleanId}/roster`;
    const data = await cachedJson(url, { ttl: 300000 });
    const athletes = data.athletes || [];

    return athletes.map(a => {
      const posName = a.position?.displayName || a.position?.name || '';
      return {
        id: String(a.id || Math.random()),
        name: a.displayName || a.fullName || 'لاعب',
        jersey: a.jersey ? String(a.jersey) : '',
        position: translatePosition(posName),
        positionGroup: categorizePosition(posName),
        citizenship: a.citizenship || '',
        photo: a.headshot?.href || ''
      };
    });
  } catch (err) {
    console.error(`Failed to fetch roster for team ${cleanId} in league ${leagueId}:`, err);
    return [];
  }
};
