const { DISCOUNT_CODES, applyDiscountCode } = require("../src/discount");

const cases = [];
for (const [code, d] of Object.entries(DISCOUNT_CODES)) {
  for (const subtotal of [300, 5000, 12999]) {
    const want = Math.min(d.pct ? Math.round((subtotal * d.pct) / 100) : d.flat, subtotal);
    cases.push({ name: `applyDiscountCode ${subtotal} with ${code} → ${want}`, got: () => applyDiscountCode(subtotal, code), want });
  }
}
cases.push({ name: "applyDiscountCode with no code → 0", got: () => applyDiscountCode(5000), want: 0 });
module.exports = cases;
