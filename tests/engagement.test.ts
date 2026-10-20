import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEngagementService, type EmailMessage } from '../lib/engagement.ts';
import { FileEngagementStore, RedisEngagementStore } from '../lib/engagement-store.ts';
import { buildDecision, evidenceDigestContent } from '../lib/decision-model.ts';
import { analyzeLongitudinal } from '../lib/longitudinal.ts';
import { analyze } from '../lib/analyze.ts';
import { SOURCE_COLUMNS } from '../lib/source-schema.ts';
import type { Evidence } from '../lib/evidence-types.ts';
const evidence = JSON.parse(await readFile(new URL('../data/evidence-snapshot.json',import.meta.url),'utf8')) as Evidence;
const scenario = { audience:'distributors',inputs:{budget:100000,unitCost:1000,increase:15,response:'quantity'} };
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
 const directory=await mkdtemp(join(tmpdir(),'eri-test-')); t.after(()=>rm(directory,{recursive:true,force:true}));
 let time=Date.parse('2026-10-19T12:00Z'); let source=structuredClone(evidence); const sent:EmailMessage[]=[]; let fail=false; let ready=true;
 const store=new FileEngagementStore(join(directory,'store.json'),()=>time);
 const service=createEngagementService({store,origin:'http://127.0.0.1:3000',mode:'local',clock:()=>time,evidence:async()=>source,publicationReady:async()=>ready,send:async m=>{if(fail)throw Error('provider secret');sent.push(m);return{id:m.id};}});
 const submit=async(kind='subscription',topics=['signals'],email='synthetic@example.invalid')=>{
  const result=await service.submit({kind,email,topics,consent:true,organisation:'Synthetic test',...scenario},'client');
  const url=new URL(result.confirmationUrl!);return {id:url.searchParams.get('id')!,token:url.searchParams.get('token')!,result};
 };
 return {store,service,sent,submit,advance:(ms:number)=>{time+=ms;},setSource:(e:Evidence)=>{source=e;},setFail:(v:boolean)=>{fail=v;},setReady:(v:boolean)=>{ready=v;}};
}
test('decision arithmetic is transparent and does not infer lending suitability',()=>{
 const d=buildDecision('distributors',scenario.inputs,evidence);assert.equal(d.results[1].value,'86');assert.equal(d.evidenceVersion,evidence.version);
 const f=buildDecision('finance',{participants:20,support:50000,visits:2},evidence);assert.equal(f.results[1].value,'40');assert.match(f.limitations,/not an estimate of credit demand/);
 const r=buildDecision('research',{participants:20,rounds:3,visitCost:5000},evidence);assert.equal(r.results[0].value,'60');assert.match(r.limitations,/not an ERI price quote/);
 assert.throws(()=>buildDecision('finance',{participants:1.5,support:2,visits:2},evidence));assert.throws(()=>buildDecision('finance',{participants:20,support:Infinity,visits:2},evidence));
 assert.equal(evidenceDigestContent(evidence),evidenceDigestContent({...evidence,analyzedAt:'2027-01-01T00:00Z'}));
});
test('confirmation is required, invalid tokens fail, topics remain separate',async t=>{
 const f=await fixture(t);const s=await f.submit();assert.equal(f.sent.length,1);
 await f.service.publishUpdate('site','Site update','A genuine product update for a selected topic.');await f.service.work();assert.equal(f.sent.length,1);
 await assert.rejects(f.service.action('confirm',s.id,'wrong'));
 await f.service.action('confirm',s.id,s.token);await f.service.work();assert.equal(f.sent.length,1);
 f.advance(1000);await f.service.publishUpdate('signals','Evidence revision','Quality review changed the eligible cohort.');await f.service.work();assert.equal(f.sent.length,2);
 await f.service.work();assert.equal(f.sent.length,2);
 const ops=JSON.stringify(await f.service.operations());assert.ok(!ops.includes(s.token));assert.ok(!ops.includes('cancelHash'));
});
test('field briefs require confirmation and an approved quote, and send once',async t=>{
 const f=await fixture(t);const s=await f.submit('request');const report='Synthetic test report. No fieldwork was conducted. This is a local delivery test only.';
 await assert.rejects(f.service.complete(s.id,report));await f.service.action('confirm',s.id,s.token);
 await assert.rejects(f.service.complete(s.id,report),/approved quote/);
 await assert.rejects(f.service.approveScope(s.id,{customerApproved:false}));
 await f.service.approveScope(s.id,{customerApproved:true,description:'Synthetic local test only; no actual fieldwork.',quote:'Test only; zero charge agreed',approvalReference:'Synthetic approval record'});
 await f.service.complete(s.id,report);assert.equal(f.sent.length,3);await f.service.complete(s.id,report);assert.equal(f.sent.length,3);
});
test('unsubscribe deletes contact and queued content and blocks retries',async t=>{
 const f=await fixture(t);const s=await f.submit();await f.service.action('confirm',s.id,s.token);
 const record=(await f.store.get<{cancelToken:string}>(`eri:v1:record:${s.id}`))!;
 f.setFail(true);f.advance(1000);await f.service.publishUpdate('signals','Evidence update','Synthetic QA revision for testing.');await f.service.work();
 await f.service.action('unsubscribe',s.id,record.cancelToken);assert.equal((await f.service.operations()).records.length,0);
 f.advance(300000);f.setFail(false);await f.service.work();assert.equal(f.sent.length,1);
 assert.equal((await f.store.scan('eri:v1:job:')).keys.length,0);
});
test('resubscribing replaces topics only after the new confirmation',async t=>{
 const f=await fixture(t);const first=await f.submit();await f.service.action('confirm',first.id,first.token);
 const second=await f.submit('subscription',['site']);assert.equal((await f.service.operations()).records.length,2);
 await f.service.action('confirm',second.id,second.token);const records=(await f.service.operations()).records;assert.equal(records.length,1);assert.deepEqual(records[0].topics,['site']);
});
test('retry uses same job id, respects delay, and stops after provider idempotency window',async t=>{
 const f=await fixture(t);f.setFail(true);const s=await f.submit();assert.equal(f.sent.length,0);await f.service.work();assert.equal(f.sent.length,0);
 f.advance(121000);f.setFail(false);await f.service.work();assert.equal(f.sent.length,1);await f.service.work();assert.equal(f.sent.length,1);
 const second=await f.submit('subscription',['site'],'second@example.invalid');f.advance(49*3600000);await assert.rejects(f.service.action('confirm',second.id,second.token));
 await assert.rejects(f.service.publishUpdate('longitudinal','No panel yet','Cannot publish fabricated longitudinal alerts.'));
 assert.ok(s.result.message.includes('No email'));
});
test('input validation rejects missing consent, unsupported topics, and invalid scenario',async t=>{
 const f=await fixture(t);
 await assert.rejects(f.service.submit({kind:'subscription',email:'test@example.invalid',consent:false,topics:['signals']},'client'));
 await assert.rejects(f.service.submit({kind:'subscription',email:'test@example.invalid',consent:true,topics:['unknown']},'client'));
 await assert.rejects(f.service.submit({kind:'request',email:'test@example.invalid',consent:true,organisation:'Test',audience:'finance',inputs:{participants:-1}},'client'));
});
test('file store has owner-safe locks, TTL, rate limits and complete pagination',async t=>{
 const f=await fixture(t);assert.equal(await f.store.set('lock','a',{nx:true,ttl:2}),true);assert.equal(await f.store.set('lock','b',{nx:true}),false);await f.store.release('lock','b');assert.equal(await f.store.get('lock'),'a');
 f.advance(2100);assert.equal(await f.store.get('lock'),null);assert.equal(await f.store.limit('limit',1,10),true);assert.equal(await f.store.limit('limit',1,10),false);
 await Promise.all(Array.from({length:9},(_,i)=>f.store.set(`page:${i}`,i)));const a=await f.store.scan('page:','0',5);const b=await f.store.scan('page:',a.cursor,5);assert.equal(a.keys.length+b.keys.length,9);assert.equal(b.cursor,'0');
});
test('Redis REST adapter sends structured commands, NX and TTL without leaking provider errors',async()=>{
 const commands:unknown[]=[];
 const request=(async(_url,init)=>{const args=JSON.parse(String(init?.body));commands.push(args);return Response.json({result:args[0]==='SET'?'OK':args[0]==='GET'?'"value"':['0',['eri:key']]});}) as typeof fetch;
 const store=new RedisEngagementStore('https://redis.example.invalid','private',request);await store.set('key',{a:1},{ttl:12,nx:true});assert.deepEqual(commands[0],['SET','key','{"a":1}','EX',12,'NX']);assert.equal(await store.get('key'),'value');assert.deepEqual(await store.scan('eri:'),{cursor:'0',keys:['eri:key']});assert.throws(()=>new RedisEngagementStore('http://local','key'));
});
function panel(n=10){return {headers:SOURCE_COLUMNS.map(c=>c.header),rows:Array.from({length:n},(_,i)=>[0,1].map(round=>[`submission-${i}-${round}`,round?'Revisit':'Initial Observation (All newly recruited merchants)',round?'2026-10-18':'2026-10-08','A little better','Yes',round?'About the same':'Much higher','Transfer','No records','No','Sometimes',`ERI-LAG-M-${String(i+1).padStart(6,'0')}`,'VERIFIED',String(i*2+round)])).flat()};}
test('matched data require editorial approval and same verified complete pairs',()=>{
 const p=panel();assert.equal(analyzeLongitudinal(p,'2026-10-19').status,'awaiting-review');assert.equal(analyzeLongitudinal(p,'2026-10-19').series.length,0);
 const approved=analyzeLongitudinal(p,'2026-10-19','review-record');assert.equal(approved.verifiedMatchedBusinesses,10);const s=approved.series.find(s=>s.signalId==='restock')!;assert.deepEqual(s.points.map(p=>[p.count,p.denominator]),[[10,10],[0,10]]);
 p.rows[1][11]='PROVISIONAL';assert.equal(analyzeLongitudinal(p,'2026-10-19','review').series.length,0);
});
test('matched outcomes exclude unknown responses, conflicting copies and future dates',()=>{
 const p=panel(11);p.rows[1][5]='unknown';let a=analyzeLongitudinal(p,'2026-10-19','review');assert.equal(a.series.find(s=>s.signalId==='restock')!.participants,10);
 p.rows.push([...p.rows[2]]);p.rows.at(-1)![6]='Cash';p.rows[5][2]='2026-11-01';a=analyzeLongitudinal(p,'2026-10-19','review');assert.equal(a.verifiedMatchedBusinesses,9);assert.equal(a.series.length,0);
});
test('prototype-named answers are unknown rather than classified outcomes',()=>{
 const p=panel(12);p.rows=p.rows.filter((_,i)=>i%2===0);p.rows[0][6]='constructor';const a=analyze(p,new Date('2026-10-19T12:00Z'));assert.equal(a.distributions.payments.unknown,1);assert.equal(a.distributions.payments.valid,11);
});
test('automatic evidence notifications ignore timestamp-only refreshes and explain QA changes',async t=>{
 const f=await fixture(t);const s=await f.submit();await f.service.action('confirm',s.id,s.token);await f.service.work();
 f.setSource({...evidence,analyzedAt:'2026-10-19T13:00:00Z'});f.advance(1000);await f.service.work();assert.equal(f.sent.length,1);
 const revised=structuredClone(evidence);revised.quality.includedRows--;f.setSource(revised);f.advance(1000);await f.service.work();assert.equal(f.sent.length,2);assert.match(f.sent[1].text,/QA changes, not economic change/);
 await f.service.work();assert.equal(f.sent.length,2);
});
test('a queued report cannot be replaced, and failed jobs stop outside the 24-hour window',async t=>{
 const f=await fixture(t);const s=await f.submit('request');await f.service.action('confirm',s.id,s.token);await f.service.approveScope(s.id,{customerApproved:true,description:'Synthetic local test; no real work.',quote:'Synthetic quote zero charge',approvalReference:'Test approval reference'});
 f.setFail(true);const report='Synthetic report with sufficient detail for a local workflow test. No actual work completed.';await f.service.complete(s.id,report);await assert.rejects(f.service.complete(s.id,report+' replacement'),/already queued/);
 f.advance(25*3600000);f.setFail(false);await f.service.work();assert.equal(f.sent.length,2);
});

test('source failure suppresses automatic evidence revisions while queued delivery remains usable',async t=>{
 const f=await fixture(t);const s=await f.submit();await f.service.action('confirm',s.id,s.token);await f.service.work();
 const revised=structuredClone(evidence);revised.quality.includedRows--;f.setSource(revised);f.setReady(false);f.advance(1000);await f.service.work();assert.equal(f.sent.length,1);
 f.setReady(true);await f.service.work();assert.equal(f.sent.length,2);
});
test('overlapping confirmations for one email cannot restore a replaced subscription',async t=>{
 const f=await fixture(t);const first=await f.submit();const second=await f.submit('subscription',['site']);
 const release=f.store.release.bind(f.store);let interleaved=false;
 f.store.release=async(key,owner)=>{
  await release(key,owner);
  if(key.startsWith('eri:v1:subscriber:') && !interleaved){interleaved=true;await f.service.action('confirm',second.id,second.token);}
 };
 await f.service.action('confirm',first.id,first.token);
 const records=(await f.service.operations()).records;assert.equal(records.length,1);assert.equal(records[0].id,second.id);assert.deepEqual(records[0].topics,['site']);
});
test('question-led requests retain scoped context and require confirmation before work',async t=>{
 const f=await fixture(t);const result=await f.service.submit({kind:'request',requestMode:'investigation',audience:'distributors',email:'question-test@example.invalid',organisation:'Synthetic team',question:'Which replenishment constraints should we investigate before a pilot?',requestContext:{buyerRole:'Distributor / procurement',geography:'Example requested place',productCategory:'Example category',desiredDeadline:'2026-11-05'},consent:true},'client');
 const url=new URL(result.confirmationUrl!);const records=(await f.service.operations()).records;assert.equal(records.length,1);assert.deepEqual(records[0].brief!.assumptions,[]);assert.equal(records[0].brief!.evidenceVersion,evidence.version);assert.equal(records[0].requestContext!.desiredDeadline,'2026-11-05');assert.equal(records[0].status,'pending');await f.service.action('confirm',url.searchParams.get('id')!,url.searchParams.get('token')!);assert.match(f.sent.at(-1)!.text,/Example requested place/);assert.match(f.sent.at(-1)!.text,/not a delivery promise/);
 await assert.rejects(f.service.submit({kind:'request',requestMode:'investigation',audience:'research',email:'bad-date@example.invalid',organisation:'Synthetic',question:'A sufficiently long research question',requestContext:{desiredDeadline:'2026-02-30'},consent:true},'client'));
});
