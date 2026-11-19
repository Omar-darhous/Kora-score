export const BRACKET_ROUNDS = [['playoff','الملحق'],['r32','دور الـ32'],['r16','دور الـ16'],['qf','ربع النهائي'],['sf','نصف النهائي'],['final','النهائي']];
export const MIN_BRACKET_ZOOM = 0.25;
export const MAX_BRACKET_ZOOM = 1.2;

export function clampBracketZoom(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.85;
  return Math.max(MIN_BRACKET_ZOOM, Math.min(MAX_BRACKET_ZOOM, +num.toFixed(2)));
}

const isValidParticipantId = (id) =>
  id !== null && id !== undefined && String(id).trim() !== '' && String(id) !== 'null' && String(id) !== 'undefined';

function buildTwoLeggedTie(legs, incomplete = false) {
  const sorted = [...legs].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });
  const leg1 = sorted[0];
  const leg2 = sorted[1] || null;
  const homeTeamId = leg1.homeTeamId;
  const awayTeamId = leg1.awayTeamId;
  const homeTeam = leg1.homeTeam;
  const awayTeam = leg1.awayTeam;

  const hasLeg1Score = leg1.status !== 'NS' && Number.isFinite(leg1.homeScore) && Number.isFinite(leg1.awayScore);
  const leg1Score = hasLeg1Score ? [leg1.homeScore, leg1.awayScore] : null;

  if (!leg2 || incomplete) {
    return {
      ...leg1,
      id: `tie-${homeTeamId}-${awayTeamId}-${leg1.id}`,
      isTwoLegged: true,
      incompleteLegs: true,
      legs: [leg1],
      leg1Score,
      leg2Score: null,
      aggregateScore: null,
      homeScore: leg1Score ? leg1Score[0] : null,
      awayScore: leg1Score ? leg1Score[1] : null,
      homeWinner: false,
      awayWinner: false,
      finishType: null,
      homePenalties: null,
      awayPenalties: null
    };
  }

  const sameOrderInLeg2 = String(leg2.homeTeamId) === String(homeTeamId);
  const rawLeg2Home = sameOrderInLeg2 ? leg2.homeScore : leg2.awayScore;
  const rawLeg2Away = sameOrderInLeg2 ? leg2.awayScore : leg2.homeScore;
  const hasLeg2Score = leg2.status !== 'NS' && Number.isFinite(rawLeg2Home) && Number.isFinite(rawLeg2Away);
  const leg2Score = hasLeg2Score ? [rawLeg2Home, rawLeg2Away] : null;

  const bothLegsHaveScores = Boolean(leg1Score && leg2Score);
  const aggregateScore = bothLegsHaveScores
    ? [leg1Score[0] + leg2Score[0], leg1Score[1] + leg2Score[1]]
    : null;

  const bothFinished = leg1.status === 'FT' && leg2.status === 'FT';
  const anyLive = leg1.status === 'LIVE' || leg2.status === 'LIVE';
  const status = anyLive ? 'LIVE' : bothFinished ? 'FT' : 'NS';

  const finishType = bothFinished
    ? leg2.finishType === 'penalties'
      ? 'penalties'
      : leg2.finishType === 'extra-time' || leg1.finishType === 'extra-time'
      ? 'extra-time'
      : 'regular'
    : null;

  const homePenalties =
    finishType === 'penalties'
      ? sameOrderInLeg2
        ? leg2.homePenalties
        : leg2.awayPenalties
      : null;
  const awayPenalties =
    finishType === 'penalties'
      ? sameOrderInLeg2
        ? leg2.awayPenalties
        : leg2.homePenalties
      : null;

  let homeWinner = false;
  let awayWinner = false;
  if (bothFinished && aggregateScore) {
    if (finishType === 'penalties') {
      const leg2WinnerId = leg2.homeWinner
        ? String(leg2.homeTeamId)
        : leg2.awayWinner
        ? String(leg2.awayTeamId)
        : null;
      if (leg2WinnerId === String(homeTeamId)) homeWinner = true;
      else if (leg2WinnerId === String(awayTeamId)) awayWinner = true;
      else if (Number.isFinite(homePenalties) && Number.isFinite(awayPenalties) && homePenalties !== awayPenalties) {
        homeWinner = homePenalties > awayPenalties;
        awayWinner = awayPenalties > homePenalties;
      }
    } else if (aggregateScore[0] !== aggregateScore[1]) {
      homeWinner = aggregateScore[0] > aggregateScore[1];
      awayWinner = aggregateScore[1] > aggregateScore[0];
    }
  }

  return {
    ...leg2,
    id: `tie-${[String(homeTeamId), String(awayTeamId)].sort().join('-')}-${leg1.id}`,
    isTwoLegged: true,
    incompleteLegs: false,
    legs: [leg1, leg2],
    homeTeamId,
    awayTeamId,
    homeTeam,
    awayTeam,
    homeLogo: leg1.homeLogo || (sameOrderInLeg2 ? leg2.homeLogo : leg2.awayLogo),
    awayLogo: leg1.awayLogo || (sameOrderInLeg2 ? leg2.awayLogo : leg2.homeLogo),
    leg1Score,
    leg2Score,
    aggregateScore,
    homeScore: aggregateScore ? aggregateScore[0] : null,
    awayScore: aggregateScore ? aggregateScore[1] : null,
    status,
    finishType,
    homePenalties,
    awayPenalties,
    homeWinner,
    awayWinner,
    time: leg2.time || leg1.time
  };
}

export function normalizeRoundMatches(matches = [], roundKey = '') {
  if (!Array.isArray(matches) || matches.length === 0) return [];
  if (roundKey === 'final' || roundKey === 'thirdPlace') return matches;

  const pairBuckets = new Map();
  const ungrouped = [];

  for (const match of matches) {
    if (
      isValidParticipantId(match?.homeTeamId) &&
      isValidParticipantId(match?.awayTeamId) &&
      String(match.homeTeamId) !== String(match.awayTeamId)
    ) {
      const key = [String(match.homeTeamId), String(match.awayTeamId)].sort().join(':');
      if (!pairBuckets.has(key)) pairBuckets.set(key, []);
      pairBuckets.get(key).push(match);
    } else {
      ungrouped.push(match);
    }
  }

  const hasTwoLeggedPattern =
    Array.from(pairBuckets.values()).some((group) => group.length === 2) ||
    matches.some((m) => m?.isTwoLegged || m?.leg === 1 || m?.leg === 2);

  if (!hasTwoLeggedPattern) return matches;

  const normalized = [];
  for (const group of pairBuckets.values()) {
    if (group.length === 2) {
      normalized.push(buildTwoLeggedTie(group, false));
    } else if (group.length === 1) {
      normalized.push(buildTwoLeggedTie(group, true));
    } else {
      normalized.push(...group);
    }
  }
  return [...normalized, ...ungrouped];
}

export function buildBracket(data, start = null) {
  const available = BRACKET_ROUNDS.filter(([key]) => data?.[key]?.length);
  const first = start ? available.findIndex(([key]) => key === start) : 0;
  const rounds = available.slice(Math.max(0, first));
  const nodes = rounds.flatMap(([round], column) =>
    normalizeRoundMatches(data[round], round).map((match, index) => ({
      id: String(match.id),
      match,
      round,
      column,
      indexInRound: index,
      parents: [],
      next: null
    }))
  );
  for (const node of nodes) {
    if (node.match.incompleteLegs) continue;
    const advancingIds = node.match.homeWinner
      ? [String(node.match.homeTeamId)]
      : node.match.awayWinner
      ? [String(node.match.awayTeamId)]
      : [node.match.homeTeamId, node.match.awayTeamId].filter(isValidParticipantId).map(String);
    if (!advancingIds.length) continue;
    // Link only when the next round actually names this team in a single target tie. No assumed pairings.
    const candidates = nodes.filter(
      (next) =>
        next.column === node.column + 1 &&
        [next.match.homeTeamId, next.match.awayTeamId].some((id) => id && advancingIds.includes(String(id)))
    );
    if (candidates.length === 1) {
      node.next = candidates[0].id;
      candidates[0].parents.push(node);
    }
  }
  let leaf = 0;
  const visited = new Set();
  function position(node) {
    if (visited.has(node.id)) return node.y;
    visited.add(node.id);
    const ys = node.parents.map(position);
    node.y = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : leaf++ * 222;
    return node.y;
  }
  // Walk back from the final so related feeders sit next to each other.
  for (const node of [...nodes].sort((a, b) => b.column - a.column)) position(node);
  // Avoid overlapping cards when a provider supplies incomplete or two-leg rounds.
  for (let column = 0; column < rounds.length; column++) {
    const peers = nodes.filter((n) => n.column === column).sort((a, b) => a.y - b.y);
    for (let i = 1; i < peers.length; i++) peers[i].y = Math.max(peers[i].y, peers[i - 1].y + 222);
  }
  return {
    rounds,
    nodes,
    height: Math.max(240, ...nodes.map((n) => n.y + 210)),
    width: Math.max(1, rounds.length) * 352 - 52
  };
}
