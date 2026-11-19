import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracket, clampBracketZoom, MIN_BRACKET_ZOOM, MAX_BRACKET_ZOOM } from '../src/services/bracketLayout.js';
import { parseMatchResult } from '../src/services/matchResult.js';
const m=(id,homeTeamId,awayTeamId)=>({id,homeTeamId,awayTeamId});
test('feeders follow actual teams rather than chronological pairing',()=>{
 const data={qf:[m('a','1','2'),m('b','3','4'),m('c','5','6'),m('d','7','8')],sf:[m('s1','1','5'),m('s2','3','7')],final:[m('f','1','7')]};
 const {nodes}=buildBracket(data);const get=id=>nodes.find(n=>n.id===id);
 assert.equal(get('a').next,'s1');assert.equal(get('c').next,'s1');
 assert.equal(get('b').next,'s2');assert.equal(get('d').next,'s2');
 assert.equal(get('s1').y,(get('a').y+get('c').y)/2);
 assert.equal(get('s2').next,'f');
});
test('unknown destinations stay unlinked and third place stays separate',()=>{
 const graph=buildBracket({sf:[m('s','1','2')],final:[m('f',null,null)],thirdPlace:[m('b','3','4')]});
 assert.equal(graph.nodes.length,2);assert.equal(graph.nodes[0].next,null);
});
test('changing start round hides earlier rounds without altering destinations',()=>{
 const graph=buildBracket({r16:[m('r','1','2')],qf:[m('q','1','3')],sf:[m('s','1','4')]},'qf');
 assert.equal(graph.rounds.length,2);assert.equal(graph.nodes[0].next,'s');
});
test('period totals exclude shootout and preserve cumulative extra-time score',()=>{
 const sides=[{homeAway:'home',linescores:[0,1,1,0,4].map(value=>({value})),shootoutScore:4},{homeAway:'away',linescores:[1,0,0,1,3].map(displayValue=>({displayValue})),shootoutScore:3}];
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_PEN'}},sides);
 assert.deepEqual(result.regulationScore,[1,1]);assert.deepEqual(result.extraTimeScore,[2,2]);assert.equal(result.homePenalties,4);
});
test('missing period scores remain unknown',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_AET'}},[{homeAway:'home',score:2},{homeAway:'away',score:1}]);
 assert.equal(result.regulationScore,null);assert.equal(result.extraTimeScore,null);
});
test('two-legged European ties group home and away legs, compute aggregate, keep both legs accessible, and connect rounds',()=>{
 const data={
  qf:[
   {id:'q1-l1',date:'2025-04-08T19:00Z',homeTeamId:'359',awayTeamId:'86',homeTeam:'Arsenal',awayTeam:'Real Madrid',homeScore:3,awayScore:0,status:'FT',finishType:'regular'},
   {id:'q1-l2',date:'2025-04-16T19:00Z',homeTeamId:'86',awayTeamId:'359',homeTeam:'Real Madrid',awayTeam:'Arsenal',homeScore:1,awayScore:2,status:'FT',finishType:'regular'},
   {id:'q2-l1',date:'2025-04-09T19:00Z',homeTeamId:'160',awayTeamId:'362',homeTeam:'PSG',awayTeam:'Aston Villa',homeScore:3,awayScore:1,status:'FT',finishType:'regular'},
   {id:'q2-l2',date:'2025-04-15T19:00Z',homeTeamId:'362',awayTeamId:'160',homeTeam:'Aston Villa',awayTeam:'PSG',homeScore:3,awayScore:2,status:'FT',finishType:'regular'}
  ],
  sf:[
   {id:'s1-l1',date:'2025-04-29T19:00Z',homeTeamId:'359',awayTeamId:'160',homeTeam:'Arsenal',awayTeam:'PSG',homeScore:0,awayScore:1,status:'FT',finishType:'regular'},
   {id:'s1-l2',date:'2025-05-07T19:00Z',homeTeamId:'160',awayTeamId:'359',homeTeam:'PSG',awayTeam:'Arsenal',homeScore:2,awayScore:1,status:'FT',finishType:'regular'}
  ],
  final:[
   {id:'f-1',date:'2025-05-31T19:00Z',homeTeamId:'160',awayTeamId:'110',homeTeam:'PSG',awayTeam:'Inter',homeScore:5,awayScore:0,status:'FT',finishType:'regular',homeWinner:true}
  ]
 };
 const {nodes}=buildBracket(data);
 const qfNodes=nodes.filter(n=>n.round==='qf');
 const sfNodes=nodes.filter(n=>n.round==='sf');
 const finalNode=nodes.find(n=>n.round==='final');

 assert.equal(qfNodes.length,2);
 assert.equal(sfNodes.length,1);
 assert.equal(qfNodes[0].match.isTwoLegged,true);
 assert.equal(qfNodes[0].match.legs.length,2);
 assert.deepEqual(qfNodes[0].match.leg1Score,[3,0]);
 assert.deepEqual(qfNodes[0].match.leg2Score,[2,1]);
 assert.deepEqual(qfNodes[0].match.aggregateScore,[5,1]);
 assert.equal(qfNodes[0].match.homeWinner,true);
 assert.equal(qfNodes[0].match.awayWinner,false);

 assert.deepEqual(qfNodes[1].match.aggregateScore,[5,4]);
 assert.equal(qfNodes[1].match.homeWinner,true);

 // Both QF two-legged ties connect to the SF two-legged tie, and SF connects to Final
 assert.equal(qfNodes[0].next,sfNodes[0].id);
 assert.equal(qfNodes[1].next,sfNodes[0].id);
 assert.equal(sfNodes[0].next,finalNode.id);
 assert.equal(finalNode.match.isTwoLegged,undefined);
});
test('two-legged tie decided by penalties maps shootout scores and winner to canonical home/away order',()=>{
 const data={
  r16:[
   {id:'r1-l1',date:'2025-03-05T20:00Z',homeTeamId:'160',awayTeamId:'364',homeTeam:'PSG',awayTeam:'Liverpool',homeScore:0,awayScore:1,status:'FT',finishType:'regular'},
   {id:'r1-l2',date:'2025-03-11T20:00Z',homeTeamId:'364',awayTeamId:'160',homeTeam:'Liverpool',awayTeam:'PSG',homeScore:0,awayScore:1,status:'FT',finishType:'penalties',homePenalties:1,awayPenalties:4,homeWinner:false,awayWinner:true}
  ]
 };
 const {nodes}=buildBracket(data);
 assert.equal(nodes.length,1);
 const tie=nodes[0].match;
 assert.deepEqual(tie.aggregateScore,[1,1]);
 assert.equal(tie.finishType,'penalties');
 // PSG is canonical home (from leg1), Liverpool is canonical away
 assert.equal(tie.homePenalties,4);
 assert.equal(tie.awayPenalties,1);
 assert.equal(tie.homeWinner,true);
 assert.equal(tie.awayWinner,false);
});
test('incomplete two-legged tie does not fabricate aggregate score, winner or progression link',()=>{
 const data={
  qf:[
   {id:'q1-l1',date:'2025-04-08T19:00Z',homeTeamId:'1',awayTeamId:'2',homeTeam:'Team 1',awayTeam:'Team 2',homeScore:2,awayScore:0,status:'FT'},
   {id:'q1-l2',date:'2025-04-15T19:00Z',homeTeamId:'2',awayTeamId:'1',homeTeam:'Team 2',awayTeam:'Team 1',homeScore:0,awayScore:1,status:'FT'},
   {id:'q2-l1',date:'2025-04-09T19:00Z',homeTeamId:'3',awayTeamId:'4',homeTeam:'Team 3',awayTeam:'Team 4',homeScore:1,awayScore:0,status:'FT'}
  ],
  sf:[
   {id:'s1-l1',date:'2025-04-29T19:00Z',homeTeamId:'1',awayTeamId:'3',homeTeam:'Team 1',awayTeam:'Team 3',homeScore:null,awayScore:null,status:'NS'}
  ]
 };
 const {nodes}=buildBracket(data);
 const incompleteNode=nodes.find(n=>n.match.homeTeamId==='3');
 assert.equal(incompleteNode.match.isTwoLegged,true);
 assert.equal(incompleteNode.match.incompleteLegs,true);
 assert.equal(incompleteNode.match.aggregateScore,null);
 assert.equal(incompleteNode.match.homeWinner,false);
 assert.equal(incompleteNode.match.awayWinner,false);
 assert.equal(incompleteNode.next,null);
});
test('zoom boundaries are unified between manual zoom and fit-to-screen',()=>{
 assert.equal(MIN_BRACKET_ZOOM,0.25);
 assert.equal(MAX_BRACKET_ZOOM,1.2);
 assert.equal(clampBracketZoom(0.1),0.25);
 assert.equal(clampBracketZoom(0.35 - 0.1),0.25);
 assert.equal(clampBracketZoom(1.5),1.2);
 assert.equal(clampBracketZoom(0.756),0.76);
});
