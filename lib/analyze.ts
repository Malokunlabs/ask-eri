import { SOURCE_COLUMNS, MIN_RESPONSES, type SourceTable } from './source-schema.ts';
import type { Analysis, Distribution } from './evidence-types.ts';
import { analyzeLongitudinal } from './longitudinal.ts';
import { RECOVERED_IDENTITY } from './source-recovery.ts';

const clean = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const empty = (): Distribution => ({ counts: {}, valid: 0, missing: 0, unknown: 0, ambiguous: 0, notApplicable: 0 });
type Row = Record<(typeof SOURCE_COLUMNS)[number]['key'], string>;
const enums = {
  payments: { transfer: 'transfer', cash: 'cash', 'pos/card': 'pos' },
  business: { 'much better': 'muchBetter', 'a little better': 'littleBetter', 'about the same': 'same', 'a little worse': 'littleWorse', 'much worse': 'muchWorse' },
  restock: { 'much higher': 'muchHigher', 'a little higher': 'littleHigher', 'about the same': 'same', lower: 'lower' },
  credit: { yes: 'yes', no: 'no' },
  remote: { 'yes regularly': 'regularly', sometimes: 'sometimes', no: 'no' },
};
const recordOptions = new Set(['memory notebook/paper', 'calculator/manual totals', 'pos/payment app', 'accounting/business app', 'spreadsheet', 'whatsapp', 'someone else handles it']);

function count(distribution: Distribution, value: string, options: Record<string, string>) {
  const normalized = clean(value);
  if (!normalized) { distribution.missing++; return; }
  const key = Object.hasOwn(options, normalized) ? options[normalized] : undefined;
  if (!key) { distribution.unknown++; return; }
  distribution.valid++;
  distribution.counts[key] = (distribution.counts[key] ?? 0) + 1;
}

function validDate(value: string, today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value &&
    value >= '2026-10-07' && value <= today;
}

// Pure staged analysis. The returned object contains no submission/merchant identifiers.
export function analyze(table: SourceTable, now = new Date(), panelApprovalReference?: string): Analysis {
  if (table.headers.length !== SOURCE_COLUMNS.length || table.headers.some((h, i) => clean(h) !== clean(SOURCE_COLUMNS[i].header))) {
    throw new Error('Source schema changed; publication held');
  }
  const quality: Analysis['quality'] = {
    sourceRows: 0, includedRows: 0, heldRows: 0, duplicateRows: 0, invalidRows: 0,
    pilotRows: 0, revisitRows: 0, provisionalIdentityRows: 0, identityReviewRows: 0, identityExcludedRows: 0, recoveredRows: 0,
  };
  const distributions: Analysis['distributions'] = {
    payments: empty(), records: empty(), business: empty(), restock: empty(), credit: empty(), remote: empty(),
  };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const rows: Row[] = table.rows.filter(row => row.some(value => value.trim())).map(row => {
    quality.sourceRows++;
    return Object.fromEntries(SOURCE_COLUMNS.map(({ key }, i) => [key, String(row[i] ?? '').trim()])) as Row;
  });
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.submission) { quality.invalidRows++; continue; }
    const group = groups.get(row.submission) ?? [];
    group.push(row);
    groups.set(row.submission, group);
  }
  const dates: string[] = [];
  for (const group of groups.values()) {
    // Conflicting copies are all held; identical retries contribute just one response.
    const signature = (row: Row) => JSON.stringify(SOURCE_COLUMNS.filter(c => !['canonical', 'identity', 'source'].includes(c.key)).map(c => clean(row[c.key])));
    const signatures = new Set(group.map(signature));
    if (signatures.size > 1) { quality.duplicateRows += group.length; continue; }
    quality.duplicateRows += group.length - 1;
    const row = group[0];
    if (group.some(copy => /^(reject|exclude|hold)\b/.test(clean(copy.identity)))) {
      quality.identityExcludedRows++; continue;
    }
    const type = clean(row.type);
    if (/\bpilot\b/.test(type)) { quality.pilotRows++; continue; }
    if (/\b(revisit|follow.up|return visit)\b/.test(type)) { quality.revisitRows++; continue; }
    if (type !== 'initial observation (all newly recruited merchants)' || !validDate(row.date, today)) {
      quality.invalidRows++; continue;
    }
    quality.includedRows++;
    if (group.some(copy => /^review\b/.test(clean(copy.identity)))) quality.identityReviewRows++;
    if (row.identity === RECOVERED_IDENTITY) quality.recoveredRows++;
    dates.push(row.date);
    if (clean(row.identity) !== 'verified' || group.some(copy => /^review\b/.test(clean(copy.identity)))) quality.provisionalIdentityRows++;
    for (const field of ['payments', 'business', 'credit', 'remote'] as const) count(distributions[field], row[field], enums[field]);

    const restock = distributions.restock;
    const applicable = clean(row.restocks);
    if (applicable === 'no' && !clean(row.restock)) restock.notApplicable++;
    else if (applicable === 'no') restock.ambiguous++;
    else if (applicable !== 'yes') restock.unknown++;
    else count(restock, row.restock, enums.restock);

    const records = distributions.records;
    const tokens = row.records.split(',').map(clean).filter(Boolean);
    if (!tokens.length) records.missing++;
    else if (tokens.includes('no records') && tokens.length > 1) records.ambiguous++;
    else if (tokens.some(t => t !== 'no records' && !recordOptions.has(t))) records.unknown++;
    else {
      const key = tokens[0] === 'no records' ? 'none' : 'other';
      records.valid++;
      records.counts[key] = (records.counts[key] ?? 0) + 1;
    }
  }
  quality.heldRows = quality.sourceRows - quality.includedRows;
  if (quality.includedRows < MIN_RESPONSES) throw new Error('Insufficient eligible observations; publication held');
  for (const d of Object.values(distributions)) {
    if (d.valid + d.missing + d.unknown + d.ambiguous + d.notApplicable !== quality.includedRows || Object.values(d.counts).reduce((a, b) => a + b, 0) !== d.valid) {
      throw new Error('Analysis reconciliation failed; publication held');
    }
  }
  dates.sort();
  const byDate = new Map<string, number>();
  for (const date of dates) byDate.set(date, (byDate.get(date) ?? 0) + 1);
  return { analyzedAt: now.toISOString(), period: { start: dates[0], end: dates.at(-1)! }, quality, distributions, collection: Array.from(byDate, ([date, observations]) => ({ date, observations })), longitudinal: analyzeLongitudinal(table, today, panelApprovalReference) };
}
