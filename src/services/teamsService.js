import { cachedJson } from './requestCache.js';
import { parseMatchResult, getTeamMatchOutcome, resolveEspnMatchStatus } from './matchResult.js';
import { resolveTeamLogo } from './logoUtils.js';
import { resolvePlayerPhoto } from '../utils/playerAvatar.js';
import {
  getEgyptianTeamDetails,
  getEgyptianTeamRoster,
  getEgyptianTeamSchedule
} from './egyptianMockService.js';

const extractPositionString = (posInput = '') => {
  if (typeof posInput === 'string') return posInput.trim();
  if (posInput && typeof posInput === 'object') {
    return String(posInput.displayName || posInput.name || posInput.abbreviation || '').trim();
  }
  return '';
};

const normalizePositionText = (raw) => raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

const GOALKEEPER_ABBR = new Set(['GK', 'G']);
const MIDFIELDER_ABBR = new Set(['CDM', 'DM', 'CAM', 'AM', 'CM', 'LM', 'RM', 'M', 'MF', 'MID']);
const DEFENDER_ABBR = new Set(['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW', 'D', 'DF', 'DEF']);
const FORWARD_ABBR = new Set(['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'SS', 'F', 'FW', 'FWD', 'ATT']);

export const categorizePosition = (posInput = '') => {
  const raw = extractPositionString(posInput);
  if (!raw) return 'other';

  const upper = raw.toUpperCase();
  const p = normalizePositionText(raw);

  // 1. Goalkeepers
  if (GOALKEEPER_ABBR.has(upper) || p.includes('goal') || p.includes('keeper')) {
    return 'goalkeepers';
  }

  // 2. Midfielders (MUST precede defender/attacker checks so "Defensive/Attacking Midfielder" stays midfielder)
  if (MIDFIELDER_ABBR.has(upper) || p.includes('midfield')) {
    return 'midfielders';
  }

  // 3. Defenders (MUST precede winger check so "Wing-Back" stays defender)
  if (
    DEFENDER_ABBR.has(upper) ||
    p.includes('wing back') ||
    p.includes('wingback') ||
    p.includes('center back') ||
    p.includes('centre back') ||
    p.includes('full back') ||
    p.includes('fullback') ||
    p.includes('left back') ||
    p.includes('right back') ||
    p.includes('sweeper') ||
    p.includes('defen') ||
    /\bback\b/.test(p)
  ) {
    return 'defenders';
  }

  // 4. Forwards & Wingers
  if (
    FORWARD_ABBR.has(upper) ||
    p.includes('forward') ||
    p.includes('striker') ||
    p.includes('winger') ||
    p.includes('left wing') ||
    p.includes('right wing') ||
    /\bwing\b/.test(p) ||
    p.includes('attack')
  ) {
    return 'forwards';
  }

  return 'other';
};

export const translatePosition = (posInput = '') => {
  const raw = extractPositionString(posInput);
  if (!raw) return 'لاعب';

  const upper = raw.toUpperCase();
  const p = normalizePositionText(raw);

  // 1. Goalkeeper
  if (GOALKEEPER_ABBR.has(upper) || p.includes('goal') || p.includes('keeper')) {
    return 'حارس مرمى';
  }

  // 2. Specific Midfielders BEFORE broad defender/attacker matches
  if (upper === 'CDM' || upper === 'DM' || p.includes('defensive midfield') || p.includes('holding midfield')) {
    return 'وسط دفاعي';
  }
  if (upper === 'CAM' || upper === 'AM' || p.includes('attacking midfield')) {
    return 'وسط هجومي';
  }
  if (upper === 'CM' || p.includes('central midfield')) {
    return 'وسط مركزي';
  }
  if (upper === 'LM' || p.includes('left midfield')) {
    return 'وسط أيسر';
  }
  if (upper === 'RM' || p.includes('right midfield')) {
    return 'وسط أيمن';
  }
  if (MIDFIELDER_ABBR.has(upper) || p.includes('midfield')) {
    return 'لاعب وسط';
  }

  // 3. Specific Defenders BEFORE broad wing matches
  if (upper === 'LWB' || p.includes('left wing back') || p.includes('left wingback') || upper === 'LB' || p.includes('left back')) {
    return 'ظهير أيسر';
  }
  if (upper === 'RWB' || p.includes('right wing back') || p.includes('right wingback') || upper === 'RB' || p.includes('right back')) {
    return 'ظهير أيمن';
  }
  if (upper === 'CB' || p.includes('center back') || p.includes('centre back') || p.includes('central defender')) {
    return 'قلب دفاع';
  }
  if (DEFENDER_ABBR.has(upper) || p.includes('defen') || /\bback\b/.test(p) || p.includes('sweeper')) {
    return 'مدافع';
  }

  // 4. Specific Forwards & Wingers
  if (upper === 'LW' || p.includes('left wing') || p.includes('left winger')) {
    return 'جناح أيسر';
  }
  if (upper === 'RW' || p.includes('right wing') || p.includes('right winger')) {
    return 'جناح أيمن';
  }
  if (p.includes('winger') || /\bwing\b/.test(p)) {
    return 'جناح';
  }
  if (upper === 'CF' || p.includes('center forward') || p.includes('centre forward')) {
    return 'مهاجم صريح';
  }
  if (upper === 'ST' || p.includes('striker')) {
    return 'رأس حربة';
  }
  if (FORWARD_ABBR.has(upper) || p.includes('forward') || p.includes('attack')) {
    return 'مهاجم';
  }

  return raw;
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

      const homeTeamId = String(homeComp.team?.id ?? homeComp.id ?? '').trim();
      const awayTeamId = String(awayComp.team?.id ?? awayComp.id ?? '').trim();
      const isHome = homeTeamId === cleanId;
      const opponentComp = isHome ? awayComp : homeComp;

      const eventStatus = event.status || comp.status;
      const status = resolveEspnMatchStatus(eventStatus);
      const hasPlayedScore = status === 'FT' || status === 'LIVE';

      const parseOptionalScore = (raw) => {
        if (!hasPlayedScore) return null;
        const val = raw?.value ?? raw?.displayValue ?? raw;
        if (val === null || val === undefined || val === '') return null;
        const parsed = Number(val);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const homeScore = parseOptionalScore(homeComp.score);
      const awayScore = parseOptionalScore(awayComp.score);

      const parsedResult = parseMatchResult(eventStatus, competitors);
      const baseItem = {
        id: event.id,
        leagueId,
        date: event.date,
        name: event.name || `${homeComp.team?.displayName || ''} ضد ${awayComp.team?.displayName || ''}`,
        homeTeamId,
        awayTeamId,
        homeTeam: homeComp.team?.displayName || 'فريق مستضيف',
        awayTeam: awayComp.team?.displayName || 'فريق ضيف',
        homeScore,
        awayScore,
        isHome,
        opponentName: opponentComp.team?.displayName || '',
        opponentLogo: resolveTeamLogo(opponentComp.team, ''),
        status,
        ...parsedResult,
        rawEvent: event
      };

      const outcome = getTeamMatchOutcome(baseItem, cleanId);
      const result = outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : outcome === 'draw' ? 'D' : null;

      return {
        ...baseItem,
        outcome,
        result
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
      const posName = a.position?.displayName || a.position?.name || a.position?.abbreviation || '';
      return {
        id: String(a.id || Math.random()),
        name: a.displayName || a.fullName || 'لاعب',
        jersey: a.jersey ? String(a.jersey) : '',
        position: translatePosition(posName),
        positionGroup: categorizePosition(posName),
        citizenship: a.citizenship || '',
        photo: resolvePlayerPhoto(a)
      };
    });
  } catch (err) {
    console.error(`Failed to fetch roster for team ${cleanId} in league ${leagueId}:`, err);
    return [];
  }
};
