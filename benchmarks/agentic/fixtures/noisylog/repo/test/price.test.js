const { applyDiscount } = require('../src/price');

const cases = [];
for (const cents of [100, 500, 1200, 2500, 4000, 9900, 15000, 20000, 35000, 60000]) {
  for (const pct of [0, 5, 10, 20, 25, 50]) {
    const want = (cents * (100 - pct)) / 100;
    cases.push({ name: `applyDiscount ${cents} at ${pct}% → ${want}`, got: () => applyDiscount(cents, pct), want });
  }
}
cases.splice(31, 0, { name: 'applyDiscount rounds half-cents up: 1995 at 10% → 1796', got: () => applyDiscount(1995, 10), want: 1796 });

module.exports = cases;
