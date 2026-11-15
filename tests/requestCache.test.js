import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestCache } from '../src/services/requestCache.js';
const ok = data => ({ok:true,json:async()=>data});
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
