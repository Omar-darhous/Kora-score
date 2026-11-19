import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache } from '../src/services/requestCache.js';
import { subscribeToLiveMatches, getMatches, getStandings, createStandingsController } from '../src/services/footballService.js';
const ok = data => ({ok:true,json:async()=>data});
const defer = () => {
 let resolve, reject;
 const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
 return { promise, resolve, reject };
};
test('cache reuses fresh values, expires and isolates callers mutations',async()=>{
 let time=0,calls=0;const get=createRequestCache({now:()=>time,fetcher:async()=>ok({value:++calls})});
 const first=await get('a',{ttl:100});first.value=99;
 assert.equal((await get('a',{ttl:100})).value,1);assert.equal(calls,1);
 time=100;assert.equal((await get('a',{ttl:100})).value,2);
});
test('concurrent callers share one pending request',async()=>{
 let release,calls=0;const get=createRequestCache({fetcher:()=>{calls++;return new Promise(r=>release=r)}});
 const a=get('a');const b=get('a');release(ok({items:[]}));
 const [one,two]=await Promise.all([a,b]);one.items.push(1);
 assert.equal(calls,1);assert.deepEqual(two.items,[]);
});
test('HTTP and provider errors are not cached and retry succeeds',async()=>{
 let calls=0;const get=createRequestCache({fetcher:async()=>++calls===1?{ok:false,status:503}:calls===2?ok({status:'error'}):ok({value:3})});
 await assert.rejects(get('a'));await assert.rejects(get('a'));assert.equal((await get('a')).value,3);assert.equal(calls,3);
});
test('malformed JSON and network rejection release pending entries',async()=>{
 let calls=0;const get=createRequestCache({fetcher:async()=>{calls++;if(calls===1)throw Error('offline');if(calls===2)return {ok:true,json:async()=>{throw Error('invalid JSON')}};return ok([])}});
 await assert.rejects(get('a'));await assert.rejects(get('a'));assert.deepEqual(await get('a'),[]);
});
test('force refresh fetches new data while URLs remain isolated',async()=>{
 let calls=0;const get=createRequestCache({fetcher:async()=>ok(++calls)});
 assert.equal(await get('date=1'),1);assert.equal(await get('date=2'),2);assert.equal(await get('date=1'),1);
 assert.equal(await get('date=1',{forceRefresh:true}),3);
});
test('cache is bounded and evicts old entries',async()=>{
 let calls=0;const get=createRequestCache({maxEntries:2,fetcher:async()=>ok(++calls)});
 await get('a');await get('b');await get('c');assert.equal(await get('a'),4);
});
test('subscribeToLiveMatches handles full success, partial failure, total failure, recovery and cleanup',async()=>{
 const originalFetch=globalThis.fetch;
 const originalError=console.error;
 console.error=()=>{};
 const makeEvent=(id,homeName,homeScore,awayName,awayScore,state='in',clock="30'")=>({
  id,
  date:'2026-11-17T20:00:00Z',
  status:{type:{state},displayClock:clock},
  competitions:[{competitors:[
   {homeAway:'home',score:String(homeScore),team:{id:id+'-h',displayName:homeName}},
   {homeAway:'away',score:String(awayScore),team:{id:id+'-a',displayName:awayName}}
  ]}]
 });

 let mode='all-ok';
 globalThis.fetch=async url=>{
  if(mode==='all-fail') return {ok:false,status:503};
  if(url.includes('/eng.1/scoreboard')) {
   if(mode==='all-ok') return ok({events:[makeEvent('eng-1','Arsenal',1,'Chelsea',0,'in',"25'")]});
   if(mode==='partial-fail') return ok({events:[makeEvent('eng-1','Arsenal',2,'Chelsea',0,'in',"55'")]});
   if(mode==='recovered') return ok({events:[makeEvent('eng-1','Arsenal',2,'Chelsea',1,'post',"90'")]});
   if(mode==='sub2-only') return ok({events:[makeEvent('eng-1','Arsenal',3,'Chelsea',1,'post',"90'")]});
  }
  if(url.includes('/esp.1/scoreboard')) {
   if(mode==='partial-fail') return {ok:false,status:500};
   if(mode==='all-ok') return ok({events:[makeEvent('esp-1','Real Madrid',0,'Barcelona',0,'in',"30'")]});
   if(mode==='recovered' || mode==='sub2-only') return ok({events:[makeEvent('esp-1','Real Madrid',1,'Barcelona',1,'in',"80'")]});
  }
  return ok({events:[]});
 };

 let pollTick=null,intervalMsUsed=0,setCalls=0,clearedTimerId=null;
 const sub1Updates=[],sub2Updates=[];
 try {
  const unsub1=subscribeToLiveMatches(matches=>sub1Updates.push(matches),{
   dateStr:'20261117',
   setIntervalFn:(fn,ms)=>{setCalls++;pollTick=fn;intervalMsUsed=ms;return 901;},
   clearIntervalFn:id=>{clearedTimerId=id;pollTick=null;}
  });
  assert.equal(setCalls,1);
  assert.equal(intervalMsUsed,30000);

  // 1. All competitions succeeding
  await pollTick();
  assert.equal(sub1Updates.length,1);
  assert.equal(sub1Updates[0].length,2);
  assert.equal(sub1Updates[0].find(m=>m.id==='eng-1')?.homeScore,1);
  assert.equal(sub1Updates[0].find(m=>m.id==='esp-1')?.homeScore,0);

  // Unchanged poll does not trigger redundant UI update
  await pollTick();
  assert.equal(sub1Updates.length,1);

  // 2. One competition failing (esp.1) while others succeed (eng.1 updates to 2-0)
  mode='partial-fail';
  await pollTick();
  assert.equal(sub1Updates.length,2);
  assert.equal(sub1Updates[1].length,2);
  assert.equal(sub1Updates[1].find(m=>m.id==='eng-1')?.homeScore,2);
  assert.equal(sub1Updates[1].find(m=>m.id==='esp-1')?.homeScore,0);

  // 3. All competitions failing (keeps last valid state, no empty overwrite)
  mode='all-fail';
  await pollTick();
  assert.equal(sub1Updates.length,2);

  // 4. Recovery after failed polling cycle
  mode='recovered';
  await pollTick();
  assert.equal(sub1Updates.length,3);
  assert.equal(sub1Updates[2].find(m=>m.id==='eng-1')?.awayScore,1);
  assert.equal(sub1Updates[2].find(m=>m.id==='eng-1')?.status,'FT');
  assert.equal(sub1Updates[2].find(m=>m.id==='esp-1')?.homeScore,1);

  // 5. Unsubscribing and timer cleanup
  const unsub2=subscribeToLiveMatches(matches=>sub2Updates.push(matches),{dateStr:'20261117'});
  assert.equal(setCalls,1);
  unsub1();
  assert.equal(clearedTimerId,null);

  mode='sub2-only';
  await pollTick();
  assert.equal(sub1Updates.length,3);
  assert.equal(sub2Updates.length,1);
  assert.equal(sub2Updates[0].find(m=>m.id==='eng-1')?.homeScore,3);

  unsub2();
  assert.equal(clearedTimerId,901);
  assert.equal(pollTick,null);
 } finally {
  globalThis.fetch=originalFetch;
  console.error=originalError;
 }
});
test('forceRefresh starts a fresh request while older is pending, prevents stale overwrite, and preserves pending cleanup',async()=>{
 const d1=defer(),d2=defer(),d3=defer();
 const queue=[d1,d2,d3];
 let calls=0;
 const get=createRequestCache({now:()=>1000,fetcher:()=>queue[calls++].promise});

 // 1. Older request pending when forceRefresh starts
 const req1=get('live-url',{ttl:15000,forceRefresh:false});
 assert.equal(calls,1);
 const req2=get('live-url',{ttl:15000,forceRefresh:true});
 assert.equal(calls,2);

 // 2. Newer response resolving before older response
 d2.resolve(ok({score:'2-0 (newer)'}));
 assert.deepEqual(await req2,{score:'2-0 (newer)'});

 // 3. Older response resolving after newer response cannot overwrite cache
 d1.resolve(ok({score:'1-0 (stale)'}));
 assert.deepEqual(await req1,{score:'2-0 (newer)'});
 assert.deepEqual(await get('live-url',{ttl:15000,forceRefresh:false}),{score:'2-0 (newer)'});
 assert.equal(calls,2);

 // 4. Newer request failing preserves last valid cached data
 d3.resolve({ok:false,status:503});
 await assert.rejects(get('live-url',{ttl:15000,forceRefresh:true}));
 assert.deepEqual(await get('live-url',{ttl:15000,forceRefresh:false}),{score:'2-0 (newer)'});
});
test('older request finishing first does not remove newer pending request from deduplication',async()=>{
 const older=defer(),newer=defer();
 const queue=[older,newer];
 let calls=0;
 const get=createRequestCache({now:()=>1000,fetcher:()=>queue[calls++].promise});

 const reqOld=get('url-cleanup',{ttl:15000,forceRefresh:false});
 const reqNew=get('url-cleanup',{ttl:15000,forceRefresh:true});
 assert.equal(calls,2);

 // Older resolves while newer is still pending
 older.resolve(ok({v:'old'}));
 await reqOld;

 // Non-forced caller while newer is still pending must join reqNew (no 3rd network call)
 const joined=get('url-cleanup',{ttl:15000,forceRefresh:false});
 assert.equal(calls,2);

 newer.resolve(ok({v:'new'}));
 assert.deepEqual(await reqNew,{v:'new'});
 assert.deepEqual(await joined,{v:'new'});
});
test('leagueMatchesSnapshot is protected from out-of-order stale responses',async()=>{
 const originalFetch=globalThis.fetch;
 const originalError=console.error;
 console.error=()=>{};
 const slowOld=defer(),fastNew=defer();
 let engCalls=0;
 const makeScoreEvent=score=>({
  id:'race-1',
  date:'2026-11-18T20:00:00Z',
  status:{type:{state:'in'},displayClock:"60'"},
  competitions:[{competitors:[
   {homeAway:'home',score:String(score),team:{id:'h1',displayName:'Liverpool'}},
   {homeAway:'away',score:'0',team:{id:'a1',displayName:'Arsenal'}}
  ]}]
 });

 globalThis.fetch=async url=>{
  if(url.includes('/eng.1/scoreboard')) {
   engCalls++;
   if(engCalls===1) return slowOld.promise;
   if(engCalls===2) return fastNew.promise;
   return {ok:false,status:503};
  }
  return ok({events:[]});
 };

 try {
  // Start slow initial request (1-0) then fast forced refresh (3-0)
  const call1=getMatches('20261118',{strict:true,forceRefresh:false});
  const call2=getMatches('20261118',{strict:true,forceRefresh:true});

  // Newer response resolves first with 3-0
  fastNew.resolve(ok({events:[makeScoreEvent(3)]}));
  const res2=await call2;
  assert.equal(res2.find(m=>m.id==='race-1')?.homeScore,3);

  // Older response resolves later with stale 1-0 — must not overwrite snapshot
  slowOld.resolve(ok({events:[makeScoreEvent(1)]}));
  const res1=await call1;
  assert.equal(res1.find(m=>m.id==='race-1')?.homeScore,3);

  // Subsequent failed refresh falls back to leagueMatchesSnapshot and still sees 3-0
  const res3=await getMatches('20261118',{strict:false,forceRefresh:true});
  assert.equal(res3.find(m=>m.id==='race-1')?.homeScore,3);
 } finally {
  globalThis.fetch=originalFetch;
  console.error=originalError;
 }
});
test('getStandings distinguishes successful response, valid empty response, API failure and forceRefresh retry',async()=>{
 const originalFetch=globalThis.fetch;
 const originalError=console.error;
 console.error=()=>{};
 let step='fail';
 let fetchCalls=0;
 const sampleEntry={
  team:{id:'364',displayName:'Liverpool',logos:[{href:'https://a.espncdn.com/i/teamlogos/soccer/500/364.png'}]},
  stats:[{name:'rank',value:1},{name:'gamesPlayed',value:10},{name:'wins',value:8},{name:'ties',value:1},{name:'losses',value:1},{name:'pointsFor',value:22},{name:'pointsAgainst',value:7},{name:'points',value:25}]
 };

 globalThis.fetch=async ()=>{
  fetchCalls++;
  if(step==='fail') return {ok:false,status:503};
  if(step==='empty') return ok({name:'Empty League',children:[{standings:{entries:[]}}]});
  return ok({name:'Premier League',season:{year:2026,displayName:'2026-27'},children:[{standings:{entries:[sampleEntry]}}]});
 };

 try {
  // 1. API failure throws in strict mode
  await assert.rejects(getStandings('ita.1',{strict:true}));
  assert.equal(fetchCalls,1);

  // 2. Valid empty response returns [] without throwing
  step='empty';
  const emptyRes=await getStandings('ita.1',{strict:true,forceRefresh:true});
  assert.deepEqual(emptyRes,[]);
  assert.equal(fetchCalls,2);

  // 3. Successful retry with forceRefresh bypasses cached empty response and returns data
  step='ok';
  const cachedEmpty=await getStandings('ita.1',{strict:true,forceRefresh:false});
  assert.deepEqual(cachedEmpty,[]);
  assert.equal(fetchCalls,2);

  const retrySuccess=await getStandings('ita.1',{strict:true,forceRefresh:true});
  assert.equal(fetchCalls,3);
  assert.equal(retrySuccess.length,1);
  assert.equal(retrySuccess[0].entries[0].team,'Liverpool');
  assert.equal(retrySuccess[0].entries[0].points,25);
 } finally {
  globalThis.fetch=originalFetch;
  console.error=originalError;
 }
});
test('createStandingsController handles failure, retry, stale preservation, duplicate retry guard and unmount cleanup',async()=>{
 const originalError=console.error;
 console.error=()=>{};
 const states=[];
 let callCount=0;
 let pendingDeferred=null;
 let mode='fail';

 const sampleGroups=[{name:'Premier League',entries:[{teamId:'364',rank:1,team:'Liverpool',points:25}]}];
 const fetcher=async (leagueId,{strict,forceRefresh})=>{
  callCount++;
  assert.equal(strict,true);
  if(mode==='fail') throw new Error('Network error');
  if(mode==='empty') return [];
  if(mode==='deferred') {
   assert.equal(forceRefresh,true);
   return pendingDeferred.promise;
  }
  return sampleGroups;
 };

 try {
  const controller=createStandingsController({fetcher,onStateChange:s=>states.push(s)});

  // 1. Initial API failure -> error set, standings empty
  await controller.load('eng.1');
  assert.equal(callCount,1);
  assert.equal(controller.getState().loading,false);
  assert.match(controller.getState().error,/تعذر جلب بيانات البطولة/);
  assert.deepEqual(controller.getState().standings,[]);
  assert.equal(controller.getState().isStale,false);

  // 2. Retry succeeds with valid empty standings
  mode='empty';
  await controller.retry();
  assert.equal(callCount,2);
  assert.equal(controller.getState().error,null);
  assert.deepEqual(controller.getState().standings,[]);

  // 3. Load succeeds with non-empty standings
  mode='ok';
  await controller.load('eng.1',{isRetry:true});
  assert.equal(callCount,3);
  assert.equal(controller.getState().error,null);
  assert.equal(controller.getState().standings.length,1);

  // 4. Subsequent failure for same league preserves previous valid standings and marks isStale = true
  mode='fail';
  await controller.load('eng.1',{isRetry:true});
  assert.equal(callCount,4);
  assert.match(controller.getState().error,/تعذر جلب بيانات البطولة/);
  assert.equal(controller.getState().standings.length,1);
  assert.equal(controller.getState().isStale,true);

  // 5. Repeated retry clicks while loading do not trigger duplicate requests
  mode='deferred';
  pendingDeferred=defer();
  const retryPromise1=controller.retry();
  const retryPromise2=controller.retry();
  const retryPromise3=controller.retry();
  assert.equal(callCount,5);
  assert.equal(controller.getState().loading,true);

  pendingDeferred.resolve(sampleGroups);
  await Promise.all([retryPromise1,retryPromise2,retryPromise3]);
  assert.equal(callCount,5);
  assert.equal(controller.getState().error,null);
  assert.equal(controller.getState().isStale,false);

  // 6. Cleanup on unmount prevents state updates from in-flight requests
  pendingDeferred=defer();
  const unmountLoad=controller.load('eng.1',{isRetry:true});
  const statesBeforeUnmount=states.length;
  controller.dispose();
  pendingDeferred.resolve([]);
  await unmountLoad;
  assert.equal(states.length,statesBeforeUnmount);
 } finally {
  console.error=originalError;
 }
});
