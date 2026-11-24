// Line items: { sku, qty, unitCents }. Quantities are whole units.
function normalizeLineItem(item) {
  const qty = Number(item.qty);
  const unitCents = Number(item.unitCents);
  if (!item.sku) throw new Error("line item needs a sku");
  if (!Number.isInteger(qty) || qty < 1) throw new Error("bad qty for " + item.sku);
  if (!Number.isInteger(unitCents) || unitCents < 0) throw new Error("bad price for " + item.sku);
  return { sku: String(item.sku), qty, unitCents };
}

const lineTotal = (item) => item.qty * item.unitCents;

module.exports = { normalizeLineItem, lineTotal };
