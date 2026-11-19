import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatchResult, finishedMatchLabel, getFavoriteMatchDisplay} from '../src/services/matchResult.js';

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
test('favorites match display shows VS and kickoff time for NS and UPCOMING matches instead of 0 - 0',()=>{
 const nsMatch = getFavoriteMatchDisplay({ status: 'NS', time: '22:00', homeScore: 0, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(nsMatch.isUpcoming, true);
 assert.equal(nsMatch.centerText, 'VS');
 assert.equal(nsMatch.statusLabel, '22:00');

 const upcomingMatch = getFavoriteMatchDisplay({ status: 'UPCOMING', time: '19:30', homeScore: 0, awayScore: 0, leagueId: 'esp.1' });
 assert.equal(upcomingMatch.isUpcoming, true);
 assert.equal(upcomingMatch.centerText, 'VS');
 assert.equal(upcomingMatch.statusLabel, '19:30');

 const nsWithoutTime = getFavoriteMatchDisplay({ status: 'NS', time: '', homeScore: 0, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(nsWithoutTime.isUpcoming, true);
 assert.equal(nsWithoutTime.centerText, 'VS');
 assert.equal(nsWithoutTime.statusLabel, 'قادمة');
});
test('favorites match display preserves scores and labels for LIVE, FT, AET and PEN matches',()=>{
 const liveMatch = getFavoriteMatchDisplay({ status: 'LIVE', minute: '64', homeScore: 2, awayScore: 1, leagueId: 'eng.1' });
 assert.equal(liveMatch.isUpcoming, false);
 assert.equal(liveMatch.isLive, true);
 assert.equal(liveMatch.centerText, '2 - 1');
 assert.equal(liveMatch.statusLabel, 'مباشر • 64');

 const ftMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'regular', homeScore: 3, awayScore: 0, leagueId: 'eng.1' });
 assert.equal(ftMatch.isUpcoming, false);
 assert.equal(ftMatch.centerText, '3 - 0');
 assert.equal(ftMatch.statusLabel, 'انتهت');

 const aetMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'extra-time', homeScore: 2, awayScore: 1, leagueId: 'uefa.champions' });
 assert.equal(aetMatch.centerText, '2 - 1');
 assert.equal(aetMatch.statusLabel, 'انتهت بعد الأشواط الإضافية');

 const penMatch = getFavoriteMatchDisplay({ status: 'FT', finishType: 'penalties', homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4, leagueId: 'fifa.world' });
 assert.equal(penMatch.centerText, '1 - 1');
 assert.match(penMatch.statusLabel, /انتهت بركلات الترجيح/);
 assert.match(penMatch.statusLabel, /5 - 4/);
});
