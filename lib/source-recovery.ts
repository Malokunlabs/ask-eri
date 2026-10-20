import { SOURCE_COLUMNS, type SourceTable } from './source-schema.ts';

// Reviewed alternate layout: row 117 of the supplied source begins at BJ,
// 61 columns after A. Read only the same ten observation fields at that offset.
export const SHIFTED_SOURCE_COLUMNS = ['BJ', 'BP', 'BQ', 'CC', 'CE', 'CH', 'CL', 'CP', 'CT', 'CW'] as const;
export const RECOVERED_IDENTITY = 'PROVISIONAL: recovered shifted submission; identity unverified';
const clean = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function shiftedCandidates(table: SourceTable) {
  if (table.headers.length !== SOURCE_COLUMNS.length || table.headers.some((h,i) => clean(h) !== clean(SOURCE_COLUMNS[i].header))) throw new Error('Source schema changed; recovery held');
  return table.rows.flatMap((row,index) => row.slice(0,10).every(value => !value.trim()) && uuid.test(row[10]?.trim() ?? '') ? [index] : []);
}
export function recoverShiftedRows(table: SourceTable, recovered: { rowIndex: number; values: string[] }[]): SourceTable {
  const candidates = shiftedCandidates(table);
  if (recovered.length !== candidates.length || new Set(recovered.map(row => row.rowIndex)).size !== recovered.length) throw new Error('Incomplete shifted source recovery');
  const rows = table.rows.map(row => [...row]);
  for (const recovery of recovered) {
    const { rowIndex, values } = recovery;
    if (!candidates.includes(rowIndex) || values.length !== 10 || values.some(value => typeof value !== 'string')) throw new Error('Unrecognised shifted layout');
    const cells = values.map(value => value.trim());
    if (cells[0] !== rows[rowIndex][10].trim() || clean(cells[1]) !== 'initial observation (all newly recruited merchants)' || !/^\d{4}-\d{2}-\d{2}$/.test(cells[2]) || !Number.isFinite(Date.parse(cells[2])) || new Date(cells[2]).toISOString().slice(0,10) !== cells[2]) throw new Error('Shifted source markers do not reconcile');
    // Restore only actual source answers, discard misplaced metadata, and retain
    // explicit provenance. This does not verify identity or edit the source sheet.
    rows[rowIndex] = [...cells, '', RECOVERED_IDENTITY, `Source row ${rowIndex + 2}; recovered +61 column offset`];
  }
  return { headers: [...table.headers], rows };
}
