const { FX_RATES, convertCents } = require("../src/currency");

const cases = [];
for (const [currency, rate] of Object.entries(FX_RATES)) {
  for (const cents of [0, 1, 999, 2500, 10000]) {
    const want = Math.round(cents * rate);
    cases.push({ name: `convertCents ${cents} USD to ${currency} → ${want}`, got: () => convertCents(cents, currency), want });
  }
}
cases.push({ name: "convertCents rejects an unknown currency", got: () => { try { convertCents(100, "XXX"); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
module.exports = cases;
