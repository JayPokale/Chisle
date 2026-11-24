// Builds the fixture's git history in the copied repo (cwd). repo/ holds the
// green v2.0.0 release; six commits after the tag follow, from three authors.
// Two of them break `npm test`: the per-line discount groundwork starts taxing
// the pre-discount subtotal (inside a large rewrite), and the thousands
// separator change pads cents on the wrong side. The others (more currencies,
// more US states, JSDoc everywhere, the release bump) are fine and must stay.
const fs = require('fs');
const { execFileSync } = require('child_process');

const read = (f) => fs.readFileSync(f, 'utf8');
const edit = (f, from, to) => {
  const s = read(f);
  if (!s.includes(from)) throw new Error(`setup: ${f} lacks ${JSON.stringify(from.slice(0, 40))}`);
  fs.writeFileSync(f, s.replace(from, to));
};

const PEOPLE = { dana: ['Dana Ortiz', 'dana@example.com'], sam: ['Sam Lee', 'sam@example.com'], priya: ['Priya Nair', 'priya@example.com'] };
const commit = (who, date, ...msg) => {
  const [name, email] = PEOPLE[who];
  const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  execFileSync('git', ['add', '-A'], { stdio: 'pipe' });
  execFileSync('git', ['commit', '-q', ...msg.flatMap((m) => ['-m', m])], { stdio: 'pipe', env });
};

execFileSync('git', ['init', '-q', '-b', 'main']);
commit('dana', '2026-10-02T10:00:00Z', 'Invoicing 2.0: line items, discount codes, regional tax, multi-currency rendering');
execFileSync('git', ['tag', 'v2.0.0']);

edit('src/currency.js', '  "KRW": 1345,\n', '  "KRW": 1345,\n' + Object.entries({ THB: 36.4, TWD: 32.1, ZAR: 18.6, TRY: 32.4, ILS: 3.71, AED: 3.67, SAR: 3.75, PHP: 56.2, IDR: 15650, MYR: 4.72, VND: 24500, CLP: 925 }).map(([c, r]) => `  "${c}": ${r},\n`).join(''));
commit('sam', '2026-10-21T09:12:00Z', 'Currency: 12 more display currencies',
  'Display-only rates for the APAC and EMEA storefronts, at the 2026-10-31 close.\nRefreshed per release like the others; settlement stays in USD.');

edit('src/tax.js', '  "US-WA": 0.065,\n', '  "US-WA": 0.065,\n' + Object.entries({ 'US-AR': 0.065, 'US-CT': 0.0635, 'US-IA': 0.06, 'US-IN': 0.07, 'US-KS': 0.065, 'US-KY': 0.06, 'US-LA': 0.0445, 'US-MD': 0.06, 'US-MO': 0.04225, 'US-NC': 0.0475, 'US-NV': 0.0685, 'US-SC': 0.06, 'US-TN': 0.07, 'US-UT': 0.0485, 'US-VA': 0.053, 'US-WI': 0.05 }).map(([r, t]) => `  "${r}": ${t},\n`).join(''));
commit('priya', '2026-10-28T14:40:00Z', 'Tax: remaining US states with a state-level sales tax',
  'State rates only; county and city add-ons are still out of scope (see the\nfinance thread from 2026-09). Rates checked against the 2026 state tables.');

fs.writeFileSync('src/lineItems.js', `// Line items: { sku, qty, unitCents, discountCents? }. Quantities are whole units.
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
const lineTotal = (item) => item.qty * item.unitCents - (item.discountCents || 0);

module.exports = { normalizeLineItem, lineTotal };
`);
fs.writeFileSync('src/invoice.js', `// An invoice: subtotal, discounts, tax, total.
//
// Two kinds of discount now exist. A line discount (item.discountCents) is part
// of that line's total, so the subtotal is already net of it. An order-level
// code (SPRING10, TAKE10, ...) comes off the subtotal afterwards.
const { sumCents } = require("./money");
const { normalizeLineItem, lineTotal } = require("./lineItems");
const { applyDiscountCode } = require("./discount");
const { computeTax } = require("./tax");

function buildInvoice(items, { region, code } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("an invoice needs at least one line item");
  const lines = items.map(normalizeLineItem);
  const subtotal = sumCents(lines.map(lineTotal));
  const lineDiscounts = sumCents(lines.map((l) => l.discountCents));
  const discount = applyDiscountCode(subtotal, code);
  const taxable = subtotal;
  const tax = computeTax(taxable, region);
  const total = subtotal - discount + tax;
  return { lines, subtotal, lineDiscounts, discount, taxable, tax, total, region, code: code || null };
}

module.exports = { buildInvoice };
`);
edit('src/render.js', '  rows.push("".padEnd(46, "-"));\n', '  rows.push("".padEnd(46, "-"));\n  if (inv.lineDiscounts) rows.push("Line discounts (included)".padEnd(32) + money(-inv.lineDiscounts).padStart(14));\n');
edit('test/invoice.test.js', 'module.exports = cases;', `const lined = buildInvoice([{ sku: "MUG-01", qty: 2, unitCents: 1250, discountCents: 500 }], { region: "US-OR" });
cases.push({ name: "buildInvoice line discount comes off the line → 2000", got: () => lined.total, want: 2000 });
cases.push({ name: "buildInvoice reports line discounts → 500", got: () => lined.lineDiscounts, want: 500 });
cases.push({ name: "buildInvoice rejects an empty invoice", got: () => { try { buildInvoice([]); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
cases.push({ name: "normalizeLineItem rejects a line discount above the line", got: () => { try { buildInvoice([{ sku: "X", qty: 1, unitCents: 100, discountCents: 101 }]); return "ok"; } catch (_) { return "throws"; } }, want: "throws" });
module.exports = cases;`);
commit('dana', '2026-11-04T16:05:00Z', 'Invoice: per-line discount groundwork',
  'Line items take an optional discountCents, which comes off that line\'s total,\nso the subtotal is net of line discounts. buildInvoice reports lineDiscounts\nand the taxable amount, rejects an empty item list, and render shows the line\ndiscounts row when there are any.',
  'Order-level codes behave as before. Marketplace import (the reason for this)\nlands separately.');

const DOCS = {
  'src/money.js': [['const roundCents', '/** Rounds a fractional cent amount to whole cents (half away from zero for positives). */\n'], ['const sumCents', '/** Sums an array of cent amounts. */\n'], ['function formatMoney', '/**\n * Formats cents for display: formatMoney(1050) is "$10.50".\n * @param {number} cents integer cents, may be negative\n * @param {string} [symbol="$"] prefix placed after the sign\n */\n']],
  'src/currency.js': [['function convertCents', '/**\n * Converts USD cents to the display currency\'s minor units at the fixed rate.\n * @throws on a currency missing from FX_RATES\n */\n']],
  'src/discount.js': [['function applyDiscountCode', '/**\n * Amount an order-level code takes off, in cents, never more than the subtotal.\n * @param {number} subtotal cents\n * @param {string} [code] a key of DISCOUNT_CODES; no code means no discount\n */\n']],
  'src/tax.js': [['function computeTax', '/**\n * Sales tax on an amount in cents for a region key such as "CA-ON" or "DE".\n * @throws on a region missing from TAX_RATES\n */\n']],
  'src/lineItems.js': [['function normalizeLineItem', '/**\n * Validates a line item and coerces its numbers.\n * @returns {{sku: string, qty: number, unitCents: number, discountCents: number}}\n */\n'], ['const lineTotal', '/** Line total in cents: qty times unit price, less the line discount. */\n']],
  'src/invoice.js': [['function buildInvoice', '/**\n * Builds an invoice from line items.\n * @param {Array} items line items, see lineItems.js\n * @param {{region: string, code?: string}} opts tax region and optional order code\n */\n']],
  'src/render.js': [['function renderInvoice', '/**\n * Plain-text invoice for email and the PDF job.\n * @param {object} inv from buildInvoice\n * @param {string} [currency="USD"] display currency, a key of FX_RATES\n */\n']],
};
for (const [f, docs] of Object.entries(DOCS)) for (const [at, doc] of docs) edit(f, at, doc + at);
commit('sam', '2026-11-09T11:30:00Z', 'Docs: JSDoc for every exported helper',
  'No code changes. The PDF job team asked for hover docs in their editor.');

edit('src/money.js', '  return sign + symbol + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");',
  '  const whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");\n  const frac = String(abs % 100).padEnd(2, "0");\n  return sign + symbol + whole + "." + frac;');
edit('src/money.js', 'formatMoney(1050) is "$10.50".', 'formatMoney(123456) is "$1,234.56".');
edit('test/money.test.js', '[0, 1, 9, 10, 99, 100, 101, 999, 1000, 1050, 12345, 99999, 100000, -1, -250, -99999]', '[0, 1, 9, 10, 99, 100, 101, 999, 1000, 1050, 12345, 99999, 100000, 123456789, -1, -250, -99999, -123456]');
edit('test/money.test.js', '"$" + Math.floor(abs / 100) + "."', '"$" + Math.floor(abs / 100).toLocaleString("en-US") + "."');
commit('priya', '2026-11-16T10:20:00Z', 'Money: thousands separators in formatMoney',
  'Large B2B invoices were unreadable ("$1234567.89"). formatMoney now groups\nthe whole part with commas; the cents part is unchanged. Tests cover the new\ngrouping.');

edit('package.json', '"version": "2.0.0"', '"version": "2.1.0-rc.1"');
fs.writeFileSync('CHANGELOG.md', `# Changelog

## 2.1.0-rc.1

- 12 more display currencies
- Sales tax for the remaining US states
- Per-line discounts (groundwork)
- JSDoc on every exported helper
- Thousands separators in formatted amounts

## 2.0.0

- Line items, discount codes, regional tax, multi-currency rendering
`);
commit('dana', '2026-11-18T17:45:00Z', 'Release 2.1.0-rc.1');
