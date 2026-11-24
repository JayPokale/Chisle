// Plain-text invoice, one line per item, totals right-aligned.
const { formatMoney } = require("./money");
const { lineTotal } = require("./lineItems");
const { convertCents } = require("./currency");

/**
 * Plain-text invoice for email and the PDF job.
 * @param {object} inv from buildInvoice
 * @param {string} [currency="USD"] display currency, a key of FX_RATES
 */
function renderInvoice(inv, currency = "USD") {
  const money = (c) => (currency === "USD" ? formatMoney(c) : formatMoney(convertCents(c, currency), currency + " "));
  const rows = inv.lines.map((l) => `${l.sku.padEnd(12)} ${String(l.qty).padStart(3)} x ${money(l.unitCents).padStart(12)} ${money(lineTotal(l)).padStart(14)}`);
  rows.push("".padEnd(46, "-"));
  if (inv.lineDiscounts) rows.push("Line discounts (included)".padEnd(32) + money(-inv.lineDiscounts).padStart(14));
  rows.push("Subtotal".padEnd(32) + money(inv.subtotal).padStart(14));
  if (inv.discount) rows.push(("Discount " + inv.code).padEnd(32) + money(-inv.discount).padStart(14));
  rows.push(("Tax " + inv.region).padEnd(32) + money(inv.tax).padStart(14));
  rows.push("Total".padEnd(32) + money(inv.total).padStart(14));
  return rows.join("\n");
}

module.exports = { renderInvoice };
