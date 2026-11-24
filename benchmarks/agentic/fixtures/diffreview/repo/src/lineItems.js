// Line items: { sku, qty, unitCents, discountCents? }. Quantities are whole units.
/**
 * Validates a line item and coerces its numbers.
 * @returns {{sku: string, qty: number, unitCents: number, discountCents: number}}
 */
function normalizeLineItem(item) {
  const qty = Number(item.qty);
  const unitCents = Number(item.unitCents);
  const discountCents = Number(item.discountCents || 0);
  if (!item.sku) throw new Error("line item needs a sku");
  if (!Number.isInteger(qty) || qty < 1) throw new Error("bad qty for " + item.sku);
  if (!Number.isInteger(unitCents) || unitCents < 0) throw new Error("bad price for " + item.sku);
  if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > qty * unitCents) {
    throw new Error("bad line discount for " + item.sku);
  }
  return { sku: String(item.sku), qty, unitCents, discountCents };
}

// What the line costs after its own discount.
/** Line total in cents: qty times unit price, less the line discount. */
const lineTotal = (item) => item.qty * item.unitCents - (item.discountCents || 0);

module.exports = { normalizeLineItem, lineTotal };
