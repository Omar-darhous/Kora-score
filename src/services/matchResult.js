// Read the provider's explicit result type; a draw alone never implies penalties.
const numberOrNull = value => {
  const raw = value?.value ?? value?.displayValue ?? value;
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
};
export function parseMatchResult(status, competitors = []) {
  const home = competitors.find(c => c.homeAway === 'home') || {};
  const away = competitors.find(c => c.homeAway === 'away') || {};
  const type = status?.type || {};
  const finished = type.state === 'post' || type.completed === true;
  const description = [type.name, type.detail, type.shortDetail, type.description].filter(Boolean).join(' ');
  const penalties = /PEN|shoot.?out/i.test(description);
  const extraTime = /AET|extra.?time/i.test(description);
  const periodTotal = (team, count) => {
    if (!Array.isArray(team.linescores) || team.linescores.length < count) return null;
    const values = team.linescores.slice(0, count).map(numberOrNull);
    return values.every(Number.isFinite) ? values.reduce((a,b) => a+b, 0) : null;
  };
  const regularHome = periodTotal(home, 2);
  const regularAway = periodTotal(away, 2);
  const extraHome = periodTotal(home, 4);
  const extraAway = periodTotal(away, 4);
  return {
    regulationScore: finished && regularHome !== null && regularAway !== null ? [regularHome, regularAway] : null,
    extraTimeScore: finished && extraHome !== null && extraAway !== null && (penalties || extraTime) ? [extraHome, extraAway] : null,
    finishType: finished ? (penalties ? 'penalties' : extraTime ? 'extra-time' : 'regular') : null,
    homePenalties: numberOrNull(home.shootoutScore),
    awayPenalties: numberOrNull(away.shootoutScore),
    homeWinner: home.winner === true,
    awayWinner: away.winner === true,
    statusDetail: type.detail || ''
  };
}
export function finishedMatchLabel(match) {
  if (match.finishType === 'penalties') {
    const scores = Number.isFinite(match.homePenalties) && Number.isFinite(match.awayPenalties)
      ? ' (' + '⁦' + match.homePenalties + ' - ' + match.awayPenalties + '⁩' + ')' : '';
    return 'انتهت بركلات الترجيح' + scores;
  }
  if (match.finishType === 'extra-time') return 'انتهت بعد الأشواط الإضافية';
  return 'انتهت';
}
export function isUpcomingMatch(match) {
  return ['NS', 'UPCOMING'].includes(match?.status);
}
export function getFavoriteMatchDisplay(match = {}) {
  const isEgyMatch = match.leagueId === 'egypt.1';
  const isUpcoming = isUpcomingMatch(match);
  const isLive = match.status === 'LIVE';
  const isFinished = ['FT', 'FINISHED'].includes(match.status);
  let statusLabel = 'لم تبدأ';
  if (isEgyMatch) {
    if (isLive) statusLabel = 'جارية (تجريبية)';
    else if (isFinished) statusLabel = finishedMatchLabel(match) + ' (تجريبية)';
    else statusLabel = match.time || 'مجدولة (تجريبية)';
  } else {
    if (isLive) statusLabel = `مباشر • ${match.minute || ''}`;
    else if (isFinished) statusLabel = finishedMatchLabel(match);
    else statusLabel = match.time || 'قادمة';
  }
  return {
    isEgyMatch,
    isUpcoming,
    isLive,
    isFinished,
    statusLabel,
    centerText: isUpcoming ? 'VS' : `${match.homeScore} - ${match.awayScore}`
  };
}
