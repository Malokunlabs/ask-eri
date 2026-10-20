import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRestockingScenario } from '../lib/sandbox-preview.ts';

test('15 percent hypothetical cost shock reconciles the purchasing budget', () => {
  const result = calculateRestockingScenario(100000, 1000, 15);
  assert.equal(result.startingUnits, 100);
  assert.equal(result.affordableUnits, 86);
  assert.equal(result.newUnitCost, 1150);
  assert.equal(result.extraCash, 15000);
  assert.equal(result.sameOrderCost, 115000);
  assert.equal(result.unspentBudget, 1100);
});
test('zero shock changes neither whole-unit capacity nor required cash', () => {
  const result = calculateRestockingScenario(100000, 1000, 0);
  assert.equal(result.affordableUnits, result.startingUnits);
  assert.equal(result.extraCash, 0);
});
test('maximum shock rounds quantities down rather than overspending', () => {
  const result = calculateRestockingScenario(100000, 1000, 50);
  assert.equal(result.affordableUnits, 66);
  assert.equal(result.extraCash, 50000);
  assert.ok(result.affordableUnits * result.newUnitCost <= 100000);
});
test('decimal currency is calculated in integer kobo', () => {
  const result = calculateRestockingScenario(0.3, 0.1, 0);
  assert.equal(result.startingUnits, 3);
  assert.equal(result.affordableUnits, 3);
  assert.equal(result.unspentBudget, 0);
});
test('unused starting budget can fund part of the higher order cost', () => {
  const result = calculateRestockingScenario(10500, 1000, 5);
  assert.equal(result.startingUnits, 10);
  assert.equal(result.extraCash, 0);
});
test('budget below one unit returns zero purchasing capacity', () => {
  const result = calculateRestockingScenario(500, 1000, 15);
  assert.equal(result.startingUnits, 0);
  assert.equal(result.affordableUnits, 0);
});
test('invalid inputs cannot create fabricated arithmetic', () => {
  for (const args of [[0, 1000, 15], [1000, 0, 15], [NaN, 1000, 15], [Infinity, 1000, 15], [1000, 100, -5], [1000, 100, 55], [0.001, 0.001, 15], [100000001, 1, 15]]) {
    assert.throws(() => calculateRestockingScenario(...args as [number, number, number]));
  }
});
