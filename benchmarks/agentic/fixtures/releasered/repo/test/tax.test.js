const { TAX_RATES, computeTax } = require("../src/tax");

const cases = [];
for (const region of Object.keys(TAX_RATES)) {
  for (const cents of [0, 999, 2500, 10000]) {
    const want = Math.round(cents * TAX_RATES[region]);
    cases.push({ name: `computeTax ${cents} in ${region} → ${want}`, got: () => computeTax(cents, region), want });
  }
}
cases.push({ name: "computeTax rejects an unknown region", got: () => { try { computeTax(100, "XX"); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
module.exports = cases;
