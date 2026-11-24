// An invoice: subtotal, discounts, tax, total.
//
// Two kinds of discount now exist. A line discount (item.discountCents) is part
// of that line's total, so the subtotal is already net of it. An order-level
// code (SPRING10, TAKE10, ...) comes off the subtotal afterwards.
const { sumCents } = require("./money");
const { normalizeLineItem, lineTotal } = require("./lineItems");
const { applyDiscountCode } = require("./discount");
const { computeTax } = require("./tax");

/**
 * Builds an invoice from line items.
 * @param {Array} items line items, see lineItems.js
 * @param {{region: string, code?: string}} opts tax region and optional order code
 */
function buildInvoice(items, { region, code } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("an invoice needs at least one line item");
  const lines = items.map(normalizeLineItem);
  const subtotal = sumCents(lines.map(lineTotal));
  const lineDiscounts = sumCents(lines.map((l) => l.discountCents));
  const discount = applyDiscountCode(subtotal, code);
  const taxable = subtotal - discount;
  const tax = computeTax(taxable, region);
  const total = subtotal - discount + tax;
  return { lines, subtotal, lineDiscounts, discount, taxable, tax, total, region, code: code || null };
}

module.exports = { buildInvoice };
