// An invoice: subtotal, discount, tax on what the customer pays, total.
const { sumCents } = require("./money");
const { normalizeLineItem, lineTotal } = require("./lineItems");
const { applyDiscountCode } = require("./discount");
const { computeTax } = require("./tax");

function buildInvoice(items, { region, code } = {}) {
  const lines = items.map(normalizeLineItem);
  const subtotal = sumCents(lines.map(lineTotal));
  const discount = applyDiscountCode(subtotal, code);
  const tax = computeTax(subtotal, region);
  const total = subtotal - discount + tax;
  return { lines, subtotal, discount, tax, total, region, code: code || null };
}

module.exports = { buildInvoice };
