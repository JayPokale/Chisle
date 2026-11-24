const { buildInvoice } = require("../src/invoice");
const { renderInvoice } = require("../src/render");

const items = [{ sku: "MUG-01", qty: 2, unitCents: 1250 }, { sku: "TEE-L", qty: 1, unitCents: 2400 }];
const cases = [];
for (const region of ["CA-ON", "US-CA", "DE", "US-OR"]) {
  const inv = buildInvoice(items, { region });
  cases.push({ name: `buildInvoice subtotal in ${region} → 4900`, got: () => inv.subtotal, want: 4900 });
  cases.push({ name: `buildInvoice total = subtotal + tax in ${region}`, got: () => inv.total, want: inv.subtotal + inv.tax });
}
const oregon = buildInvoice(items, { region: "US-OR", code: "SPRING10" });
cases.push({ name: "buildInvoice SPRING10 in US-OR (no sales tax) → 4410", got: () => oregon.total, want: 4410 });
cases.push({ name: "renderInvoice shows the total line", got: () => renderInvoice(oregon).split("\n").pop(), want: "Total".padEnd(32) + "$44.10".padStart(14) });
const ontario = buildInvoice(items, { region: "CA-ON", code: "SPRING10" });
cases.push({ name: "buildInvoice SPRING10 in CA-ON taxes the discounted amount → 573", got: () => ontario.tax, want: 573 });
cases.push({ name: "buildInvoice SPRING10 in CA-ON → 4983", got: () => ontario.total, want: 4983 });
const lined = buildInvoice([{ sku: "MUG-01", qty: 2, unitCents: 1250, discountCents: 500 }], { region: "US-OR" });
cases.push({ name: "buildInvoice line discount comes off the line → 2000", got: () => lined.total, want: 2000 });
cases.push({ name: "buildInvoice reports line discounts → 500", got: () => lined.lineDiscounts, want: 500 });
cases.push({ name: "buildInvoice rejects an empty invoice", got: () => { try { buildInvoice([]); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
cases.push({ name: "normalizeLineItem rejects a line discount above the line", got: () => { try { buildInvoice([{ sku: "X", qty: 1, unitCents: 100, discountCents: 101 }]); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
module.exports = cases;
