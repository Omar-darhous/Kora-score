import { cachedJson } from './requestCache.js';
import { parseMatchResult, resolveEspnMatchStatus } from './matchResult.js';
import { classifyRound, rounds } from './tournamentRules.js';
import { getMockEgyptianMatchDetails } from './egyptianMockService.js';
import { resolveLeagueLogo, resolveTeamLogo } from './logoUtils.js';

// ترجمة الأدوار الإقصائية إلى العربية
export const mapKnockoutStage = (slug) => {
  if (/relegation.*playoff|promotion.*playoff/i.test(slug || '')) return 'ملحق الصعود والهبوط';
  const key = classifyRound(slug);
  if (key) return rounds.find(([id]) => id === key)?.[1] || null;
  return /group|league.phase|^league-[a-d]$/i.test(slug || '') ? 'مرحلة المجموعات / الدوري' : null;
};

// ترجمة الجولات الأسبوعية إلى العربية
export const translateRoundText = (text) => {
  if (!text) return '';
  const match = text.match(/\d+/);
  if (match) {
    const num = match[0];
    const lower = text.toLowerCase();
    if (lower.includes('matchday') || lower.includes('round') || lower.includes('jornada') || lower.includes('giornata')) {
      return `الجولة ${num}`;
    }
    if (lower.includes('week') || lower.includes('semaine')) {
      return `الأسبوع ${num}`;
    }
  }
  return text;
};

export const normalizeScoreboardMatches = (data, league, dateStr) => {
  let fallbackRound = '';
  const calendar = data.leagues?.[0]?.calendar || [];
  if (calendar.length > 0) {
    const formattedTargetDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    const foundIdx = calendar.findIndex(c => {
      if (typeof c === 'string') {
        return c.startsWith(formattedTargetDate);
      } else if (c && typeof c === 'object' && typeof c.date === 'string') {
        return c.date.startsWith(formattedTargetDate);
      }
      return false;
    });
    if (foundIdx !== -1) {
      const item = calendar[foundIdx];
      if (item && typeof item === 'object' && item.label) {
        fallbackRound = translateRoundText(item.label);
      } else {
        fallbackRound = `الجولة ${foundIdx + 1}`;
      }
    }
  }

  const events = data.events || [];
  return events.map(event => {
    const comp = event.competitions?.[0] || {};
    const homeCompetitor = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayCompetitor = comp.competitors?.find(c => c.homeAway === 'away') || {};

    const eventStatus = event.status || comp.status;
    const statusStr = resolveEspnMatchStatus(eventStatus);
    const hasPlayedScore = statusStr === 'FT' || statusStr === 'LIVE';
    const parsePlayedScore = (raw) => {
      if (!hasPlayedScore) return null;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    };

    const matchTime = new Date(event.date).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let roundName = '';
    const seasonSlug = event.season?.slug || '';
    const altNote = comp.altGameNote || '';

    const knockout = mapKnockoutStage(seasonSlug) || mapKnockoutStage(altNote);
    if (knockout) {
      roundName = knockout;
    } else if (comp.notes && comp.notes.length > 0) {
      roundName = translateRoundText(comp.notes[0]?.text || '');
    }

    if (!roundName) {
      roundName = fallbackRound || 'الدوري المنتظم';
    }

    return {
      id: event.id,
      leagueId: league.id,
      leagueName: league.name,
      leagueLogo: resolveLeagueLogo(data.leagues?.[0], league.logo),
      homeTeam: homeCompetitor.team?.displayName || 'فريق مستضيف',
      homeLogo: resolveTeamLogo(homeCompetitor.team),
      homeScore: parsePlayedScore(homeCompetitor.score),
      homeTeamId: homeCompetitor.team?.id,
      awayTeam: awayCompetitor.team?.displayName || 'فريق ضيف',
      awayLogo: resolveTeamLogo(awayCompetitor.team),
      awayScore: parsePlayedScore(awayCompetitor.score),
      awayTeamId: awayCompetitor.team?.id,
      status: statusStr,
      ...parseMatchResult(eventStatus, comp.competitors),
      minute: event.status?.displayClock ? event.status.displayClock.replace("'", "") : event.status?.clock || 0,
      time: matchTime,
      roundName,
      detailsLoaded: false
    };
  });
};

export const fetchLeagueMatches = async (league, dateStr, { forceRefresh = false, signal } = {}) => {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard?dates=${dateStr}`;
  const data = await cachedJson(url, { ttl: 15000, forceRefresh, signal });
  return normalizeScoreboardMatches(data, league, dateStr);
};

// جلب تفاصيل المباراة الكاملة
export const getMatchDetails = async (leagueId, eventId) => {
  if (leagueId === 'egypt.1') {
    return getMockEgyptianMatchDetails(eventId);
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${eventId}`;
    const summary = await cachedJson(url, { ttl: 15000 });

    const boxscore = summary.boxscore || {};
    const homeTeamId = boxscore.teams?.[0]?.team?.id;

    const statsObj = {
      possession: [50, 50],
      shots: [0, 0],
      shotsOnGoal: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
      redCards: [0, 0]
    };

    if (boxscore.teams && boxscore.teams.length >= 2) {
      const homeStats = boxscore.teams[0].statistics || [];
      const awayStats = boxscore.teams[1].statistics || [];

      const getStatVal = (statsList, name) => {
        const item = statsList.find(s => s.name === name);
        return item ? parseFloat(item.displayValue) || 0 : 0;
      };

      statsObj.possession = [getStatVal(homeStats, 'possessionPct') || 50, getStatVal(awayStats, 'possessionPct') || 50];
      statsObj.shots = [getStatVal(homeStats, 'totalShots') || 0, getStatVal(awayStats, 'totalShots') || 0];
      statsObj.shotsOnGoal = [getStatVal(homeStats, 'shotsOnTarget') || 0, getStatVal(awayStats, 'shotsOnTarget') || 0];
      statsObj.corners = [getStatVal(homeStats, 'wonCorners') || 0, getStatVal(awayStats, 'wonCorners') || 0];
      statsObj.fouls = [getStatVal(homeStats, 'foulsCommitted') || 0, getStatVal(awayStats, 'foulsCommitted') || 0];
      statsObj.yellowCards = [getStatVal(homeStats, 'yellowCards') || 0, getStatVal(awayStats, 'yellowCards') || 0];
      statsObj.redCards = [getStatVal(homeStats, 'redCards') || 0, getStatVal(awayStats, 'redCards') || 0];
    }

    const events = [];
    if (summary.keyEvents) {
      summary.keyEvents.forEach(evt => {
        const typeText = evt.type?.text?.toLowerCase() || '';
        let type = '';
        let cardType = '';

        if (typeText.includes('goal')) {
          type = 'goal';
        } else if (typeText.includes('yellow card')) {
          type = 'card';
          cardType = 'yellow';
        } else if (typeText.includes('red card')) {
          type = 'card';
          cardType = 'red';
        }

        if (type) {
          events.push({
            type,
            cardType,
            time: evt.clock?.displayValue ? evt.clock.displayValue.replace("'", "") : evt.clock?.value || 0,
            team: evt.team?.id === homeTeamId ? 'home' : 'away',
            player: evt.text || 'حدث في اللقاء',
            assist: 'مجهود فردي'
          });
        }
      });
    }

    const lineups = { home: [], away: [] };
    if (summary.rosters && summary.rosters['0'] && summary.rosters['1']) {
      const roster0 = summary.rosters['0'] || {};
      const roster1 = summary.rosters['1'] || {};

      const mapRoster = (teamRoster) => {
        return (teamRoster.roster || [])
          .filter(p => p.starter)
          .map(p => p.athlete?.displayName || 'لاعب');
      };

      if (roster0.team?.id === homeTeamId) {
        lineups.home = mapRoster(roster0);
        lineups.away = mapRoster(roster1);
      } else {
        lineups.home = mapRoster(roster1);
        lineups.away = mapRoster(roster0);
      }
    }

    const competition = summary.header?.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home');
    const away = competition?.competitors?.find(c => c.homeAway === 'away');
    const detailStatus = competition ? resolveEspnMatchStatus(competition.status) : 'NS';
    const detailHasScore = detailStatus === 'FT' || detailStatus === 'LIVE';
    const match = competition && home && away ? {
      id: String(eventId), leagueId,
      homeTeam: home.team?.displayName, awayTeam: away.team?.displayName,
      homeLogo: home.team?.logo || home.team?.logos?.[0]?.href,
      awayLogo: away.team?.logo || away.team?.logos?.[0]?.href,
      homeScore: detailHasScore ? Number(home.score?.value ?? home.score ?? 0) : null,
      awayScore: detailHasScore ? Number(away.score?.value ?? away.score ?? 0) : null,
      status: detailStatus,
      ...parseMatchResult(competition.status, competition.competitors)
    } : null;
    return {
      match,
      stats: statsObj,
      events: events.sort((a, b) => b.time - a.time),
      lineups
    };
  } catch (e) {
    console.error('Failed to load match details:', e);
    return null;
  }
};
