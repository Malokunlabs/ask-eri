import { calculateRestockingScenario, sandboxResponses, type SandboxResponse } from './sandbox-preview.ts';
import type { Evidence } from './evidence-types.ts';

export const audiences = [
  { id: 'distributors', label: 'Distributors', title: 'Restocking & distribution', evidenceIds: ['restock', 'remote'] },
  { id: 'finance', label: 'Financial institutions', title: 'Design a support pilot', evidenceIds: ['credit', 'records', 'payments'] },
  { id: 'research', label: 'Research & development partners', title: 'Plan a matched field panel', evidenceIds: ['business', 'coverage'] },
] as const;
export type Audience = (typeof audiences)[number]['id'];
export type DecisionInputs = Record<string, number | string>;
export type DecisionBrief = {
  audience: Audience; title: string; question: string; measures: string;
  assumptions: { label: string; value: string }[];
  results: { label: string; value: string }[];
  limitations: string;
  evidence: { id: string; title: string; fact: string; context: string }[];
  evidenceVersion: string; evidenceDate: string; observationPeriod: string; cohortSize: number;
};
const money = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n);
function amount(raw: DecisionInputs, key: string, min: number, max: number, integer = false) {
  if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) throw new Error(`Enter a valid ${key}.`);
  const value = raw[key] as number;
  if (value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${key} is outside the supported planning range.`);
  return value;
}

export function buildDecision(audience: Audience, inputs: DecisionInputs, evidence: Evidence): DecisionBrief {
  const config = audiences.find(item => item.id === audience);
  if (!config) throw new Error('Choose a supported audience.');
  const base = {
    audience, title: config.title, evidenceVersion: evidence.version,
    evidenceDate: evidence.analyzedAt, observationPeriod: evidence.period.label, cohortSize: evidence.quality.includedRows,
    evidence: evidence.signals.filter(signal => (config.evidenceIds as readonly string[]).includes(signal.id)).map(signal => ({ id: signal.id, title: signal.title, fact: signal.answer, context: signal.context })),
  };
  if (audience === 'distributors') {
    const budget = amount(inputs, 'budget', 0.01, 100_000_000);
    const unitCost = amount(inputs, 'unitCost', 0.01, 100_000_000);
    const increase = amount(inputs, 'increase', 0, 50);
    const response = sandboxResponses.find(item => item.id === inputs.response as SandboxResponse);
    if (!response) throw new Error('Choose a hypothetical response.');
    const result = calculateRestockingScenario(budget, unitCost, increase);
    return { ...base,
      question: increase === 0 ? 'What purchasing baseline should we record before a follow-up?' : response.question,
      measures: response.measures,
      assumptions: [{ label: 'Purchasing budget', value: money(budget) }, { label: 'Starting unit cost', value: money(unitCost) }, { label: 'Assumed unit-cost increase', value: `${increase}%` }, { label: 'Chosen response', value: response.title }],
      results: [{ label: 'Starting whole units', value: String(result.startingUnits) }, { label: 'Whole units within unchanged budget', value: String(result.affordableUnits) }, { label: 'Extra cash for original whole-unit order', value: money(result.extraCash) }],
      limitations: 'Purchasing arithmetic from your assumptions. Reported restocking expenditure does not measure supplier-price inflation. Demand, profit and actual merchant responses are not predicted.',
    };
  }
  if (audience === 'finance') {
    const participants = amount(inputs, 'participants', 1, 10_000, true);
    const support = amount(inputs, 'support', 0.01, 10_000_000);
    const visits = amount(inputs, 'visits', 1, 12, true);
    return { ...base,
      question: 'What purchasing constraints, existing credit arrangements and recordkeeping practices should a voluntary support pilot verify first?',
      measures: 'With consent, document purchasing cycles, existing borrowing or supplier credit and available records. Return to observe use of support and business conditions. Assess suitability separately under a reviewed lending process.',
      assumptions: [{ label: 'Assumed pilot participants', value: String(participants) }, { label: 'Assumed support per participant', value: money(support) }, { label: 'Planned follow-up visits per participant', value: String(visits) }],
      results: [{ label: 'Gross support budget in this scenario', value: money(Math.round(participants * support * 100) / 100) }, { label: 'Planned follow-up visit slots', value: String(participants * visits) }],
      limitations: 'Operational planning only. These inputs are not an estimate of credit demand, eligibility, affordability, repayment, default risk or return. Separate cohort totals do not identify individual overlap.',
    };
  }
  const participants = amount(inputs, 'participants', 10, 10_000, true);
  const rounds = amount(inputs, 'rounds', 2, 12, true);
  const visitCost = amount(inputs, 'visitCost', 0.01, 1_000_000);
  return { ...base,
    question: 'What changes can we document by returning to the same consented, identity-reconciled businesses using consistent measures?',
    measures: 'Resolve canonical identities and return-visit consent first. Predefine measures and visit windows; document refusals, missingness, attrition, instrument changes and external events. Distinguish panel change from causal attribution.',
    assumptions: [{ label: 'Assumed future matched panel size', value: String(participants) }, { label: 'Planned rounds including baseline', value: String(rounds) }, { label: 'Assumed cost per completed visit', value: money(visitCost) }],
    results: [{ label: 'Planned visit slots', value: String(participants * rounds) }, { label: 'Illustrative visit budget', value: money(Math.round(participants * rounds * visitCost * 100) / 100) }],
    limitations: 'A planning calculator, not an ERI price quote, power calculation or retention forecast. The current cohort has provisional identities; no participant is automatically enrolled. Fieldwork requires consent, resourcing and a separate agreed scope.',
  };
}

export function evidenceDigestContent(evidence: Evidence) {
  const { analyzedAt: _timestamp, ...content } = evidence;
  return JSON.stringify(content);
}

// A question-led enquiry captures evidence without inventing calculator inputs.
export function buildInvestigation(audience: Audience, question: string, evidence: Evidence): DecisionBrief {
  const config=audiences.find(item=>item.id===audience);
  if (!config || typeof question !== 'string' || question.trim().length < 10 || question.length > 1500) throw new Error('Describe the decision in at least 10 characters.');
  return { audience, title: 'Scoped investigation enquiry', question: question.trim(), measures: 'Agree the decision, coverage, participants, consent, comparable measures and timing before fieldwork.', assumptions: [], results: [], limitations: 'An enquiry, not a commissioned study, price quote or predicted outcome. Requested geography and deadline must be checked for feasibility.', evidence: evidence.signals.filter(signal=>(config.evidenceIds as readonly string[]).includes(signal.id)).map(signal=>({id:signal.id,title:signal.title,fact:signal.answer,context:signal.context})), evidenceVersion:evidence.version,evidenceDate:evidence.analyzedAt,observationPeriod:evidence.period.label,cohortSize:evidence.quality.includedRows };
}
