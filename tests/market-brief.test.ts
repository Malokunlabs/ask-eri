import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMarketBrief,buildEvidenceHooks,matchingEdition,editionById,briefCitation,editions} from '../lib/market-brief.ts';
import {buildInvestigation} from '../lib/decision-model.ts';
import {requestContext} from '../lib/request-context.ts';
import {blankInterviews,parseInterviews,canRetainInterviews} from '../lib/interview-kit.ts';
import {allowLocalOperations} from '../lib/operations.ts';
import type {Evidence,EvidenceResponse} from '../lib/evidence-types.ts';
const evidence=JSON.parse(await readFile(new URL('../data/evidence-snapshot.json',import.meta.url),'utf8')) as Evidence;
const data=(value=evidence,mode:EvidenceResponse['connection']['mode']='snapshot'):EvidenceResponse=>({evidence:value,connection:{mode,checkedAt:null,refreshSeconds:60,message:'Validated snapshot.'}});
test('market brief follows the active evidence and withholds missing or unreconciled signals',()=>{
 const initial=buildMarketBrief(data())!;assert.deepEqual([initial.restock!.count,initial.restock!.denominator],[85,104]);assert.equal(initial.remote!.count,56);
 const changed=structuredClone(evidence);changed.signals.find(s=>s.id==='restock')!.observed!.count=12;const revised=buildMarketBrief(data(changed))!;assert.equal(revised.restock!.count,12);assert.equal(revised.edition,null);assert.equal(initial.restock!.count,85);
 changed.signals=changed.signals.filter(s=>s.id!=='restock');const held=buildMarketBrief(data(changed))!;assert.equal(held.restock,null);assert.ok(!held.interpretation!.includes('purchasing cash'));
 changed.signals=[];assert.equal(buildMarketBrief(data(changed))!.interpretation,null);
 const malformed=structuredClone(evidence);malformed.signals.find(s=>s.id==='restock')!.observed!.denominator=999;assert.equal(buildMarketBrief(data(malformed))!.restock,null);
});
test('archive references require equivalent aggregate content and preserve material citation limits',()=>{
 assert.equal(matchingEdition(evidence)?.id,'yaba-2026-10-20');assert.equal(matchingEdition({...evidence,analyzedAt:'2026-10-22T12:00:00Z'})?.id,'yaba-2026-10-20');assert.equal(editionById('../private'),undefined);assert.throws(()=>{editionById('yaba-2026-10-20')!.evidence.quality.includedRows=0;});
 const citation=briefCitation(buildMarketBrief(data())!,'http://127.0.0.1:3000');for(const text of ['115 initial observations','27 identity-review flags','7 October 2026','16 October 2026','analysis-v3','not verified unique businesses','/briefs/yaba-2026-10-20'])assert.ok(citation.includes(text),text);
 const stale=buildMarketBrief(data(evidence,'stale'))!;assert.equal(stale.connection.mode,'stale');assert.equal(stale.quality.identityReviewRows,27);
 for(const edition of editions){const serialized=JSON.stringify(edition.evidence);assert.ok(!serialized.includes('canonical'));assert.ok(!serialized.includes('cancelToken'));}
});
test('market brief refuses to mix locations or imply another city has evidence',()=>{
 const changed=structuredClone(evidence);changed.coverage.push({...changed.coverage[0],id:'other'});assert.equal(buildMarketBrief(data(changed)),null);changed.coverage=[{...changed.coverage[0],id:'other'}];assert.equal(buildMarketBrief(data(changed)),null);
});
test('question-led investigations capture evidence without invented calculator assumptions',()=>{
 const brief=buildInvestigation('distributors','Which replenishment constraints should our pilot investigate?',evidence);assert.deepEqual(brief.assumptions,[]);assert.deepEqual(brief.results,[]);assert.equal(brief.cohortSize,115);assert.equal(brief.evidenceVersion,'analysis-v3');assert.match(brief.limitations,/not a commissioned study/);assert.throws(()=>buildInvestigation('distributors','short',evidence));
});
test('decision context validates dates and roles while discarding unrequested fields',()=>{
 assert.equal(requestContext(undefined).geography,'');assert.throws(()=>requestContext({buyerRole:'Unknown role'}));assert.throws(()=>requestContext({desiredDeadline:'2026-02-30'}));const context=requestContext({buyerRole:'Distributor / procurement',geography:'Requested location',productCategory:'Example',desiredDeadline:'2026-11-05',secret:'ignore'});assert.equal(context.desiredDeadline,'2026-11-05');assert.throws(()=>requestContext({sourceEdition:'unpublished'}));assert.equal(requestContext({sourceEdition:'yaba-2026-10-20'}).sourceEdition,'yaba-2026-10-20');assert.ok(!JSON.stringify(context).includes('secret'));
});
test('interview notes are three private slots with strict format and explicit retention permission',()=>{
 const blank=blankInterviews();assert.equal(blank.length,3);assert.ok(blank.every(s=>s.stage==='planned'));assert.deepEqual(parseInterviews({version:1,sessions:blank}),blank);blank[0].answers.decision='Synthetic interview only';assert.equal(canRetainInterviews(blank),false);blank[0].noteConsent='notes-agreed';assert.equal(canRetainInterviews(blank),true);blank[0].noteConsent='declined';assert.equal(canRetainInterviews(blank),false);assert.throws(()=>parseInterviews({version:2,sessions:blank}));assert.throws(()=>parseInterviews({version:1,sessions:[]}));
});
test('local operator shortcut is unavailable in production, live mode or non-loopback hosts',()=>{
 allowLocalOperations('development','local','127.0.0.1:3000','http://127.0.0.1:3000');assert.throws(()=>allowLocalOperations('production','local','127.0.0.1:3000','http://127.0.0.1:3000'));assert.throws(()=>allowLocalOperations('development','live','127.0.0.1:3000','http://127.0.0.1:3000'));assert.throws(()=>allowLocalOperations('development','local','foreign.test','http://127.0.0.1:3000'));assert.throws(()=>allowLocalOperations('development','local','site.test','https://site.test'));
});


test('buyer hooks pair three reconciled facts with distinct questions and omit withheld facts',()=>{
 const hooks=buildEvidenceHooks(data());assert.deepEqual(hooks.map(h=>[h.id,h.fact.count,h.fact.denominator,h.audience]),[['restock',85,104,'distributors'],['records',56,112,'finance'],['remote',56,115,'research']]);
 const changed=structuredClone(evidence);changed.signals=changed.signals.filter(s=>s.id!=='records');assert.deepEqual(buildEvidenceHooks(data(changed)).map(h=>h.id),['restock','remote']);
 changed.signals.find(s=>s.id==='remote')!.observed!.count=10;assert.equal(buildEvidenceHooks(data(changed))[1].fact.count,10);
 changed.signals.find(s=>s.id==='remote')!.denominator=999;assert.deepEqual(buildEvidenceHooks(data(changed)).map(h=>h.id),['restock']);
});
