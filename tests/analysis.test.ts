import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze } from '../lib/analyze.ts';
import { publishEvidence } from '../lib/publish-evidence.ts';
import { createEvidenceService } from '../lib/evidence-service.ts';
import { SOURCE_COLUMNS, tableFromColumns, type SourceTable } from '../lib/source-schema.ts';
import type { Evidence } from '../lib/evidence-types.ts';

const date = new Date('2026-10-19T12:00:00Z');
const snapshot = JSON.parse(await readFile(new URL('../data/evidence-snapshot.json', import.meta.url), 'utf8')) as Evidence;
function fixture(n = 12): SourceTable {
  return {
    headers: SOURCE_COLUMNS.map(c => c.header),
    rows: Array.from({ length: n }, (_, i) => [
      `synthetic-${i}`, 'Initial Observation (All newly recruited merchants)', '2026-10-15',
      ' A little better ', 'Yes', 'Much higher', 'Transfer', 'No records', 'No', 'Sometimes',
      `synthetic-merchant-${i}`, 'PROVISIONAL: identity unverified', String(i + 3),
    ]),
  };
}
const update = (table: SourceTable, row: number, key: string, value: string) => {
  table.rows[row][SOURCE_COLUMNS.findIndex(c => c.key === key)] = value;
};

test('review flags stay included as observations while explicit holds remain excluded', () => {
  const table = fixture(14);
  update(table, 0, 'identity', 'REVIEW: possible repeat submission');
  update(table, 1, 'identity', 'HOLD: unresolved identity');
  const result = analyze(table, date);
  assert.equal(result.quality.includedRows, 13);
  assert.equal(result.quality.identityReviewRows, 1);
  assert.equal(result.quality.identityExcludedRows, 1);
  assert.equal(result.quality.revisitRows, 0);
  assert.equal(result.collection[0].observations, 13);
});

test('a review flag on any identical retry is retained without counting another observation', () => {
  const table = fixture();
  table.rows.push([...table.rows[0]]);
  update(table, 12, 'identity', 'REVIEW: possible repeat submission');
  const result = analyze(table, date);
  assert.equal(result.quality.includedRows, 12);
  assert.equal(result.quality.identityReviewRows, 1);
  assert.equal(result.quality.duplicateRows, 1);
});

test('analysis reconciles every field to eligible observation count', () => {
  const result = analyze(fixture(), date);
  assert.equal(result.quality.includedRows, 12);
  assert.equal(result.quality.provisionalIdentityRows, 12);
  for (const d of Object.values(result.distributions)) {
    assert.equal(d.valid + d.missing + d.unknown + d.ambiguous + d.notApplicable, 12);
    assert.equal(Object.values(d.counts).reduce((a, b) => a + b, 0), d.valid);
  }
});

test('only reviewed column schema is accepted', () => {
  const table = fixture();
  table.headers[6] = 'Customer payment volumes';
  assert.throws(() => analyze(table, date), /schema changed/);
  assert.throws(() => tableFromColumns([]), /Incomplete/);
});

test('column reconstruction preserves empty rows and trailing sparse cells', () => {
  const table = fixture();
  const columns = SOURCE_COLUMNS.map((c, i) => ({ values: [[c.header], [], [table.rows[0][i]]] }));
  const reconstructed = tableFromColumns(columns);
  assert.equal(reconstructed.rows.length, 2);
  assert.equal(reconstructed.rows[0].every(v => v === ''), true);
  assert.deepEqual(reconstructed.rows[1], table.rows[0]);
});

test('identical retried submissions are counted once', () => {
  const table = fixture();
  table.rows.push([...table.rows[0]]);
  const result = analyze(table, date);
  assert.equal(result.quality.includedRows, 12);
  assert.equal(result.quality.duplicateRows, 1);
  assert.equal(result.quality.heldRows, 1);
});

test('conflicting copies of a submission are all held', () => {
  const table = fixture();
  table.rows.push([...table.rows[0]]);
  update(table, 12, 'payments', 'Cash');
  const result = analyze(table, date);
  assert.equal(result.quality.includedRows, 11);
  assert.equal(result.quality.duplicateRows, 2);
});

test('missing IDs, shifted rows, impossible and future dates are held', () => {
  const table = fixture(16);
  update(table, 0, 'submission', '');
  update(table, 1, 'date', '2026-02-30');
  update(table, 2, 'date', '2026-10-20');
  update(table, 3, 'type', 'Initial-ish');
  const result = analyze(table, date);
  assert.equal(result.quality.invalidRows, 4);
  assert.equal(result.quality.includedRows, 12);
});

test('pilot and repeat visits are separated from initial observations', () => {
  const table = fixture(14);
  update(table, 0, 'type', 'Pilot');
  update(table, 0, 'date', '2026-10-06');
  update(table, 1, 'type', 'Revisit');
  const result = analyze(table, date);
  assert.equal(result.quality.pilotRows, 1);
  assert.equal(result.quality.revisitRows, 1);
  assert.equal(result.quality.includedRows, 12);
});

test('restocking applicability, unknowns, contradictions and blanks are distinct', () => {
  const table = fixture(20);
  update(table, 0, 'restocks', 'No'); update(table, 0, 'restock', '');
  update(table, 1, 'restocks', 'No');
  update(table, 2, 'restock', "Don't know");
  update(table, 3, 'restock', '');
  const result = analyze(table, date).distributions.restock;
  assert.equal(result.valid, 16);
  assert.equal(result.notApplicable, 1);
  assert.equal(result.ambiguous, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.missing, 1);
});

test('contradictory and unrecognised recordkeeping never count as no records', () => {
  const table = fixture();
  update(table, 0, 'records', 'No records, Spreadsheet');
  update(table, 1, 'records', '__other__, Spreadsheet');
  const result = analyze(table, date).distributions.records;
  assert.equal(result.counts.none, 10);
  assert.equal(result.valid, 10);
  assert.equal(result.ambiguous, 1);
  assert.equal(result.unknown, 1);
});

test('signals below minimum denominator are withheld', () => {
  const table = fixture();
  for (let i = 0; i < 3; i++) update(table, i, 'payments', "Don't know");
  const result = publishEvidence(analyze(table, date));
  assert.equal(result.signals.some(s => s.id === 'payments'), false);
  assert.equal(result.signals.some(s => s.id === 'credit'), true);
  assert.throws(() => analyze(fixture(9), date), /Insufficient/);
});

test('public projection never includes identifiers or unrecognised free text', () => {
  const table = fixture();
  update(table, 0, 'records', 'private contact 08000000000');
  const serialized = JSON.stringify(publishEvidence(analyze(table, date)));
  for (const value of ['synthetic-', '08000000000', 'private contact', '"submission":', '"canonical":']) assert.equal(serialized.includes(value), false);
});

test('source snapshot uses reviewed denominators and the actual observation period', () => {
  assert.equal(snapshot.quality.includedRows, 115);
  assert.equal(snapshot.quality.sourceRows, 115);
  assert.equal(snapshot.quality.heldRows, 0);
  assert.equal(snapshot.quality.recoveredRows, 1);
  assert.equal(snapshot.quality.invalidRows, 0);
  assert.equal(snapshot.quality.provisionalIdentityRows, 115);
  assert.equal(snapshot.quality.identityReviewRows, 27);
  assert.equal(snapshot.period.end, '2026-10-16');
  const metric = (id: string) => snapshot.signals.find(s => s.id === id)!.metrics[0].value;
  assert.equal(metric('payments'), '70 / 114');
  assert.equal(metric('records'), '56 / 112');
  assert.equal(metric('business'), '89 / 114');
  assert.equal(metric('restock'), '85 / 104');
  assert.equal(metric('credit'), '30 / 115');
  assert.equal(metric('remote'), '56 / 115');
  assert.equal(snapshot.collection.reduce((sum, day) => sum + day.observations, 0), 115);
});

test('unconfigured integration is explicitly a snapshot and never reads a source', async () => {
  const service = createEvidenceService({ snapshot, configured: () => false, load: async () => { throw new Error('must not run'); } });
  const result = await service();
  assert.equal(result.connection.mode, 'snapshot');
  assert.equal(result.connection.checkedAt, null);
});

test('concurrent readers share one source fetch and refresh after the interval', async () => {
  let calls = 0;
  let clock = date.getTime();
  const service = createEvidenceService({ snapshot, configured: () => true, now: () => clock, load: async () => { calls++; return fixture(); } });
  const results = await Promise.all([service(), service(), service()]);
  assert.equal(calls, 1);
  assert.equal(results[0].connection.mode, 'live');
  assert.equal(results[0].evidence.quality.includedRows, 12);
  await service(); assert.equal(calls, 1);
  clock += 61_000;
  await service(); assert.equal(calls, 2);
});

test('source outage preserves last validated results and never exposes API errors', async () => {
  let clock = date.getTime();
  let fail = false;
  const service = createEvidenceService({ snapshot, configured: () => true, now: () => clock, load: async () => {
    if (fail) throw new Error('private_token_and_rows');
    return fixture();
  } });
  const good = await service();
  fail = true; clock += 61_000;
  const stale = await service();
  assert.equal(stale.connection.mode, 'stale');
  assert.deepEqual(stale.evidence, good.evidence);
  assert.equal(JSON.stringify(stale).includes('private_token_and_rows'), false);
  fail = false; clock += 61_000;
  assert.equal((await service()).connection.mode, 'live');
});

test('schema failure on cold start retains the committed snapshot', async () => {
  const table = fixture(); table.headers[0] = 'Changed';
  const service = createEvidenceService({ snapshot, configured: () => true, now: () => date.getTime(), load: async () => table });
  const result = await service();
  assert.equal(result.connection.mode, 'stale');
  assert.deepEqual(result.evidence, snapshot);
});
