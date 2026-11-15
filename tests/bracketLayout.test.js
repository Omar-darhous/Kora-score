import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracket } from '../src/services/bracketLayout.js';
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
