// Read the provider's explicit result type; a draw alone never implies penalties.
const numberOrNull = value => {
  const raw = value?.value ?? value?.displayValue ?? value;
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
};

const UNPLAYED_STATUS_CODES = new Set(['NS', 'UPCOMING', 'POSTPONED', 'CANCELLED', 'ABANDONED', 'SUSPENDED']);

export const MATCH_PHASES = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  FIRST_HALF: 'FIRST_HALF',
  HALFTIME: 'HALFTIME',
  SECOND_HALF: 'SECOND_HALF',
  EXTRA_TIME_FIRST_HALF: 'EXTRA_TIME_FIRST_HALF',
  EXTRA_TIME_HALFTIME: 'EXTRA_TIME_HALFTIME',
  EXTRA_TIME_SECOND_HALF: 'EXTRA_TIME_SECOND_HALF',
  EXTRA_TIME: 'EXTRA_TIME',
  PENALTIES: 'PENALTIES',
  FULL_TIME: 'FULL_TIME',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
  ABANDONED: 'ABANDONED',
  SUSPENDED: 'SUSPENDED'
});

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

/**
 * Resolves the verified live/terminal match phase strictly from ESPN status metadata.
 * NEVER infers half-time solely from stoppage minutes like 45+4.
 */
export function resolveEspnMatchPhase(statusOrType) {
  const normalizedStatus = resolveEspnMatchStatus(statusOrType);
  if (normalizedStatus === 'POSTPONED') return MATCH_PHASES.POSTPONED;
  if (normalizedStatus === 'CANCELLED') return MATCH_PHASES.CANCELLED;
  if (normalizedStatus === 'ABANDONED') return MATCH_PHASES.ABANDONED;
  if (normalizedStatus === 'SUSPENDED') return MATCH_PHASES.SUSPENDED;
  if (normalizedStatus === 'FT') return MATCH_PHASES.FULL_TIME;
  if (normalizedStatus === 'NS') return MATCH_PHASES.SCHEDULED;

  const type = statusOrType?.type || statusOrType || {};
  const name = String(type.name || '').toUpperCase().trim();
  const detailText = [type.description, type.detail, type.shortDetail, statusOrType?.displayClock]
    .filter(Boolean)
    .join(' ')
    .trim();
  const period = Number(statusOrType?.period);

  // 1. Penalty shootout in progress
  if (
    /SHOOTOUT|PENALT/i.test(name) ||
    /\b(?:shoot[\s-]*out|penalties|pens)\b/i.test(detailText)
  ) {
    return MATCH_PHASES.PENALTIES;
  }

  // 2. Half-time in extra time
  if (
    /HALFTIME_ET|OVERTIME_HALFTIME|EXTRA_TIME_HALFTIME/i.test(name) ||
    (/\b(?:half[\s-]*time|ht)\b/i.test(detailText) && (/\b(?:et|aet|extra|overtime)\b/i.test(detailText) || period >= 3))
  ) {
    return MATCH_PHASES.EXTRA_TIME_HALFTIME;
  }

  // 3. Verified Half-Time (HT) — requires explicit ESPN halftime status/marker, NEVER inferred from 45+4
  if (
    name === 'STATUS_HALFTIME' ||
    /HALFTIME/i.test(name) ||
    /\bhalf[\s-]*time\b/i.test(detailText) ||
    /^ht$/i.test(String(type.detail || '').trim()) ||
    /^ht$/i.test(String(type.shortDetail || '').trim()) ||
    /^ht$/i.test(String(statusOrType?.displayClock || '').trim())
  ) {
    return MATCH_PHASES.HALFTIME;
  }

  // 4. Extra Time halves
  if (
    /FIRST_HALF_EXTRA_TIME|OVERTIME_FIRST|ET_1ST/i.test(name) ||
    (/\b(?:1st|first)\b/i.test(detailText) && /\b(?:extra|overtime|et)\b/i.test(detailText))
  ) {
    return MATCH_PHASES.EXTRA_TIME_FIRST_HALF;
  }
  if (
    /SECOND_HALF_EXTRA_TIME|OVERTIME_SECOND|ET_2ND/i.test(name) ||
    (/\b(?:2nd|second)\b/i.test(detailText) && /\b(?:extra|overtime|et)\b/i.test(detailText))
  ) {
    return MATCH_PHASES.EXTRA_TIME_SECOND_HALF;
  }
  if (
    /OVERTIME|EXTRA_TIME/i.test(name) ||
    /\b(?:extra[\s-]*time|overtime)\b/i.test(detailText) ||
    period === 3 ||
    period === 4
  ) {
    return MATCH_PHASES.EXTRA_TIME;
  }

  // 5. Second Half
  if (
    name === 'STATUS_SECOND_HALF' ||
    /SECOND_HALF/i.test(name) ||
    /\b(?:2nd|second)\s+half\b/i.test(detailText) ||
    period === 2
  ) {
    return MATCH_PHASES.SECOND_HALF;
  }

  // 6. First Half
  if (
    name === 'STATUS_FIRST_HALF' ||
    /FIRST_HALF/i.test(name) ||
    /\b(?:1st|first)\s+half\b/i.test(detailText) ||
    period === 1
  ) {
    return MATCH_PHASES.FIRST_HALF;
  }

  return MATCH_PHASES.FIRST_HALF;
}

export function isHalfTimePhase(match = {}) {
  if (!match || match.status !== 'LIVE') return false;
  if (match.matchPhase === MATCH_PHASES.HALFTIME || match.matchPhase === MATCH_PHASES.EXTRA_TIME_HALFTIME) {
    return true;
  }
  if (match.isHalfTime === true) return true;
  const detail = String(match.statusDetail || '').trim();
  const minute = String(match.minute || '').trim();
  return /\bhalf[\s-]*time\b|^ht$/i.test(detail) || /^ht$/i.test(minute);
}

export function getLiveMatchDisplay(match = {}) {
  const cleanMinute = String(match?.minute ?? '').replace(/['"’`\u2032]/g, '').trim();
  const phase = match?.matchPhase || (isHalfTimePhase(match) ? MATCH_PHASES.HALFTIME : null);

  if (phase === MATCH_PHASES.EXTRA_TIME_HALFTIME) {
    return {
      phase,
      isHalfTime: true,
      isRunningClock: false,
      shortBadge: 'HT الإضافي',
      badgeText: 'استراحة الوقت الإضافي',
      modalLabel: 'استراحة الوقت الإضافي (HT)',
      statusLabel: 'استراحة الوقت الإضافي'
    };
  }

  if (phase === MATCH_PHASES.HALFTIME || isHalfTimePhase(match)) {
    return {
      phase: MATCH_PHASES.HALFTIME,
      isHalfTime: true,
      isRunningClock: false,
      shortBadge: 'HT',
      badgeText: 'استراحة بين الشوطين',
      modalLabel: 'استراحة بين الشوطين (HT)',
      statusLabel: 'استراحة بين الشوطين'
    };
  }

  if (phase === MATCH_PHASES.PENALTIES) {
    return {
      phase,
      isHalfTime: false,
      isRunningClock: false,
      shortBadge: 'ركلات الترجيح',
      badgeText: 'ركلات الترجيح',
      modalLabel: 'ركلات الترجيح',
      statusLabel: 'ركلات الترجيح جارية'
    };
  }

  const isExtraTime =
    phase === MATCH_PHASES.EXTRA_TIME ||
    phase === MATCH_PHASES.EXTRA_TIME_FIRST_HALF ||
    phase === MATCH_PHASES.EXTRA_TIME_SECOND_HALF;

  const clockLabel = cleanMinute ? `${cleanMinute} د` : 'مباشر';
  return {
    phase: phase || MATCH_PHASES.FIRST_HALF,
    isHalfTime: false,
    isRunningClock: true,
    cleanMinute,
    shortBadge: clockLabel,
    badgeText: clockLabel,
    modalLabel: cleanMinute ? `مباشر (${cleanMinute} د)` : 'مباشر',
    statusLabel: isExtraTime ? 'الوقت الإضافي' : 'جارية الآن'
  };
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
    if (isLive) statusLabel = isHalfTimePhase(match) ? 'استراحة بين الشوطين (تجريبية)' : 'جارية (تجريبية)';
    else if (isFinished) statusLabel = finishedMatchLabel(match) + ' (تجريبية)';
    else if (isUnplayed && !isUpcoming) statusLabel = getMatchStatusLabel(match) + ' (تجريبية)';
    else statusLabel = match.time || 'مجدولة (تجريبية)';
  } else {
    if (isLive) {
      const liveDisplay = getLiveMatchDisplay(match);
      statusLabel = liveDisplay.isHalfTime ? `${liveDisplay.badgeText} (HT)` : `مباشر • ${match.minute || ''}`;
    }
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
