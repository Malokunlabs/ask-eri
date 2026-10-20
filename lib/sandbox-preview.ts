export type SandboxResponse = 'absorb' | 'price' | 'quantity';

export const sandboxResponses: { id: SandboxResponse; title: string; description: string; scene: string; tradeoff: string; question: string; measures: string }[] = [
  {
    id: 'absorb', title: 'Absorb the cost', description: 'Keep selling prices and order size unchanged.', scene: 'Cost pressure',
    tradeoff: 'Buying the same quantity requires additional purchasing cash. If selling prices and all other factors stay unchanged, the gap between selling price and purchase cost narrows. Actual profit remains unknown.',
    question: 'When supplier costs change, do businesses hold selling prices, and how do they fund the same order?',
    measures: 'Record supplier quotes, order quantities, selling prices and how purchases are funded. Repeat these measures at the same businesses.',
  },
  {
    id: 'price', title: 'Review selling prices', description: 'Consider passing some of the cost to customers.', scene: 'Price review',
    tradeoff: 'The purchase still requires the same cash before goods are sold. A selling-price decision is separate: how much customers would buy at a different price is not estimated here.',
    question: 'When supplier costs change, do selling prices change, and what happens to quantities sold?',
    measures: 'Record supplier quotes, selling prices and quantities sold before and after a change. Note promotions, product mix and other market changes.',
  },
  {
    id: 'quantity', title: 'Buy fewer units', description: 'Keep the purchasing budget unchanged.', scene: 'Smaller order',
    tradeoff: 'The same purchasing budget covers fewer whole units when unit costs rise. Stockouts and lost sales are possibilities to investigate, not outcomes this calculator predicts.',
    question: 'When supplier costs change, do businesses reduce order sizes, switch suppliers or find extra purchasing cash?',
    measures: 'Record unit costs, quantities ordered, delivery frequency and supplier choices. Return to observe stock availability and replenishment timing.',
  },
];

// Mechanical purchasing arithmetic only. Integer kobo avoid decimal-price
// rounding errors. No elasticity, response probability or profit model is used.
export function calculateRestockingScenario(budget: number, unitCost: number, increase: number) {
  if (![budget, unitCost, increase].every(Number.isFinite) || budget <= 0 || unitCost <= 0 || budget > 100_000_000 || unitCost > 100_000_000 || increase < 0 || increase > 50) {
    throw new Error('Enter a positive budget and unit cost up to ₦100,000,000. The cost increase must be between 0% and 50%.');
  }
  const budgetKobo = Math.round(budget * 100);
  const unitKobo = Math.round(unitCost * 100);
  if (budgetKobo < 1 || unitKobo < 1) throw new Error('Amounts must be at least ₦0.01.');
  const newUnitKobo = Math.round(unitKobo * (1 + increase / 100));
  const startingUnits = Math.floor(budgetKobo / unitKobo);
  const affordableUnits = Math.floor(budgetKobo / newUnitKobo);
  const sameOrderKobo = startingUnits * newUnitKobo;
  return {
    startingUnits, affordableUnits,
    newUnitCost: newUnitKobo / 100,
    sameOrderCost: sameOrderKobo / 100,
    extraCash: Math.max(0, sameOrderKobo - budgetKobo) / 100,
    unspentBudget: (budgetKobo - affordableUnits * newUnitKobo) / 100,
  };
}
