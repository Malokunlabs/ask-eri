import { MIN_RESPONSES, SOURCE_COLUMNS, type SourceTable } from './source-schema.ts';
import type { LongitudinalEvidence } from './evidence-types.ts';

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
type PanelRow = Record<(typeof SOURCE_COLUMNS)[number]['key'], string>;
function outcome(row: PanelRow, signal: string): boolean | null {
  const value = clean(row[signal as keyof PanelRow] ?? '');
  const choices: Record<string, Record<string, boolean>> = {
    payments: { transfer: true, cash: false, 'pos/card': false },
    credit: { yes: true, no: false }, remote: { 'yes regularly': true, sometimes: true, no: false },
    business: { 'much better': true, 'a little better': true, 'about the same': false, 'a little worse': false, 'much worse': false },
    restock: { 'much higher': true, 'a little higher': true, 'about the same': false, lower: false },
  };
  if (signal === 'restock' && clean(row.restocks) !== 'yes') return null;
  if (signal === 'records') {
    const tokens = value.split(',').map(clean).filter(Boolean);
    if (!tokens.length || (tokens.includes('no records') && tokens.length > 1)) return null;
    const allowed = new Set(['no records', 'memory notebook/paper', 'calculator/manual totals', 'pos/payment app', 'accounting/business app', 'spreadsheet', 'whatsapp', 'someone else handles it']);
    return tokens.every(t => allowed.has(t)) ? tokens[0] === 'no records' : null;
  }
  return choices[signal] && Object.hasOwn(choices[signal], value) ? choices[signal][value] : null;
}

// Panel data are published only from explicit VERIFIED identities, one initial
// visit and a later labelled revisit. Changing samples or QA revisions are not a trend.
export function analyzeLongitudinal(table: SourceTable, today: string, approvalReference?: string): LongitudinalEvidence {
  const submissions = new Map<string, PanelRow[]>();
  for (const cells of table.rows) {
    const row = Object.fromEntries(SOURCE_COLUMNS.map((c, i) => [c.key, String(cells[i] ?? '').trim()])) as PanelRow;
    if (!row.submission) continue;
    const copies = submissions.get(row.submission) ?? []; copies.push(row); submissions.set(row.submission, copies);
  }
  const identities = new Map<string, PanelRow[]>();
  const blockedIdentities = new Set<string>();
  for (const copies of submissions.values()) {
    const row = copies[0];
    if (copies.some(copy => clean(copy.identity) !== 'verified') || new Set(copies.map(copy => JSON.stringify(copy))).size !== 1) {
      for (const copy of copies) if (copy.canonical) blockedIdentities.add(copy.canonical);
      continue;
    }
    if (!/^ERI-LAG-M-\d{6}$/.test(row.canonical)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date || row.date < '2026-10-07' || row.date > today) continue;
    const type = clean(row.type);
    if (type !== 'initial observation (all newly recruited merchants)' && !/\b(revisit|follow.up|return visit)\b/.test(type)) continue;
    const visits = identities.get(row.canonical) ?? []; visits.push(row); identities.set(row.canonical, visits);
  }
  const pairs: [PanelRow, PanelRow][] = [];
  for (const [id, visits] of identities) {
    if (blockedIdentities.has(id)) continue;
    visits.sort((a, b) => a.date.localeCompare(b.date));
    const initial = visits.filter(row => clean(row.type) === 'initial observation (all newly recruited merchants)');
    if (initial.length !== 1 || visits[0] !== initial[0] || new Set(visits.map(v => v.date)).size !== visits.length) continue;
    const revisit = visits.find(row => row.date > initial[0].date && /\b(revisit|follow.up|return visit)\b/.test(clean(row.type)));
    if (revisit) pairs.push([initial[0], revisit]);
  }
  const series: LongitudinalEvidence['series'] = [];
  for (const signalId of ['payments', 'records', 'business', 'restock', 'credit', 'remote']) {
    const complete = pairs.filter(pair => pair.every(row => outcome(row, signalId) !== null));
    if (complete.length < MIN_RESPONSES) continue;
    series.push({ signalId, participants: complete.length, points: [0, 1].map(round => {
      const rows = complete.map(pair => pair[round]);
      const dates = rows.map(row => row.date).sort();
      return { round, count: rows.filter(row => outcome(row, signalId) === true).length, denominator: complete.length, start: dates[0], end: dates.at(-1)! };
    }) });
  }
  const approved = Boolean(approvalReference?.trim());
  return { status: series.length ? approved ? 'matched-visits-available' : 'awaiting-review' : 'awaiting-matched-visits', verifiedMatchedBusinesses: pairs.length, series: approved ? series : [] };
}
