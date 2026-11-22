import { cachedJson } from './requestCache.js';
import {
  MATCH_PHASES,
  parseMatchResult,
  resolveEspnMatchStatus,
  resolveEspnMatchPhase
} from './matchResult.js';
import { classifyRound, rounds, isTournament } from './tournamentRules.js';
import { getMockEgyptianMatchDetails } from './egyptianMockService.js';
import { resolveLeagueLogo, resolveTeamLogo } from './logoUtils.js';
import { translatePosition } from './teamsService.js';

export const LEAGUE_MAX_MATCHWEEKS = {
  'eng.1': 38,
  'esp.1': 38,
  'ita.1': 38,
  'ger.1': 34,
  'fra.1': 38,
  'ksa.1': 34,
  'egypt.1': 34,
  'usa.1': 38,
  'uefa.champions': 8,
  'uefa.europa': 8,
  'uefa.europa.conf': 6,
  'uefa.nations': 6,
  'fifa.world': 3,
  'caf.nations': 3,
  'uefa.euro': 3,
  'afc.asian.cup': 3,
  'conmebol.america': 5
};

export const getMaxLeagueMatchweeks = (leagueId = '', maxRounds = null) => {
  const customMax = Number(maxRounds);
  if (Number.isInteger(customMax) && customMax > 0) {
    return customMax;
  }
  const cleanId = String(leagueId || '').trim().toLowerCase();
  if (cleanId && Object.prototype.hasOwnProperty.call(LEAGUE_MAX_MATCHWEEKS, cleanId)) {
    return LEAGUE_MAX_MATCHWEEKS[cleanId];
  }
  return 50;
};

export const isValidLeagueRoundNumber = (value, { leagueId = '', maxRounds = null } = {}) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return false;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return false;
  }
  return num <= getMaxLeagueMatchweeks(leagueId, maxRounds);
};

// ترجمة الأدوار الإقصائية إلى العربية
export const mapKnockoutStage = (slug) => {
  if (/relegation.*playoff|promotion.*playoff/i.test(slug || '')) return 'ملحق الصعود والهبوط';
  const key = classifyRound(slug);
  if (key) return rounds.find(([id]) => id === key)?.[1] || null;
  return /group|league.phase|^league-[a-d]$/i.test(slug || '') ? 'مرحلة المجموعات / الدوري' : null;
};

const NON_MATCHWEEK_STAGE_REGEX = /\b(?:round\s+of\s+\d+|preliminary|qualif\w*|play-?offs?|quarter-?finals?|semi-?finals?|third-?place|3rd-?place|bronze|final|first\s+round|second\s+round|third\s+round|fourth\s+round|fifth\s+round|knockout)\b/i;

export const parseRoundFromText = (text, { leagueId = '', maxRounds = null } = {}) => {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (!clean) return null;

  // Never treat knockout or qualifying stage labels (e.g. "Round of 16") as numeric domestic matchweeks
  if (mapKnockoutStage(clean) || NON_MATCHWEEK_STAGE_REGEX.test(clean)) {
    return null;
  }

  const roundMatch =
    clean.match(/(?:^|\b)(?:matchday|matchweek|gameweek|round|jornada|giornata|journ[eé]e|spieltag)\s*#?:?\s*(-?\d+)\b/i) ||
    clean.match(/الجولة\s*#?:?\s*(-?\d+)/);
  if (roundMatch) {
    const num = Number(roundMatch[1]);
    if (!isValidLeagueRoundNumber(num, { leagueId, maxRounds })) {
      return { valid: false, number: null, label: null };
    }
    return { valid: true, number: num, label: `الجولة ${num}` };
  }

  const weekMatch =
    clean.match(/(?:^|\b)(?:week|semaine)\s*#?:?\s*(-?\d+)\b/i) ||
    clean.match(/الأسبوع\s*#?:?\s*(-?\d+)/);
  if (weekMatch) {
    const num = Number(weekMatch[1]);
    if (!isValidLeagueRoundNumber(num, { leagueId, maxRounds })) {
      return { valid: false, number: null, label: null };
    }
    return { valid: true, number: num, label: `الأسبوع ${num}` };
  }

  return null;
};

// ترجمة الجولات الأسبوعية الموثوقة إلى العربية مع رفض الأرقام خارج النطاق الرسمي
export const translateRoundText = (text, options = {}) => {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  if (!clean) return '';

  const knockout = mapKnockoutStage(clean);
  if (knockout) return knockout;

  const parsed = parseRoundFromText(clean, options);
  if (parsed) {
    return parsed.valid ? parsed.label : '';
  }

  return '';
};

export const resolveMatchRound = (
  rawEvent,
  { leagueId = '', maxRounds = null, calendarLabel = '', statusStr = '' } = {}
) => {
  if (!rawEvent || typeof rawEvent !== 'object') {
    return { roundNumber: null, roundName: null };
  }

  const comp = rawEvent?.competitions?.[0] || {};
  const seasonSlug = rawEvent?.season?.slug || '';
  const altNote = comp.altGameNote || '';
  const notesList = (comp.notes || []).map(n => n?.text || '').filter(Boolean);

  const stageFromSlug = mapKnockoutStage(seasonSlug);
  const stageFromAlt = mapKnockoutStage(altNote);
  const stageFromNotes = notesList.map(mapKnockoutStage).find(Boolean) || null;

  const isKnockoutLabel = (lbl) => Boolean(lbl && lbl !== 'مرحلة المجموعات / الدوري');
  const knockoutStage = isKnockoutLabel(stageFromSlug)
    ? stageFromSlug
    : isKnockoutLabel(stageFromAlt)
    ? stageFromAlt
    : isKnockoutLabel(stageFromNotes)
    ? stageFromNotes
    : null;

  if (knockoutStage) {
    return { roundNumber: null, roundName: knockoutStage };
  }

  const hasGroupStageLabel =
    stageFromSlug === 'مرحلة المجموعات / الدوري' ||
    stageFromAlt === 'مرحلة المجموعات / الدوري' ||
    stageFromNotes === 'مرحلة المجموعات / الدوري';

  const isNonMatchweekEvent =
    NON_MATCHWEEK_STAGE_REGEX.test(seasonSlug) ||
    NON_MATCHWEEK_STAGE_REGEX.test(altNote) ||
    notesList.some(n => NON_MATCHWEEK_STAGE_REGEX.test(n));

  if (isNonMatchweekEvent) {
    return { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
  }

  // 1. Official event.week field
  if (rawEvent.week !== null && rawEvent.week !== undefined) {
    if (typeof rawEvent.week === 'object') {
      const weekText = String(rawEvent.week.text || rawEvent.week.displayName || '').trim();
      if (weekText) {
        if (mapKnockoutStage(weekText) && mapKnockoutStage(weekText) !== 'مرحلة المجموعات / الدوري') {
          return { roundNumber: null, roundName: mapKnockoutStage(weekText) };
        }
        const parsedWeekText = parseRoundFromText(weekText, { leagueId, maxRounds });
        if (parsedWeekText) {
          return parsedWeekText.valid
            ? { roundNumber: parsedWeekText.number, roundName: parsedWeekText.label }
            : { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
        }
      }
      if (rawEvent.week.number !== undefined && rawEvent.week.number !== null && rawEvent.week.number !== '') {
        if (isValidLeagueRoundNumber(rawEvent.week.number, { leagueId, maxRounds })) {
          const num = Number(rawEvent.week.number);
          return { roundNumber: num, roundName: `الجولة ${num}` };
        }
        return { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
      }
    } else if (typeof rawEvent.week === 'number' || typeof rawEvent.week === 'string') {
      if (typeof rawEvent.week === 'string') {
        const parsedStr = parseRoundFromText(rawEvent.week, { leagueId, maxRounds });
        if (parsedStr) {
          return parsedStr.valid
            ? { roundNumber: parsedStr.number, roundName: parsedStr.label }
            : { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
        }
      }
      if (isValidLeagueRoundNumber(rawEvent.week, { leagueId, maxRounds })) {
        const num = Number(rawEvent.week);
        return { roundNumber: num, roundName: `الجولة ${num}` };
      }
      return { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
    }
  }

  // 2. Official competition notes (e.g. "Matchday 14")
  for (const noteText of notesList) {
    const parsedNote = parseRoundFromText(noteText, { leagueId, maxRounds });
    if (parsedNote) {
      return parsedNote.valid
        ? { roundNumber: parsedNote.number, roundName: parsedNote.label }
        : { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
    }
  }

  // 3. Validated competition.round / event.round (rejecting ESPN season/stage type objects and tournament stage IDs)
  const roundObj = comp?.round ?? rawEvent?.round;
  if (roundObj && typeof roundObj === 'object') {
    const isUnrelatedTypeObject =
      roundObj.type !== undefined ||
      roundObj.year !== undefined ||
      roundObj.slug !== undefined ||
      roundObj.startDate !== undefined;
    if (!isUnrelatedTypeObject) {
      const roundText = String(roundObj.displayName || roundObj.name || roundObj.text || '').trim();
      if (roundText) {
        if (NON_MATCHWEEK_STAGE_REGEX.test(roundText) || isKnockoutLabel(mapKnockoutStage(roundText))) {
          return {
            roundNumber: null,
            roundName: isKnockoutLabel(mapKnockoutStage(roundText)) ? mapKnockoutStage(roundText) : (hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null)
          };
        }
        const parsedRoundText = parseRoundFromText(roundText, { leagueId, maxRounds });
        if (parsedRoundText) {
          return parsedRoundText.valid
            ? { roundNumber: parsedRoundText.number, roundName: parsedRoundText.label }
            : { roundNumber: null, roundName: hasGroupStageLabel ? 'مرحلة المجموعات / الدوري' : null };
        }
      } else if (roundObj.number !== undefined && roundObj.number !== null && roundObj.number !== '' && !isTournament(leagueId)) {
        if (isValidLeagueRoundNumber(roundObj.number, { leagueId, maxRounds })) {
          const num = Number(roundObj.number);
          return { roundNumber: num, roundName: `الجولة ${num}` };
        }
        return { roundNumber: null, roundName: null };
      }
    }
  }

  // 4. Calendar entry explicit label (ONLY when calendar item has a verified .label, never from array index, and not for postponed/rescheduled matches without event round)
  const isRescheduledOrPostponed =
    statusStr === 'POSTPONED' ||
    notesList.some(n => /\b(?:postponed|rescheduled|rearranged)\b|مؤجل/i.test(n));
  if (calendarLabel && !isRescheduledOrPostponed) {
    const parsedCal = parseRoundFromText(calendarLabel, { leagueId, maxRounds });
    if (parsedCal && parsedCal.valid) {
      return { roundNumber: parsedCal.number, roundName: parsedCal.label };
    }
  }

  if (hasGroupStageLabel) {
    return { roundNumber: null, roundName: 'مرحلة المجموعات / الدوري' };
  }

  return { roundNumber: null, roundName: null };
};

export const extractReliableRoundNumber = (rawEvent, options = {}) => {
  return resolveMatchRound(rawEvent, options).roundNumber;
};

export const normalizeScoreboardMatches = (data, league, dateStr) => {
  let calendarLabel = '';
  const calendar = data.leagues?.[0]?.calendar || [];
  if (calendar.length > 0 && typeof dateStr === 'string' && dateStr.length >= 8) {
    const formattedTargetDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    const foundItem = calendar.find(c => {
      if (c && typeof c === 'object' && typeof c.date === 'string') {
        return c.date.startsWith(formattedTargetDate);
      }
      return false;
    });
    if (foundItem && typeof foundItem.label === 'string' && foundItem.label.trim()) {
      calendarLabel = foundItem.label.trim();
    }
  }

  const events = data.events || [];
  return events.map(event => {
    const comp = event.competitions?.[0] || {};
    const homeCompetitor = comp.competitors?.find(c => c.homeAway === 'home') || {};
    const awayCompetitor = comp.competitors?.find(c => c.homeAway === 'away') || {};

    const eventStatus = event.status || comp.status;
    const statusStr = resolveEspnMatchStatus(eventStatus);
    const matchPhase = resolveEspnMatchPhase(eventStatus);
    const isHalfTime = matchPhase === MATCH_PHASES.HALFTIME || matchPhase === MATCH_PHASES.EXTRA_TIME_HALFTIME;
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

    const { roundNumber, roundName } = resolveMatchRound(event, {
      leagueId: league?.id || '',
      calendarLabel,
      statusStr
    });

    const rawDisplayClock = eventStatus?.displayClock
      ? String(eventStatus.displayClock).replace(/['"’`\u2032]/g, '').trim()
      : '';
    const normalizedMinute = isHalfTime
      ? 'HT'
      : matchPhase === MATCH_PHASES.PENALTIES
      ? 'PEN'
      : (rawDisplayClock || eventStatus?.clock || 0);

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
      matchPhase,
      isHalfTime,
      period: Number.isInteger(Number(eventStatus?.period)) ? Number(eventStatus.period) : null,
      ...parseMatchResult(eventStatus, comp.competitors),
      minute: normalizedMinute,
      time: matchTime,
      roundNumber,
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

const cleanClockDisplay = (value) => String(value ?? '').replace(/['"’`\u2032]/g, '').trim();

export const parseEventClock = (clock) => {
  if (clock === null || clock === undefined) {
    return { time: '', minute: null, addedTime: 0 };
  }

  if (typeof clock === 'number' && Number.isFinite(clock) && clock >= 0) {
    const minute = Math.round(clock);
    return { time: String(minute), minute, addedTime: 0 };
  }

  const rawDisplay = typeof clock === 'string'
    ? clock
    : (clock?.displayValue ?? clock?.displayClock ?? '');
  const cleaned = cleanClockDisplay(rawDisplay);

  if (cleaned) {
    const stoppageMatch = cleaned.match(/^(\d+)\s*\+\s*(\d+)$/);
    if (stoppageMatch) {
      const minute = Number(stoppageMatch[1]);
      const addedTime = Number(stoppageMatch[2]);
      return { time: `${minute}+${addedTime}`, minute, addedTime };
    }
    const plainMatch = cleaned.match(/^(\d+)$/);
    if (plainMatch) {
      const minute = Number(plainMatch[1]);
      return { time: String(minute), minute, addedTime: 0 };
    }
  }

  if (typeof clock === 'object' && clock !== null && Number.isFinite(Number(clock.value)) && Number(clock.value) >= 0) {
    const numericVal = Number(clock.value);
    const minute = numericVal > 180 ? Math.max(1, Math.ceil(numericVal / 60)) : Math.round(numericVal);
    return { time: String(minute), minute, addedTime: 0 };
  }

  return { time: '', minute: null, addedTime: 0 };
};

export const compareMatchEvents = (a, b) => {
  const periodA = Number.isFinite(a?.period) ? a.period : null;
  const periodB = Number.isFinite(b?.period) ? b.period : null;
  if (periodA !== null && periodB !== null && periodA !== periodB) {
    return periodA - periodB;
  }

  const minA = Number.isFinite(a?.minute) ? a.minute : Number.POSITIVE_INFINITY;
  const minB = Number.isFinite(b?.minute) ? b.minute : Number.POSITIVE_INFINITY;
  if (minA !== minB) {
    return minA - minB;
  }

  const addA = Number.isFinite(a?.addedTime) ? a.addedTime : 0;
  const addB = Number.isFinite(b?.addedTime) ? b.addedTime : 0;
  if (addA !== addB) {
    return addA - addB;
  }

  return (a?._order ?? 0) - (b?._order ?? 0);
};

const IGNORED_EVENT_TYPES = /^(kickoff|halftime|half[- ]time|start\s+2nd\s+half|start\s+extra\s+time|end\s+regular\s+time|end\s+extra\s+time|end\s+match|full[- ]time|start\s+delay|end\s+delay|match\s+ends|first\s+half\s+ends|second\s+half\s+ends)$/i;

export const classifyMatchEvent = (rawEvent = {}) => {
  const typeObj = rawEvent?.type || {};
  const typeId = String(typeObj.id ?? '').trim();
  const typeText = String(typeObj.text ?? typeObj.type ?? '').toLowerCase().trim();
  const text = String(rawEvent?.text ?? '').toLowerCase();
  const isScoringPlay = rawEvent?.scoringPlay === true;

  if (!typeText && !typeId && !isScoringPlay) {
    return null;
  }

  if (!isScoringPlay && IGNORED_EVENT_TYPES.test(typeText)) {
    return null;
  }

  // 1. Penalty Saved (must precede Goal and Penalty Missed)
  if (
    typeId === '112' ||
    (typeText.includes('penalty') && (typeText.includes('saved') || typeText.includes('save'))) ||
    (!isScoringPlay && typeText.includes('penalty') && /\bpenalty\s+saved\b/i.test(text))
  ) {
    return {
      eventType: 'PENALTY_SAVED',
      type: 'penalty_saved',
      cardType: '',
      label: 'ركلة جزاء متصدى لها',
      detail: ''
    };
  }

  // 2. Penalty Missed (must NEVER be classified as a goal)
  if (
    typeId === '113' ||
    (typeText.includes('penalty') && (typeText.includes('miss') || typeText.includes('fail') || typeText.includes('off target') || typeText.includes('post') || typeText.includes('bar'))) ||
    (!isScoringPlay && /\b(?:penalty\s+missed|missed\s+penalty)\b/i.test(text))
  ) {
    return {
      eventType: 'PENALTY_MISSED',
      type: 'penalty_missed',
      cardType: '',
      label: 'ركلة جزاء ضائعة',
      detail: ''
    };
  }

  // 3. VAR / Disallowed Goal / Referee Decision Review (must precede Goal so "Goal - Disallowed" isn't counted as a goal)
  if (
    typeId === '172' ||
    typeText.includes('var') ||
    typeText.includes('video assistant') ||
    typeText.includes('disallow') ||
    typeText.includes('no goal') ||
    typeText.includes('decision cancelled') ||
    typeText.includes('decision overturned') ||
    typeText.includes('decision confirmed')
  ) {
    let detail = '';
    if (typeText.includes('disallow') || typeText.includes('no goal') || /\bno\s+goal\b|\bgoal\s+(?:cancelled|disallowed|overturned)\b/i.test(text)) {
      detail = 'إلغاء هدف بعد مراجعة VAR';
    } else if (/\bno\s+penalty\b|\bpenalty\s+(?:cancelled|overturned|not\s+awarded)\b/i.test(text)) {
      detail = 'إلغاء ركلة جزاء بعد مراجعة VAR';
    } else if (/\bvar\s+decision:\s*penalty\b|\bpenalty\s+(?:awarded|confirmed)\b/i.test(text) || (typeText.includes('penalty') && !typeText.includes('no penalty'))) {
      detail = 'احتساب ركلة جزاء بعد مراجعة VAR';
    } else if (/\bno\s+red\s+card\b|\bred\s+card\s+(?:cancelled|overturned)\b/i.test(text)) {
      detail = 'إلغاء بطاقة حمراء بعد مراجعة VAR';
    } else if (/\bred\s+card\b/i.test(text)) {
      detail = 'بطاقة حمراء بعد مراجعة VAR';
    } else if (typeText.includes('cancelled') || typeText.includes('overturned')) {
      detail = 'تعديل قرار الحكم';
    } else if (typeText.includes('confirmed')) {
      detail = 'تأكيد قرار الحكم';
    }

    return {
      eventType: 'VAR_DECISION',
      type: 'var',
      cardType: '',
      label: 'قرار تقنية الفيديو (VAR)',
      detail
    };
  }

  // 4. Own Goal
  if (
    rawEvent?.ownGoal === true ||
    typeId === '97' ||
    typeText.includes('own goal') ||
    (isScoringPlay && /\bown\s+goal\b/i.test(text))
  ) {
    return {
      eventType: 'OWN_GOAL',
      type: 'goal',
      cardType: '',
      label: 'هدف عكسي',
      detail: ''
    };
  }

  // 5. Penalty Goal
  if (
    typeId === '98' ||
    (typeText.includes('penalty') && (typeText.includes('scored') || typeText.includes('goal') || isScoringPlay)) ||
    (rawEvent?.penaltyKick === true && isScoringPlay)
  ) {
    return {
      eventType: 'PENALTY_GOAL',
      type: 'goal',
      cardType: '',
      label: 'هدف من ركلة جزاء',
      detail: ''
    };
  }

  // 6. Standard Goal
  if (
    isScoringPlay ||
    typeId === '70' ||
    typeId === '173' ||
    typeId === '137' ||
    typeText.includes('goal')
  ) {
    return {
      eventType: 'GOAL',
      type: 'goal',
      cardType: '',
      label: 'هدف',
      detail: ''
    };
  }

  // 7. Second Yellow -> Red Card
  if (
    typeId === '95' ||
    typeText.includes('second yellow') ||
    (typeText.includes('yellow') && typeText.includes('red')) ||
    (typeText.includes('red card') && /second\s+yellow/i.test(text))
  ) {
    return {
      eventType: 'SECOND_YELLOW_RED',
      type: 'card',
      cardType: 'second_yellow',
      label: 'بطاقة حمراء (إنذار ثانٍ)',
      detail: ''
    };
  }

  // 8. Red Card
  if (typeId === '93' || typeText.includes('red card') || rawEvent?.redCard === true) {
    return {
      eventType: 'RED_CARD',
      type: 'card',
      cardType: 'red',
      label: 'بطاقة حمراء',
      detail: ''
    };
  }

  // 9. Yellow Card
  if (typeId === '94' || typeText.includes('yellow card') || rawEvent?.yellowCard === true) {
    return {
      eventType: 'YELLOW_CARD',
      type: 'card',
      cardType: 'yellow',
      label: 'بطاقة صفراء',
      detail: ''
    };
  }

  // 10. Substitution
  if (typeId === '76' || typeText.includes('substitution')) {
    return {
      eventType: 'SUBSTITUTION',
      type: 'substitution',
      cardType: '',
      label: 'تبديل',
      detail: ''
    };
  }

  return null;
};

const getParticipantName = (participant) => (
  String(
    participant?.athlete?.displayName ||
    participant?.athlete?.fullName ||
    participant?.athlete?.shortName ||
    participant?.displayName ||
    participant?.name ||
    ''
  ).trim()
);

const getParticipantId = (participant) => {
  const id = participant?.athlete?.id ?? participant?.id;
  return id !== undefined && id !== null && String(id).trim() !== '' ? String(id).trim() : null;
};

const extractFallbackPlayerName = (rawEvent = {}) => {
  const shortText = String(rawEvent?.shortText || '').trim();
  if (shortText) {
    const cleanedShort = shortText
      .replace(/\s*[-–]\s*(?:goal|penalty\s*-\s*(?:missed|saved|scored)|yellow card|red card|own goal|substitution).*$/i, '')
      .replace(/\s+(?:penalty\s*-\s*(?:missed|saved|scored)|yellow card|red card|own goal|goal).*$/i, '')
      .trim();
    if (cleanedShort && cleanedShort.length <= 60 && !/\b(?:var|decision|still|hits|converts)\b/i.test(cleanedShort)) {
      return cleanedShort;
    }
  }

  const rawText = String(rawEvent?.text || '').trim();
  if (!rawText) return '';

  // Pattern: "Player Name (Team Name) ..."
  const parenMatch = rawText.match(/(?:^|\.\s+)([A-ZÀ-ÖØ-öø-ÿ][\w.'’ -]{1,45}?)\s*\([^)]+\)/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }

  // Simple name-only strings (e.g. minimal payloads like "Mohamed Salah")
  if (rawText.length <= 50 && !/[.!?]/.test(rawText) && !/\b(?:var|decision|penalty|card|substitution)\b/i.test(rawText)) {
    return rawText;
  }

  return '';
};

const extractFallbackSubstitutionNames = (rawEvent = {}) => {
  const text = String(rawEvent?.text || '').trim();
  const match = text.match(/(?:^|\.\s+)([^.]+?)\s+replaces\s+([^.]+?)(?:\s+because\b|\.)/i);
  if (match) {
    return {
      playerIn: match[1].replace(/^substitution,\s*[^.]+\.\s*/i, '').trim(),
      playerOut: match[2].trim()
    };
  }
  return { playerIn: '', playerOut: '' };
};

export const resolveMatchTeamIds = (summary = {}) => {
  const competition = summary?.header?.competitions?.[0];
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const headerHome = competitors.find(c => c?.homeAway === 'home');
  const headerAway = competitors.find(c => c?.homeAway === 'away');

  const rosterList = Array.isArray(summary?.rosters)
    ? summary.rosters
    : Object.values(summary?.rosters || {});
  const rosterHome = rosterList.find(r => r?.homeAway === 'home');
  const rosterAway = rosterList.find(r => r?.homeAway === 'away');

  const boxTeams = Array.isArray(summary?.boxscore?.teams) ? summary.boxscore.teams : [];
  const boxHome = boxTeams.find(t => t?.homeAway === 'home') || boxTeams[0];
  const boxAway = boxTeams.find(t => t?.homeAway === 'away') || boxTeams[1];

  const homeTeamId = (
    headerHome?.team?.id ??
    rosterHome?.team?.id ??
    boxHome?.team?.id ??
    null
  );
  const awayTeamId = (
    headerAway?.team?.id ??
    rosterAway?.team?.id ??
    boxAway?.team?.id ??
    null
  );

  return {
    homeTeamId: homeTeamId !== null && homeTeamId !== undefined ? String(homeTeamId) : null,
    awayTeamId: awayTeamId !== null && awayTeamId !== undefined ? String(awayTeamId) : null,
    homeTeamName: headerHome?.team?.displayName || rosterHome?.team?.displayName || boxHome?.team?.displayName || '',
    awayTeamName: headerAway?.team?.displayName || rosterAway?.team?.displayName || boxAway?.team?.displayName || ''
  };
};

const resolveEventTeamSide = (teamObj, homeTeamId, awayTeamId) => {
  const id = teamObj?.id !== undefined && teamObj?.id !== null ? String(teamObj.id) : null;
  if (id && homeTeamId && id === String(homeTeamId)) return 'home';
  if (id && awayTeamId && id === String(awayTeamId)) return 'away';
  if (teamObj?.homeAway === 'home') return 'home';
  if (teamObj?.homeAway === 'away') return 'away';
  return null;
};

const buildNormalizedEvent = (rawEvent, { homeTeamId, awayTeamId, order, clockOverride = null }) => {
  const classification = classifyMatchEvent(rawEvent);
  if (!classification) return null;

  const parsedClock = parseEventClock(clockOverride ?? rawEvent?.clock);
  const participants = Array.isArray(rawEvent?.participants) ? rawEvent.participants : [];
  const periodVal = Number(rawEvent?.period?.number ?? rawEvent?.period);
  const period = Number.isInteger(periodVal) && periodVal > 0 ? periodVal : null;
  const team = resolveEventTeamSide(rawEvent?.team, homeTeamId, awayTeamId);
  const teamId = rawEvent?.team?.id !== undefined && rawEvent?.team?.id !== null ? String(rawEvent.team.id) : null;

  let player = '';
  let playerId = null;
  let assist = '';
  let playerIn = '';
  let playerOut = '';
  let playerInId = null;
  let playerOutId = null;

  if (classification.eventType === 'SUBSTITUTION') {
    playerIn = getParticipantName(participants[0]);
    playerOut = getParticipantName(participants[1]);
    playerInId = getParticipantId(participants[0]);
    playerOutId = getParticipantId(participants[1]);
    if (!playerIn || !playerOut) {
      const parsedNames = extractFallbackSubstitutionNames(rawEvent);
      playerIn = playerIn || parsedNames.playerIn;
      playerOut = playerOut || parsedNames.playerOut;
    }
    player = playerIn || playerOut || '';
    playerId = playerInId || playerOutId || null;
  } else if (classification.eventType === 'VAR_DECISION') {
    player = getParticipantName(participants[0]);
    playerId = getParticipantId(participants[0]);
  } else {
    player = getParticipantName(participants[0]) || extractFallbackPlayerName(rawEvent);
    playerId = getParticipantId(participants[0]);
    if (classification.eventType === 'GOAL') {
      assist = getParticipantName(participants[1]);
    }
  }

  return {
    id: rawEvent?.id !== undefined && rawEvent?.id !== null ? String(rawEvent.id) : null,
    eventType: classification.eventType,
    type: classification.type,
    cardType: classification.cardType,
    label: classification.label,
    detail: classification.detail || '',
    time: parsedClock.time,
    minute: parsedClock.minute,
    addedTime: parsedClock.addedTime,
    period,
    team,
    teamId,
    player,
    playerId,
    assist,
    playerIn,
    playerOut,
    playerInId,
    playerOutId,
    _order: order
  };
};

export const normalizeMatchEvents = (summary = {}, { homeTeamId = null, awayTeamId = null } = {}) => {
  const rawKeyEvents = Array.isArray(summary?.keyEvents) ? summary.keyEvents : [];
  const normalized = [];
  const seenIds = new Set();
  const seenSignatures = new Set();

  const registerEvent = (evt) => {
    if (!evt) return;
    if (evt.id && seenIds.has(evt.id)) return;
    const sig = `${evt.eventType}|${evt.minute ?? ''}|${evt.addedTime}|${evt.teamId || evt.team || ''}|${(evt.player || '').toLowerCase()}`;
    if (seenSignatures.has(sig)) return;
    if (evt.id) seenIds.add(evt.id);
    seenSignatures.add(sig);
    normalized.push(evt);
  };

  rawKeyEvents.forEach((rawEvt, idx) => {
    registerEvent(buildNormalizedEvent(rawEvt, { homeTeamId, awayTeamId, order: idx }));
  });

  // Also capture structured VAR / missed / saved penalty events from commentary when absent from keyEvents
  const rawCommentary = Array.isArray(summary?.commentary) ? summary.commentary : [];
  const commentaryAllowedTypes = new Set(['VAR_DECISION', 'PENALTY_MISSED', 'PENALTY_SAVED']);

  rawCommentary.forEach((entry, idx) => {
    const play = entry?.play;
    if (!play || !play.type) return;
    const candidate = {
      ...play,
      text: entry?.text || play?.text || '',
      shortText: play?.shortText || '',
      clock: play?.clock || entry?.time
    };
    const built = buildNormalizedEvent(candidate, {
      homeTeamId,
      awayTeamId,
      order: rawKeyEvents.length + idx,
      clockOverride: play?.clock || entry?.time
    });
    if (built && commentaryAllowedTypes.has(built.eventType)) {
      registerEvent(built);
    }
  });

  return normalized
    .sort(compareMatchEvents)
    .map((evt) => {
      const copy = { ...evt };
      delete copy._order;
      return copy;
    });
};

const extractRealJerseyNumber = (entry = {}) => {
  const candidates = [
    entry?.jersey,
    entry?.athlete?.jersey,
    entry?.jerseyNumber,
    entry?.uniformNumber,
    entry?.athlete?.jerseyNumber
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const str = String(candidate).trim();
    if (/^\d{1,3}$/.test(str)) {
      return str;
    }
  }
  return null;
};

const extractPlayerPosition = (entry = {}) => {
  const rawPos = String(
    entry?.position?.displayName ||
    entry?.position?.name ||
    entry?.position?.abbreviation ||
    entry?.athlete?.position?.displayName ||
    entry?.athlete?.position?.name ||
    entry?.athlete?.position?.abbreviation ||
    ''
  ).trim();

  if (!rawPos || /^(sub|substitute|bench)$/i.test(rawPos)) {
    return { position: '', positionRaw: '' };
  }

  const translated = translatePosition(rawPos);
  return {
    position: translated && translated !== 'لاعب' ? translated : '',
    positionRaw: rawPos
  };
};

const VERIFIED_MATCH_RATING_STAT_NAMES = new Set([
  'matchrating',
  'playerrating',
  'performancerating',
  'espnrating',
  'whoscoredrating',
  'sofarating'
]);

const parseValidRatingValue = (rawVal, rawDisplay = '') => {
  if (rawVal === null || rawVal === undefined || rawVal === '' || typeof rawVal === 'boolean') {
    return null;
  }
  const num = Number(rawVal);
  if (!Number.isFinite(num) || num <= 0 || num > 10) {
    return null;
  }
  const cleanDisplay = typeof rawDisplay === 'string' ? rawDisplay.trim() : '';
  const ratingDisplay = /^\d{1,2}(?:\.\d{1,2})?$/.test(cleanDisplay) && Number(cleanDisplay) > 0 && Number(cleanDisplay) <= 10
    ? cleanDisplay
    : num.toFixed(1);
  return {
    rating: Number(num.toFixed(2)),
    ratingDisplay
  };
};

/**
 * يستخرج تقييم أداء اللاعب الخاص بالمباراة فقط من حقول موثقة وصريحة.
 * يرفض تماماً أرقام القمصان، متوسطات الموسم، نقاط الفانتازي، الإحصائيات العامة (الأهداف/التسديدات/التصديات)، والقيم الصفرية أو الخارجة عن (0..10].
 */
export const extractVerifiedPlayerRating = (entry = {}) => {
  if (!entry || typeof entry !== 'object') {
    return { rating: null, ratingDisplay: null };
  }

  // 1. حقول صريحة خاصة بتقييم المباراة على كائن اللاعب في التشكيلة
  const directCandidates = [
    entry.matchRating,
    entry.playerRating,
    entry.performanceRating
  ];
  for (const candidate of directCandidates) {
    if (candidate && typeof candidate === 'object') {
      const parsed = parseValidRatingValue(candidate.value ?? candidate.displayValue, candidate.displayValue);
      if (parsed) return parsed;
    } else {
      const parsed = parseValidRatingValue(candidate);
      if (parsed) return parsed;
    }
  }

  // 2. عنصر إحصائي صريح داخل entry.stats يحمل اسم تقييم مباراة موثق فقط
  const stats = Array.isArray(entry.stats) ? entry.stats : [];
  for (const stat of stats) {
    if (!stat || typeof stat !== 'object') continue;
    const statName = String(stat.name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!VERIFIED_MATCH_RATING_STAT_NAMES.has(statName)) continue;
    const parsed = parseValidRatingValue(stat.value ?? stat.displayValue, stat.displayValue);
    if (parsed) return parsed;
  }

  return { rating: null, ratingDisplay: null };
};

const extractPlaySubstitutionMinutes = (entry = {}) => {
  const plays = Array.isArray(entry?.plays) ? entry.plays : [];
  const subTimes = plays
    .filter(p => p?.substitution === true || String(p?.type?.text || '').toLowerCase().includes('substitution'))
    .map(p => parseEventClock(p?.clock))
    .filter(c => c.time !== '')
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.addedTime - b.addedTime);

  let subInMinute = null;
  let subOutMinute = null;

  if (entry?.subbedIn && entry?.subbedOut && subTimes.length >= 2) {
    subInMinute = subTimes[0].time;
    subOutMinute = subTimes[subTimes.length - 1].time;
  } else if (entry?.subbedIn && subTimes.length >= 1) {
    subInMinute = subTimes[0].time;
  } else if (entry?.subbedOut && subTimes.length >= 1) {
    subOutMinute = subTimes[0].time;
  }

  return { subInMinute, subOutMinute };
};

export const normalizeMatchRosters = (summary = {}, { homeTeamId = null, awayTeamId = null, homeTeamName = '', awayTeamName = '', events = [] } = {}) => {
  const rosterList = Array.isArray(summary?.rosters)
    ? summary.rosters
    : Object.values(summary?.rosters || {});

  const findTeamRoster = (targetId, side) => {
    if (targetId) {
      const byId = rosterList.find(r => r?.team?.id !== undefined && String(r.team.id) === String(targetId));
      if (byId) return byId;
    }
    const byHomeAway = rosterList.find(r => r?.homeAway === side);
    if (byHomeAway) return byHomeAway;
    return null;
  };

  let homeRoster = findTeamRoster(homeTeamId, 'home');
  let awayRoster = findTeamRoster(awayTeamId, 'away');

  if (!homeRoster && !awayRoster && rosterList.length >= 2) {
    homeRoster = rosterList[0];
    awayRoster = rosterList[1];
  } else if (homeRoster && !awayRoster && rosterList.length >= 2) {
    awayRoster = rosterList.find(r => r !== homeRoster) || null;
  } else if (!homeRoster && awayRoster && rosterList.length >= 2) {
    homeRoster = rosterList.find(r => r !== awayRoster) || null;
  }

  const subEventsBySide = {
    home: events.filter(e => e.eventType === 'SUBSTITUTION' && e.team === 'home'),
    away: events.filter(e => e.eventType === 'SUBSTITUTION' && e.team === 'away')
  };

  const mapTeamRoster = (teamRoster, side, fallbackId, fallbackName) => {
    const entries = Array.isArray(teamRoster?.roster) ? teamRoster.roster : [];
    const sideSubEvents = subEventsBySide[side] || [];
    const starters = [];
    const substitutes = [];

    entries.forEach((entry) => {
      const name = String(
        entry?.athlete?.displayName ||
        entry?.athlete?.fullName ||
        entry?.athlete?.shortName ||
        ''
      ).trim();
      if (!name) return;

      const id = entry?.athlete?.id !== undefined && entry?.athlete?.id !== null
        ? String(entry.athlete.id)
        : null;
      const jersey = extractRealJerseyNumber(entry);
      const { position, positionRaw } = extractPlayerPosition(entry);
      const { rating, ratingDisplay } = extractVerifiedPlayerRating(entry);
      const starter = entry?.starter === true;
      const playMinutes = extractPlaySubstitutionMinutes(entry);

      let subbedIn = entry?.subbedIn === true;
      let subbedOut = entry?.subbedOut === true;
      let subInMinute = playMinutes.subInMinute;
      let subOutMinute = playMinutes.subOutMinute;

      const lowerName = name.toLowerCase();
      for (const subEvt of sideSubEvents) {
        const matchedIn = (id && subEvt.playerInId && id === subEvt.playerInId) ||
          (subEvt.playerIn && subEvt.playerIn.toLowerCase() === lowerName);
        const matchedOut = (id && subEvt.playerOutId && id === subEvt.playerOutId) ||
          (subEvt.playerOut && subEvt.playerOut.toLowerCase() === lowerName);

        if (matchedIn) {
          subbedIn = true;
          if (!subInMinute && subEvt.time) subInMinute = subEvt.time;
        }
        if (matchedOut) {
          subbedOut = true;
          if (!subOutMinute && subEvt.time) subOutMinute = subEvt.time;
        }
      }

      const playerObj = {
        id,
        name,
        jersey,
        position,
        positionRaw,
        rating,
        ratingDisplay,
        starter,
        subbedIn,
        subbedOut,
        subInMinute: subInMinute || null,
        subOutMinute: subOutMinute || null
      };

      if (starter) {
        starters.push(playerObj);
      } else {
        substitutes.push(playerObj);
      }
    });

    return {
      teamId: teamRoster?.team?.id !== undefined && teamRoster?.team?.id !== null
        ? String(teamRoster.team.id)
        : fallbackId,
      teamName: teamRoster?.team?.displayName || fallbackName || '',
      formation: teamRoster?.formation ? String(teamRoster.formation).trim() : null,
      starters,
      substitutes
    };
  };

  return {
    home: mapTeamRoster(homeRoster, 'home', homeTeamId, homeTeamName),
    away: mapTeamRoster(awayRoster, 'away', awayTeamId, awayTeamName)
  };
};

// جلب تفاصيل المباراة الكاملة
export const getMatchDetails = async (leagueId, eventId, { forceRefresh = false } = {}) => {
  if (leagueId === 'egypt.1') {
    return getMockEgyptianMatchDetails(eventId);
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/summary?event=${eventId}`;
    const summary = await cachedJson(url, { ttl: 15000, forceRefresh });

    const { homeTeamId, awayTeamId, homeTeamName, awayTeamName } = resolveMatchTeamIds(summary);
    const boxscore = summary.boxscore || {};

    const statsObj = {
      possession: [50, 50],
      shots: [0, 0],
      shotsOnGoal: [0, 0],
      corners: [0, 0],
      fouls: [0, 0],
      yellowCards: [0, 0],
      redCards: [0, 0]
    };

    if (Array.isArray(boxscore.teams) && boxscore.teams.length >= 2) {
      const homeBoxTeam =
        boxscore.teams.find(t => homeTeamId && String(t?.team?.id) === homeTeamId) ||
        boxscore.teams.find(t => t?.homeAway === 'home') ||
        boxscore.teams[0];
      const awayBoxTeam =
        boxscore.teams.find(t => awayTeamId && String(t?.team?.id) === awayTeamId) ||
        boxscore.teams.find(t => t?.homeAway === 'away') ||
        boxscore.teams.find(t => t !== homeBoxTeam) ||
        boxscore.teams[1];

      const homeStats = homeBoxTeam?.statistics || [];
      const awayStats = awayBoxTeam?.statistics || [];

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

    const events = normalizeMatchEvents(summary, { homeTeamId, awayTeamId });
    const rosters = normalizeMatchRosters(summary, {
      homeTeamId,
      awayTeamId,
      homeTeamName,
      awayTeamName,
      events
    });

    const lineups = {
      home: rosters.home.starters.map(p => p.name),
      away: rosters.away.starters.map(p => p.name)
    };
    const substitutes = {
      home: rosters.home.substitutes,
      away: rosters.away.substitutes
    };

    const competition = summary.header?.competitions?.[0];
    const home = competition?.competitors?.find(c => c.homeAway === 'home');
    const away = competition?.competitors?.find(c => c.homeAway === 'away');
    const detailStatus = competition ? resolveEspnMatchStatus(competition.status) : 'NS';
    const detailPhase = competition ? resolveEspnMatchPhase(competition.status) : MATCH_PHASES.SCHEDULED;
    const detailIsHalfTime = detailPhase === MATCH_PHASES.HALFTIME || detailPhase === MATCH_PHASES.EXTRA_TIME_HALFTIME;
    const detailHasScore = detailStatus === 'FT' || detailStatus === 'LIVE';
    const detailRawClock = competition?.status?.displayClock
      ? String(competition.status.displayClock).replace(/['"’`\u2032]/g, '').trim()
      : '';
    const detailMinute = detailIsHalfTime
      ? 'HT'
      : detailPhase === MATCH_PHASES.PENALTIES
      ? 'PEN'
      : (detailRawClock || competition?.status?.clock || 0);
    const match = competition && home && away ? {
      id: String(eventId), leagueId,
      homeTeam: home.team?.displayName, awayTeam: away.team?.displayName,
      homeTeamId: home.team?.id ? String(home.team.id) : homeTeamId,
      awayTeamId: away.team?.id ? String(away.team.id) : awayTeamId,
      homeLogo: home.team?.logo || home.team?.logos?.[0]?.href,
      awayLogo: away.team?.logo || away.team?.logos?.[0]?.href,
      homeScore: detailHasScore ? Number(home.score?.value ?? home.score ?? 0) : null,
      awayScore: detailHasScore ? Number(away.score?.value ?? away.score ?? 0) : null,
      status: detailStatus,
      matchPhase: detailPhase,
      isHalfTime: detailIsHalfTime,
      period: Number.isInteger(Number(competition.status?.period)) ? Number(competition.status.period) : null,
      minute: detailMinute,
      ...parseMatchResult(competition.status, competition.competitors)
    } : null;

    return {
      match,
      stats: statsObj,
      events,
      lineups,
      rosters,
      substitutes
    };
  } catch (e) {
    console.error('Failed to load match details:', e);
    return null;
  }
};
