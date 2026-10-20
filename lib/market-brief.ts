import archived from '../data/editions/yaba-2026-10-20.json' with { type: 'json' };
import type { Evidence, EvidenceResponse, Signal } from './evidence-types.ts';

function frozen<T>(value:T):T { if(value && typeof value==='object'){for(const item of Object.values(value))frozen(item);Object.freeze(value);}return value; }
export const editions = frozen([{ id: 'yaba-2026-10-20', published: '2026-10-20', evidence: frozen(archived as Evidence) }] as const);
export function editionById(id: string) { return editions.find(edition => edition.id === id); }
export function matchingEdition(evidence: Evidence) {
  const content = (value: Evidence) => { const { analyzedAt: _time, ...rest } = value; return JSON.stringify(rest); };
  return editions.find(edition => content(edition.evidence) === content(evidence));
}
const validFact = (signal: Signal | undefined, evidence: Evidence) => {
  if (!signal?.observed || signal.denominator !== signal.observed.denominator || evidence.fields[signal.id]?.valid !== signal.denominator || !Number.isInteger(signal.observed.count) || !Number.isInteger(signal.denominator) || signal.denominator < 10 || signal.observed.count < 0 || signal.observed.count > signal.denominator) return null;
  return { id: signal.id, question: signal.question, title: signal.title, count: signal.observed.count, denominator: signal.denominator, answer: signal.answer, context: signal.context, limitations: signal.limitations };
};
export function buildEvidenceHooks(data: EvidenceResponse) {
  if (!buildMarketBrief(data)) return [];
  const examples = [
    { id: 'restock', label: 'Restocking', audience: 'distributors' as const, buyer: 'For distribution & procurement teams', headline: 'reported higher restocking expenditure', relevance: 'Before your next replenishment pilot, find out what is changing the purchasing decision.', unknown: 'Unit prices, quantities and product mix are not separated by this finding.', question: 'Which product-level costs, order quantities and replenishment constraints should a distribution pilot investigate?' },
    { id: 'records', label: 'Recordkeeping', audience: 'finance' as const, buyer: 'For financial-institution pilot teams', headline: 'reported keeping no records', relevance: 'Scope a voluntary recordkeeping-support pilot around the practices businesses actually use.', unknown: 'This does not establish creditworthiness, demand for finance or who should receive support.', question: 'What recordkeeping practices and support needs should a consented business-support pilot verify?' },
    { id: 'remote', label: 'Remote orders', audience: 'research' as const, buyer: 'For research & development partners', headline: 'reported regular or occasional remote orders', relevance: 'Investigate how phone and message orders work before designing an ordering intervention.', unknown: 'Order value, channel performance and willingness to adopt a new tool remain unmeasured.', question: 'How are remote ordering channels used, and what should a consented follow-up study measure?' },
  ];
  return examples.flatMap(example => {
    const fact = validFact(data.evidence.signals.find(signal => signal.id === example.id), data.evidence);
    return fact ? [{ ...example, fact }] : [];
  });
}
export function buildMarketBrief(data: EvidenceResponse) {
  const { evidence } = data;
  const coverage = evidence.coverage.find(place => place.id === 'yaba-lagos');
  if (!coverage || evidence.coverage.length !== 1) return null;
  const restock = validFact(evidence.signals.find(signal => signal.id === 'restock'), evidence);
  const remote = validFact(evidence.signals.find(signal => signal.id === 'remote'), evidence);
  return {
    market: coverage.cluster, region: coverage.region, period: evidence.period.label,
    analyzedAt: evidence.analyzedAt, version: evidence.version, quality: evidence.quality,
    connection: data.connection, restock, remote, edition: matchingEdition(evidence)?.id ?? null,
    question: restock ? 'How do product-level unit costs, order quantities and replenishment frequency operate, and what changes on a return visit to the same consented businesses?' : remote ? 'How are remote orders used today, and what would a voluntary ordering pilot need to verify?' : 'Which market decision needs new evidence before a supported finding can be published?',
    interpretation: restock ? 'A distributor could investigate purchasing cash, order size, supplier choice and replenishment timing before designing a pilot.' : remote ? 'A team could investigate how phone or message orders are handled before proposing a new ordering process.' : null,
    unknowns: restock ? ['How much expenditure change reflects unit prices, quantities or product mix.', 'Product-level stock availability, delivery terms, margins and willingness to join a pilot.'] : ['Channel usage, customer needs and willingness to join a pilot need scoped fieldwork.'],
  };
}
export type MarketBriefModel = NonNullable<ReturnType<typeof buildMarketBrief>>;
export function briefCitation(brief: MarketBriefModel, origin: string) {
  const path = brief.edition ? `/briefs/${brief.edition}` : '/#market-brief';
  return `ERI. ${brief.market}, ${brief.region}: restocking and ordering field note. Observations ${brief.period}. ${brief.quality.includedRows} initial observations; ${brief.quality.identityReviewRows} identity-review flags. ${brief.version}. Analysed ${brief.analyzedAt}. ${brief.edition ? 'Archived aggregate edition' : 'Current, revisable view (not an archived edition)'}: ${origin}${path}. Non-representative; not verified unique businesses. No cross-signal overlap or measured longitudinal change is established.`;
}
export const evidenceChanges = [
  { date: '20 October 2026', kind: 'Inclusion policy & source repair', text: 'All 28 previously held-out rows joined the cohort: 27 review-flagged observations remain unverified; one shifted row was recovered from its source answers. The 87 → 115 revision is not economic growth or a measured trend.', edition: 'yaba-2026-10-20' },
  { date: '19 October 2026', kind: 'Identity QA revision', text: 'Identity-review flags prompted an earlier 87-observation cohort. The subsequent owner-approved policy includes these observations with visible warnings.', edition: null },
];
