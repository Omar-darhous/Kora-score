import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchResult, finishedMatchLabel} from '../src/services/matchResult.js';

test('ordinary draw is not inferred to be extra time or penalties',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FULL_TIME'}},[]);
 assert.equal(result.finishType,'regular');
 assert.equal(finishedMatchLabel(result),'انتهت');
});
test('extra time is explicit, including a non-drawn result',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_AET'}},[]);
 assert.equal(finishedMatchLabel(result),'انتهت بعد الأشواط الإضافية');
});
test('penalty scores preserve home/away order and zero',()=>{
 const result=parseMatchResult({type:{state:'post',name:'STATUS_FINAL_PEN'}},[{homeAway:'away',shootoutScore:{value:3},winner:true},{homeAway:'home',shootoutScore:0}]);
 assert.equal(result.homePenalties,0);
 assert.equal(result.awayPenalties,3);
 assert.equal(result.awayWinner,true);
 assert.match(finishedMatchLabel(result),/0 - 3/);
});
test('missing shootout scores are never invented as 0-0',()=>{
 const result=parseMatchResult({type:{state:'post',detail:'FT-Pens'}},[]);
 assert.equal(result.homePenalties,null);
 assert.equal(finishedMatchLabel(result),'انتهت بركلات الترجيح');
});
test('ongoing shootout is not marked as a finished match',()=>{
 assert.equal(parseMatchResult({type:{state:'in',description:'Penalties'}},[]).finishType,null);
});
