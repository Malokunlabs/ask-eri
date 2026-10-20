import { readFile, writeFile } from 'node:fs/promises';
import { analyze } from '../lib/analyze.ts';
import { publishEvidence } from '../lib/publish-evidence.ts';
import type { SourceTable } from '../lib/source-schema.ts';
import { recoverShiftedRows } from '../lib/source-recovery.ts';

// Offline review of a local allowlisted source projection. Never prints records.
// Output is an aggregate snapshot; raw inputs belong in ignored .local-data/.
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('Usage: analyze-source.ts <private-source.json> <aggregate-output.json> [private-recovery.json]');
const source = JSON.parse(await readFile(input, 'utf8')) as SourceTable;
const recovery = process.argv[4] ? JSON.parse(await readFile(process.argv[4], 'utf8')) : [];
const table = recoverShiftedRows(source, recovery);
const analysis = analyze(table);
const evidence = publishEvidence(analysis);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ quality: evidence.quality, fields: evidence.fields, period: evidence.period }, null, 2));
