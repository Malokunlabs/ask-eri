import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_COLUMNS, type SourceTable } from '../lib/source-schema.ts';
import { recoverShiftedRows, shiftedCandidates, SHIFTED_SOURCE_COLUMNS, RECOVERED_IDENTITY } from '../lib/source-recovery.ts';
import { analyze } from '../lib/analyze.ts';
import { publishEvidence } from '../lib/publish-evidence.ts';
const id='00000000-0000-4000-8000-000000000001';
const answers=[id,'Initial Observation (All newly recruited merchants)','2026-10-16','A little worse','Yes',' A little higher','Transfer','Memory Notebook/paper       ','No','No'];
function fixture():SourceTable {return {headers:SOURCE_COLUMNS.map(c=>c.header),rows:[...Array.from({length:12},(_,i)=>[`synthetic-${i}`,'Initial Observation (All newly recruited merchants)','2026-10-15','A little better','Yes','Much higher','Transfer','No records','No','Sometimes',`synthetic-merchant-${i}`,'REVIEW: possible repeat submission',String(i+2)]),[...Array(10).fill(''),id,'misplaced metadata','misplaced metadata']]};}
test('shifted recovery reads only the ten reviewed observation columns',()=>{
 assert.deepEqual(SHIFTED_SOURCE_COLUMNS,['BJ','BP','BQ','CC','CE','CH','CL','CP','CT','CW']);assert.deepEqual(shiftedCandidates(fixture()),[12]);
});
test('all review observations and recovered answers contribute without verifying merchant identity',()=>{
 const original=fixture();const restored=recoverShiftedRows(original,[{rowIndex:12,values:answers}]);
 assert.equal(original.rows[12][0],'');assert.equal(restored.rows[12][10],'');assert.equal(restored.rows[12][11],RECOVERED_IDENTITY);
 const analysis=analyze(restored,new Date('2026-10-20T12:00Z'));assert.equal(analysis.quality.includedRows,13);assert.equal(analysis.quality.identityReviewRows,12);assert.equal(analysis.quality.recoveredRows,1);assert.equal(analysis.quality.provisionalIdentityRows,13);assert.equal(analysis.quality.heldRows,0);
 assert.equal(analysis.distributions.business.counts.littleWorse,1);assert.equal(analysis.distributions.restock.counts.littleHigher,1);assert.equal(analysis.distributions.payments.valid,13);assert.equal(analysis.distributions.records.counts.other,1);assert.equal(analysis.distributions.remote.counts.no,1);assert.equal(analysis.period.end,'2026-10-16');assert.equal(analysis.longitudinal.series.length,0);
 const publicData=JSON.stringify(publishEvidence(analysis));assert.ok(!publicData.includes(id));assert.ok(!publicData.includes('misplaced metadata'));assert.match(publicData,/12 included observations have unresolved identity-review flags/);
});
test('recovery refuses missing reads, wrong IDs, arbitrary overwrites and changed source schema',()=>{
 const source=fixture();assert.throws(()=>recoverShiftedRows(source,[]),/Incomplete/);assert.throws(()=>recoverShiftedRows(source,[{rowIndex:12,values:['wrong',...answers.slice(1)]}]),/markers/);
 assert.throws(()=>recoverShiftedRows(source,[{rowIndex:0,values:answers}]),/layout/);assert.throws(()=>recoverShiftedRows(source,[{rowIndex:12,values:answers},{rowIndex:12,values:answers}]),/Incomplete/);
 source.headers[0]='Changed';assert.throws(()=>shiftedCandidates(source),/schema/);
});
test('recovered rows still obey observation dates and per-answer exclusions',()=>{
 const source=fixture();const changed=[...answers];changed[2]='2026-11-01';let analysis=analyze(recoverShiftedRows(source,[{rowIndex:12,values:changed}]),new Date('2026-10-20T12:00Z'));assert.equal(analysis.quality.includedRows,12);assert.equal(analysis.quality.invalidRows,1);
 changed[2]='2026-10-16';changed[6]='Unknown option';changed[7]='No records, Spreadsheet';analysis=analyze(recoverShiftedRows(source,[{rowIndex:12,values:changed}]),new Date('2026-10-20T12:00Z'));assert.equal(analysis.quality.includedRows,13);assert.equal(analysis.distributions.payments.unknown,1);assert.equal(analysis.distributions.records.ambiguous,1);
});
test('explicit exclusions and conflicting submissions remain held after including review flags',()=>{
 const source=fixture();source.rows.pop();source.rows[0][11]='REJECT: source invalid';source.rows.push([...source.rows[1]]);source.rows.at(-1)![6]='Cash';const analysis=analyze(source,new Date('2026-10-20T12:00Z'));assert.equal(analysis.quality.includedRows,10);assert.equal(analysis.quality.identityExcludedRows,1);assert.equal(analysis.quality.duplicateRows,2);
});
