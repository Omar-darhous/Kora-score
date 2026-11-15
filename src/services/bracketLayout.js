export const BRACKET_ROUNDS = [['playoff','الملحق'],['r32','دور الـ32'],['r16','دور الـ16'],['qf','ربع النهائي'],['sf','نصف النهائي'],['final','النهائي']];
export function buildBracket(data, start = null) {
  const available = BRACKET_ROUNDS.filter(([key]) => data?.[key]?.length);
  const first = start ? available.findIndex(([key]) => key === start) : 0;
  const rounds = available.slice(Math.max(0, first));
  const nodes = rounds.flatMap(([round], column) => data[round].map(match => ({id: String(match.id), match, round, column, parents: [], next: null})));
  for (const node of nodes) {
    const ids = [node.match.homeTeamId, node.match.awayTeamId].filter(Boolean).map(String);
    // Link only when the next round actually names this team. No assumed pairings.
    const candidates = nodes.filter(next => next.column === node.column + 1 && [next.match.homeTeamId,next.match.awayTeamId].some(id => id && ids.includes(String(id))));
    if (candidates.length === 1) { node.next = candidates[0].id; candidates[0].parents.push(node); }
  }
  let leaf = 0;
  const visited = new Set();
  function position(node) {
    if (visited.has(node.id)) return node.y;
    visited.add(node.id);
    const ys = node.parents.map(position);
    node.y = ys.length ? ys.reduce((a,b) => a+b,0) / ys.length : leaf++ * 222;
    return node.y;
  }
  // Walk back from the final so related feeders sit next to each other.
  for (const node of [...nodes].sort((a,b)=>b.column-a.column)) position(node);
  // Avoid overlapping cards when a provider supplies incomplete or two-leg rounds.
  for (let column=0; column<rounds.length; column++) {
    const peers=nodes.filter(n=>n.column===column).sort((a,b)=>a.y-b.y);
    for(let i=1;i<peers.length;i++) peers[i].y=Math.max(peers[i].y,peers[i-1].y+222);
  }
  return { rounds, nodes, height: Math.max(240,...nodes.map(n=>n.y+210)), width: Math.max(1,rounds.length)*352-52 };
}
