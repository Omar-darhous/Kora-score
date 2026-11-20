import { cachedJson } from './requestCache.js';
import { parseMatchResult } from './matchResult.js';
import { classifyRound, rounds, isUefaClubTournament } from './tournamentRules.js';

// جلب تفاصيل مباريات الأدوار الإقصائية لكأس العالم وترتيبها في هيكل الشجرة
export const getTournamentKnockouts = async (leagueId, seasonYear) => {
  const year = Number(seasonYear);
  if (!Number.isInteger(year) || year < 1900) throw new Error('Season unavailable');
  // European club seasons, AFCON editions, and EURO 2020 (played in 2021) can span into year + 1.
  const years = isUefaClubTournament(leagueId) || leagueId === 'uefa.euro' || leagueId === 'caf.nations'
    ? [year, year + 1]
    : [year];
  const pages = await Promise.all(years.map(async calendarYear => {
    return cachedJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${calendarYear}&limit=1000`, { ttl: 15000, timeout: 20000 });
  }));
  const data = { events: pages.flatMap(page => page.events || []) };
  const result = Object.fromEntries(rounds.map(([key]) => [key, []]));
  const seen = new Set();
  for (const event of data.events || []) {
    if (Number(event.season?.year) !== year || seen.has(event.id)) continue;
    seen.add(event.id);
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const stage = classifyRound(event.season?.slug) || classifyRound(comp.altGameNote) || classifyRound((comp.notes || []).map(n => n.text).join(' '));
    if (!stage) continue;
    const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
    const status = event.status || comp.status;
    const score = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
    result[stage].push({
      id: event.id, leagueId, date: event.date, knockoutStage: stage,
      homeTeamId: home.team?.id, awayTeamId: away.team?.id,
      homeTeam: home.team?.displayName || 'لم يتحدد بعد', awayTeam: away.team?.displayName || 'لم يتحدد بعد',
      homeLogo: home.team?.logo, awayLogo: away.team?.logo,
      homeScore: score(home.score), awayScore: score(away.score),
      homeWinner: home.winner === true, awayWinner: away.winner === true,
      status: status?.type?.state === 'post' ? 'FT' : status?.type?.state === 'in' ? 'LIVE' : 'NS',
      ...parseMatchResult(status, comp.competitors),
      time: new Date(event.date).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
  }
  // Fetch period scores only for matches that actually needed extra time or penalties.
  const specialMatches = Object.values(result).flat().filter(m => m.finishType === 'extra-time' || m.finishType === 'penalties');
  for (let i = 0; i < specialMatches.length; i += 4) {
    await Promise.all(specialMatches.slice(i, i + 4).map(async match => {
      try {
        const summary = await cachedJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${match.id}`, { ttl: 15000, timeout: 10000 });
        const competition = summary.header?.competitions?.[0];
        if (competition?.status && competition?.competitors?.length === 2) {
          const periods = parseMatchResult(competition.status, competition.competitors);
          match.regulationScore = periods.regulationScore;
          match.extraTimeScore = periods.extraTimeScore;
        }
      } catch { /* The match remains visible when period details are unavailable. */ }
    }));
  }
  for (const matches of Object.values(result)) matches.sort((a, b) => new Date(a.date) - new Date(b.date));
  return result;
};
