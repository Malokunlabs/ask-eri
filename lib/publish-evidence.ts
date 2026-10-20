import { MIN_RESPONSES, SOURCE_COHORT } from './source-schema.ts';
import type { Analysis, Evidence, FieldQuality, Signal } from './evidence-types.ts';

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(`${iso}T12:00:00Z`));
}

export function publishEvidence(analysis: Analysis): Evidence {
  const { distributions: d, quality: q } = analysis;
  const label = analysis.period.start === analysis.period.end ? dateLabel(analysis.period.start) : `${dateLabel(analysis.period.start)} – ${dateLabel(analysis.period.end)}`;
  const limitation = `Non-representative field cohort; self-reported responses. ${q.identityReviewRows} included observations have unresolved identity-review flags and may include repeat submissions. Observations are not verified unique businesses. No national estimates or causal claims.`;
  const context = (id: keyof typeof d) => {
    const f = d[id];
    return `${f.valid} classifiable responses from ${q.includedRows} eligible initial observations. ${f.missing} missing, ${f.unknown} unknown or unrecognised, ${f.ambiguous} contradictory, ${f.notApplicable} not applicable. Only classifiable responses enter this signal’s denominator.`;
  };
  const count = (id: keyof typeof d, key: string) => d[id].counts[key] ?? 0;
  const ratio = (id: keyof typeof d, n: number, title: string) => ({ value: `${n} / ${d[id].valid}`, label: title });
  const signals: Signal[] = [];
  const add = (id: keyof typeof d, content: Omit<Signal, 'id' | 'context' | 'limitations' | 'denominator' | 'excludedResponses'>, caveat = '') => {
    if (d[id].valid < MIN_RESPONSES) return;
    signals.push({ id, ...content, denominator: d[id].valid, excludedResponses: q.includedRows - d[id].valid, context: context(id), limitations: `${limitation} ${caveat}`.trim() });
  };
  add('payments', {
    question: 'How are merchants receiving payments in Yaba?', title: 'Reported primary payment methods',
    answer: `Of ${d.payments.valid} classifiable responses, ${count('payments', 'transfer')} named transfers, ${count('payments', 'cash')} cash and ${count('payments', 'pos')} POS/card as the method receiving the largest share of customer payments.`,
    metrics: [ratio('payments', count('payments', 'transfer'), 'Transfer is primary'), ratio('payments', count('payments', 'cash'), 'Cash is primary')],
  }, 'These are reported primary methods, not transaction volumes or market shares.');
  add('records', {
    question: 'Do merchants keep track of their sales records?', title: 'Reported recordkeeping practices',
    answer: `${count('records', 'none')} of ${d.records.valid} classifiable responses selected “No records”. ${count('records', 'other')} selected another recognised response. Mixed “No records” selections and unrecognised options are held out.`,
    metrics: [ratio('records', count('records', 'none'), 'Selected no records'), ratio('records', count('records', 'other'), 'Other recognised response')],
  }, 'The combined “Memory Notebook/paper” option cannot distinguish memory from written records. Payment and recordkeeping totals do not establish individual overlap.');
  const better = count('business', 'muchBetter') + count('business', 'littleBetter');
  const worse = count('business', 'muchWorse') + count('business', 'littleWorse');
  add('business', {
    question: 'Are trading conditions improving?', title: 'Recalled business conditions over three months',
    answer: `Of ${d.business.valid} classifiable responses, ${better} described business as better than about three months earlier, ${count('business', 'same')} about the same and ${worse} worse.`,
    metrics: [ratio('business', better, 'Reported better conditions'), ratio('business', worse, 'Reported worse conditions')],
  }, 'Retrospective recollection at an initial visit is not measured longitudinal change. “Too new to say” is excluded.');
  const higher = count('restock', 'muchHigher') + count('restock', 'littleHigher');
  add('restock', {
    question: 'Are restocking costs changing?', title: 'Reported restocking expenditure',
    answer: `Among ${d.restock.valid} classifiable responses from businesses that restock, ${higher} reported higher expenditure, ${count('restock', 'same')} about the same and ${count('restock', 'lower')} lower than about three months earlier.`,
    metrics: [ratio('restock', higher, 'Reported higher expenditure'), { value: String(d.restock.notApplicable), label: 'Do not restock; excluded' }],
  }, 'Expenditure can change with prices, quantities or product mix. This does not measure price inflation or profit margins.');
  add('credit', {
    question: 'How common is business borrowing?', title: 'Reported borrowing or supplier credit',
    answer: `${count('credit', 'yes')} of ${d.credit.valid} classifiable responses reported borrowing money or receiving goods on credit for business operations during the previous 12 months; ${count('credit', 'no')} reported neither.`,
    metrics: [ratio('credit', count('credit', 'yes'), 'Reported borrowing or goods on credit'), ratio('credit', count('credit', 'no'), 'Reported neither')],
  }, 'The combined question does not distinguish loans from supplier credit or measure unmet demand.');
  const orders = count('remote', 'regularly') + count('remote', 'sometimes');
  add('remote', {
    question: 'Do businesses accept remote orders?', title: 'Reported remote ordering',
    answer: `Of ${d.remote.valid} classifiable responses, ${count('remote', 'regularly')} accepted remote orders regularly, ${count('remote', 'sometimes')} sometimes and ${count('remote', 'no')} not at all.`,
    metrics: [ratio('remote', orders, 'Regular or occasional orders'), ratio('remote', count('remote', 'no'), 'No remote orders')],
  }, 'Phone and messaging orders are included. This does not measure online sales value.');
  signals.push({
    id: 'coverage', question: 'Where does ERI have evidence today?', title: 'Current published cohort',
    answer: `${q.includedRows} eligible initial observations dated ${label} are included in this analysis of the configured Yaba–Sabo–Tejuosho cohort in Lagos. ${q.identityReviewRows} identity-review observations are included with warnings, and ${q.recoveredRows} shifted source rows were recovered. ${q.heldRows} source rows are held out of the published cohort.`,
    metrics: [{ value: String(q.includedRows), label: 'Eligible initial observations' }, { value: String(q.heldRows), label: 'Source rows held out' }],
    denominator: q.includedRows, excludedResponses: q.heldRows,
    context: 'Geography is the configured scope of this source; the form has no row-level market field. The historical 10-record pilot is not added to this source. No verified longitudinal comparison is published.',
    limitations: limitation,
  });
  const observedCounts: Record<string, number> = {
    payments: count('payments', 'transfer'), records: count('records', 'none'),
    business: better, restock: higher, credit: count('credit', 'yes'), remote: orders,
  };
  for (const signal of signals) {
    if (Object.hasOwn(observedCounts, signal.id)) signal.observed = { count: observedCounts[signal.id], denominator: signal.denominator };
  }
  const fields = Object.fromEntries(Object.entries(d).map(([key, { valid, missing, unknown, ambiguous, notApplicable }]) => [key, { valid, missing, unknown, ambiguous, notApplicable }])) as Record<string, FieldQuality>;
  return {
    version: 'analysis-v3', analyzedAt: analysis.analyzedAt, collection: analysis.collection, longitudinal: analysis.longitudinal,
    period: { ...analysis.period, label }, quality: q, fields, signals,
    coverage: [{ ...SOURCE_COHORT, publishedRecords: q.includedRows, period: label }],
  };
}
