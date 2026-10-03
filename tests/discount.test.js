const { discountPercentForScore, computeTotals } = require('../src/utils/discount');

describe('discount policy (FR08)', () => {
  test.each([[0, 0], [99, 0], [100, 5], [499, 5], [500, 10], [999, 10], [1000, 15], [5000, 15]])(
    'score %i -> %i%%', (score, pct) => expect(discountPercentForScore(score)).toBe(pct));
  test('invalid scores give no discount', () => {
    expect(discountPercentForScore(-1)).toBe(0);
    expect(discountPercentForScore(NaN)).toBe(0);
  });
  test('computeTotals applies percentage to server-side prices', () => {
    expect(computeTotals([{ unit_price: 1500, qty: 2 }, { unit_price: 25, qty: 1 }], 10))
      .toEqual({ subtotal: 3025, discountAmount: 302.5, total: 2722.5 });
  });
});
