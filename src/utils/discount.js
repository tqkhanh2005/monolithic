// Discount policy (FR08 / UC07). The source documents say discount is derived
// from membership score but do not give the numeric table, so this policy is a
// documented assumption (see docs/ARCHITECTURE.md): percentage by score tier.
const TIERS = [
  { minScore: 1000, percent: 15 },
  { minScore: 500, percent: 10 },
  { minScore: 100, percent: 5 },
  { minScore: 0, percent: 0 },
];

function discountPercentForScore(score) {
  if (!Number.isFinite(score) || score < 0) return 0;
  return TIERS.find((t) => score >= t.minScore).percent;
}

function computeTotals(items, discountPercent) {
  const subtotal = items.reduce((s, i) => s + Math.round(i.unit_price * 100) * i.qty, 0) / 100;
  const discountAmount = Math.round(subtotal * discountPercent) / 100;
  return { subtotal, discountAmount, total: Math.round((subtotal - discountAmount) * 100) / 100 };
}

module.exports = { discountPercentForScore, computeTotals, TIERS };
