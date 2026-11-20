// Read the provider's explicit result type; a draw alone never implies penalties.
const numberOrNull = value => {
  const raw = value?.value ?? value?.displayValue ?? value;
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
};

const UNPLAYED_STATUS_CODES = new Set(['NS', 'UPCOMING', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED']);

/**
 * Normalizes ESPN match status objects/types safely.
 * Explicit postponed/cancelled/abandoned/suspended statuses or completed === false
 * are NEVER treated as FT even when ESPN sends state === 'post'.
 */
export function resolveEspnMatchStatus(statusOrType) {
  const type = statusOrType?.type || statusOrType || {};
  const text = [type.name, type.description, type.detail, type.shortDetail]
    .filter(Boolean)
    .join(' ');

  if (/postpon/i.test(text)) return 'POSTPONED';
  if (/cancel/i.test(text)) return 'CANCELLED';
  if (/abandon/i.test(text)) return 'ABANDONED';
  if (/suspend/i.test(text)) return 'SUSPENDED';
  if (type.state === 'in') return 'LIVE';
  if (type.state === 'pre') return 'NS';
  if (type.completed === false) return 'NS';
  if (type.completed === true || type.state === 'post') return 'FT';
  return 'NS';
}

export function isUnplayedMatchStatus(status) {
  return UNPLAYED_STATUS_CODES.has(String(status || '').toUpperCase().trim());
}

export function getMatchStatusLabel(match = {}) {
  const code = String(match?.status || '').toUpperCase().trim();
  if (code === 'POSTPONED') return 'مؤجلة';
  if (code === 'CANCELLED') return 'ملغاة';
  if (code === 'ABANDONED') return 'متوقفة';
  if (code === 'SUSPENDED') return 'معلّقة';
  if (code === 'LIVE') return 'مباشر';
  if (code === 'FT' || code === 'FINISHED') return finishedMatchLabel(match);
  return 'لم تبدأ';
}

export function parseMatchResult(status, competitors = []) {
  const home = competitors.find(c => c.homeAway === 'home') || {};
  const away = competitors.find(c => c.homeAway === 'away') || {};
  const type = status?.type || {};
  const normalizedStatus = resolveEspnMatchStatus(status);
  const finished = normalizedStatus === 'FT';
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
    homePenalties: finished ? numberOrNull(home.shootoutScore) : null,
    awayPenalties: finished ? numberOrNull(away.shootoutScore) : null,
    homeWinner: finished && home.winner === true,
    awayWinner: finished && away.winner === true,
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

const normalizeTeamId = (value) => {
  if (value === null || value === undefined) return '';
  const clean = String(value).trim();
  if (!clean || clean === 'null' || clean === 'undefined') return '';
  return clean;
};

const NON_COMPLETED_STATUS_RE = /postpon|cancel|abandon|suspend|delay|schedul/i;
const NON_COMPLETED_CODES = new Set([
  'NS',
  'UPCOMING',
  'LIVE',
  'IN_PROGRESS',
  'HT',
  'PST',
  'POSTPONED',
  'CANC',
  'CANCELLED',
  'CANCELED',
  'ABD',
  'ABANDONED',
  'SUSP',
  'SUSPENDED',
  'TBD',
  'DELAYED'
]);
const COMPLETED_CODES = new Set(['FT', 'FINISHED', 'AET', 'PEN']);

const resolveMatchTeamIds = (match = {}) => {
  let homeId = normalizeTeamId(match.homeTeamId);
  let awayId = normalizeTeamId(match.awayTeamId);

  if (!homeId || !awayId) {
    const competitors = match.rawEvent?.competitions?.[0]?.competitors || [];
    const homeComp = competitors.find((c) => c.homeAway === 'home');
    const awayComp = competitors.find((c) => c.homeAway === 'away');
    if (!homeId) homeId = normalizeTeamId(homeComp?.team?.id ?? homeComp?.id);
    if (!awayId) awayId = normalizeTeamId(awayComp?.team?.id ?? awayComp?.id);
  }

  return { homeId, awayId };
};

const isCompletedMatch = (match = {}) => {
  const statusCode = String(match.status || '').toUpperCase().trim();
  if (NON_COMPLETED_CODES.has(statusCode)) return false;

  const rawType = match.rawEvent?.status?.type || match.rawEvent?.competitions?.[0]?.status?.type || {};
  const rawText = [
    match.statusDetail,
    rawType.name,
    rawType.description,
    rawType.detail,
    rawType.shortDetail
  ].filter(Boolean).join(' ');

  if (NON_COMPLETED_STATUS_RE.test(rawText)) return false;
  if (rawType.state === 'pre' || rawType.state === 'in') return false;
  if (rawType.completed === false) return false;

  if (COMPLETED_CODES.has(statusCode)) return true;
  if (rawType.completed === true || rawType.state === 'post') return true;
  return false;
};

/**
 * Calculates a completed match's outcome strictly from the perspective of viewedTeamId.
 * Returns 'win' | 'loss' | 'draw' | null (for unfinished, postponed, cancelled, or ambiguous matches).
 */
export function getTeamMatchOutcome(match, viewedTeamId) {
  const cleanViewedId = normalizeTeamId(viewedTeamId);
  if (!match || !cleanViewedId) return null;

  const { homeId, awayId } = resolveMatchTeamIds(match);
  if (!homeId || !awayId || homeId === awayId) return null;

  let side = null;
  if (cleanViewedId === homeId) side = 'home';
  else if (cleanViewedId === awayId) side = 'away';
  else return null;

  if (!isCompletedMatch(match)) return null;

  const statusCode = String(match.status || '').toUpperCase().trim();
  const isPenalties = match.finishType === 'penalties' || statusCode === 'PEN';

  if (isPenalties) {
    const homePen = numberOrNull(match.homePenalties);
    const awayPen = numberOrNull(match.awayPenalties);

    if (homePen !== null && awayPen !== null && homePen !== awayPen) {
      const viewedPen = side === 'home' ? homePen : awayPen;
      const oppPen = side === 'home' ? awayPen : homePen;
      return viewedPen > oppPen ? 'win' : 'loss';
    }

    const homeWon = match.homeWinner === true && match.awayWinner !== true;
    const awayWon = match.awayWinner === true && match.homeWinner !== true;
    if (homeWon) return side === 'home' ? 'win' : 'loss';
    if (awayWon) return side === 'away' ? 'win' : 'loss';

    // Never classify a penalty-decided match as a draw or invent an ambiguous winner
    return null;
  }

  let homeScore = numberOrNull(match.homeScore);
  let awayScore = numberOrNull(match.awayScore);

  // For extra-time matches, prefer explicit extraTimeScore if main scores are absent
  if ((match.finishType === 'extra-time' || statusCode === 'AET') && Array.isArray(match.extraTimeScore) && match.extraTimeScore.length === 2) {
    const etHome = numberOrNull(match.extraTimeScore[0]);
    const etAway = numberOrNull(match.extraTimeScore[1]);
    if (etHome !== null && etAway !== null) {
      homeScore = etHome;
      awayScore = etAway;
    }
  }

  if (homeScore === null || awayScore === null) return null;

  const viewedScore = side === 'home' ? homeScore : awayScore;
  const opponentScore = side === 'home' ? awayScore : homeScore;

  if (viewedScore > opponentScore) return 'win';
  if (viewedScore < opponentScore) return 'loss';
  return 'draw';
}

export function getFavoriteMatchDisplay(match = {}) {
  const isEgyMatch = match.leagueId === 'egypt.1';
  const isUpcoming = isUpcomingMatch(match);
  const isUnplayed = isUnplayedMatchStatus(match.status);
  const isLive = match.status === 'LIVE';
  const isFinished = ['FT', 'FINISHED'].includes(match.status);
  let statusLabel = 'لم تبدأ';
  if (isEgyMatch) {
    if (isLive) statusLabel = 'جارية (تجريبية)';
    else if (isFinished) statusLabel = finishedMatchLabel(match) + ' (تجريبية)';
    else if (isUnplayed && !isUpcoming) statusLabel = getMatchStatusLabel(match) + ' (تجريبية)';
    else statusLabel = match.time || 'مجدولة (تجريبية)';
  } else {
    if (isLive) statusLabel = `مباشر • ${match.minute || ''}`;
    else if (isFinished) statusLabel = finishedMatchLabel(match);
    else if (isUnplayed && !isUpcoming) statusLabel = getMatchStatusLabel(match);
    else statusLabel = match.time || 'قادمة';
  }
  const hasScores = Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore);
  return {
    isEgyMatch,
    isUpcoming,
    isLive,
    isFinished,
    statusLabel,
    centerText: isUnplayed || !hasScores ? 'VS' : `${match.homeScore} - ${match.awayScore}`
  };
}
