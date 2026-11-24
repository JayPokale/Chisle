const { buildInvoice } = require("../src/invoice");
const { renderInvoice } = require("../src/render");
const { FX_RATES } = require("../src/currency");

const items = [{ sku: "MUG-01", qty: 2, unitCents: 1250 }, { sku: "PIN-03", qty: 3, unitCents: 105 }];
const inv = buildInvoice(items, { region: "CA-ON", code: "SPRING10" });
const cases = [];
for (const currency of Object.keys(FX_RATES)) {
  cases.push({ name: `renderInvoice in ${currency} labels every amount`, got: () => renderInvoice(inv, currency).split("\n").filter((l) => /\d\.\d\d$/.test(l)).every((l) => currency === "USD" || l.includes(currency + " ")), want: true });
}
cases.push({ name: "renderInvoice PIN-03 row", got: () => renderInvoice(inv).split("\n")[1], want: "PIN-03         3 x        $1.05          $3.15" });
cases.push({ name: "renderInvoice CA-ON SPRING10 total row", got: () => renderInvoice(inv).split("\n").pop(), want: "Total".padEnd(32) + "$28.62".padStart(14) });
module.exports = cases;
