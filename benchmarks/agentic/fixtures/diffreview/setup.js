// Builds the fixture's git history in the copied repo (cwd). repo/ holds main
// (invoicing 2.1.0, tagged). Five commits on refactor/modules follow, sold as
// a pure refactor: quote style and arrow functions, money.js split in two,
// renamed locals, a shared validation helper, usage examples in the JSDoc. Every line of
// src changes, so the branch diff is large. Two behaviour changes hide in it,
// and the visible tests cover neither: an unknown discount code now silently
// gives no discount instead of throwing, and a quantity of 0 is now accepted.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const read = (f) => fs.readFileSync(f, 'utf8');
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const edit = (f, from, to) => {
  const s = read(f);
  if (!s.includes(from)) throw new Error(`setup: ${f} lacks ${JSON.stringify(from.slice(0, 50))}`);
  write(f, s.split(from).join(to));
};
const src = () => fs.readdirSync('src', { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => path.join('src', f));

const PEOPLE = { dana: ['Dana Ortiz', 'dana@example.com'], sam: ['Sam Lee', 'sam@example.com'], priya: ['Priya Nair', 'priya@example.com'] };
const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
const commit = (who, date, ...msg) => {
  const [name, email] = PEOPLE[who];
  const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  git('add', '-A');
  execFileSync('git', ['commit', '-q', ...msg.flatMap((m) => ['-m', m])], { stdio: 'pipe', env });
};

git('init', '-q', '-b', 'main');
commit('dana', '2026-11-20T10:00:00Z', 'Invoicing 2.1.0');
git('tag', 'v2.1.0');
git('checkout', '-q', '-b', 'refactor/modules');

// 1. Style: single quotes, no semicolons, arrow functions (tests too, not the runner).
const tests = fs.readdirSync('test').filter((f) => f.endsWith('.test.js')).map((f) => path.join('test', f));
for (const f of [...src(), ...tests]) {
  write(f, read(f).replace(/"/g, "'").replace(/;$/gm, '')
    .replace(/^function (\w+)\((.*)\) \{$/gm, 'const $1 = ($2) => {'));
}
commit('sam', '2026-11-21T09:30:00Z', 'Style: single quotes, no semicolons, arrow functions',
  'Matches the house style the storefront repo moved to in October. Mechanical:\nno behaviour change.');

// 2. money.js split into money/round.js and money/format.js.
const money = read('src/money.js');
const [head, fmt] = money.split(/(?=\/\*\*\n \* Formats cents)/);
write('src/money/round.js', head.replace(/^\/\/ Whole-cent money helpers.*\n/, '// Whole-cent arithmetic. Amounts are integers in cents throughout.\n') + 'module.exports = { roundCents, sumCents }\n');
write('src/money/format.js', '// Display formatting for whole-cent amounts.\n' + fmt.replace(/\nmodule\.exports = .*\n/, '\nmodule.exports = { formatMoney }\n'));
fs.rmSync('src/money.js');
for (const f of src()) if (read(f).includes("require('./money')")) edit(f, "require('./money')", f.endsWith('render.js') ? "require('./money/format')" : "require('./money/round')");
edit('test/money.test.js', "const { formatMoney, sumCents } = require('../src/money')", "const { formatMoney } = require('../src/money/format')\nconst { sumCents } = require('../src/money/round')");
commit('sam', '2026-11-21T11:05:00Z', 'Split money.js into money/round.js and money/format.js',
  'Rounding and formatting change for different reasons (finance vs design), so\nthey get separate modules. Imports updated; no behaviour change.');

// 3. Clearer local names. Merging the discount guards drops the unknown-code error.
edit('src/discount.js', "  if (!code) return 0\n  const d = DISCOUNT_CODES[code]\n  if (!d) throw new Error('unknown code: ' + code)\n  const off = d.pct ? roundCents((subtotal * d.pct) / 100) : d.flat\n  return Math.min(off, subtotal)",
  "  const entry = DISCOUNT_CODES[code]\n  if (!code || !entry) return 0\n  const amountOff = entry.pct ? roundCents((subtotal * entry.pct) / 100) : entry.flat\n  return Math.min(amountOff, subtotal)");
edit('src/tax.js', "const computeTax = (cents, region) => {\n  const rate = TAX_RATES[region]\n  if (rate === undefined) throw new Error('unknown region: ' + region)\n  return roundCents(cents * rate)",
  "const computeTax = (amount, region) => {\n  const taxRate = TAX_RATES[region]\n  if (taxRate === undefined) throw new Error('unknown region: ' + region)\n  return roundCents(amount * taxRate)");
edit('src/currency.js', "const convertCents = (cents, currency) => {\n  const rate = FX_RATES[currency]\n  if (rate === undefined) throw new Error('unknown currency: ' + currency)\n  return roundCents(cents * rate)",
  "const convertCents = (amount, currency) => {\n  const fxRate = FX_RATES[currency]\n  if (fxRate === undefined) throw new Error('unknown currency: ' + currency)\n  return roundCents(amount * fxRate)");
edit('src/render.js', 'const money = (c) =>', 'const show = (c) =>');
edit('src/render.js', 'money(', 'show(');
commit('priya', '2026-11-22T15:40:00Z', 'Rename locals for readability',
  'd -> entry, off -> amountOff, rate -> taxRate / fxRate, cents -> amount where\nthe value is not always cents, money -> show in render. Guards in\napplyDiscountCode merged into one. No behaviour change.');

// 4. Shared validation helper. Its minimum for qty is 0, not 1.
write('src/validate.js', "// Shared input checks for anything that crosses the API boundary.\n/**\n * Throws `message` unless `value` is an integer of at least `min`.\n * @returns {number} the value, for chaining\n */\nconst assertInt = (value, min, message) => {\n  if (!Number.isInteger(value) || value < min) throw new Error(message)\n  return value\n}\n\nmodule.exports = { assertInt }\n");
edit('src/lineItems.js', "  if (!Number.isInteger(qty) || qty < 1) throw new Error('bad qty for ' + item.sku)\n  if (!Number.isInteger(unitCents) || unitCents < 0) throw new Error('bad price for ' + item.sku)\n  if (!Number.isInteger(discountCents) || discountCents < 0 || discountCents > qty * unitCents) {\n    throw new Error('bad line discount for ' + item.sku)\n  }",
  "  assertInt(qty, 0, 'bad qty for ' + item.sku)\n  assertInt(unitCents, 0, 'bad price for ' + item.sku)\n  assertInt(discountCents, 0, 'bad line discount for ' + item.sku)\n  if (discountCents > qty * unitCents) throw new Error('bad line discount for ' + item.sku)");
edit('src/lineItems.js', '// Line items: { sku, qty, unitCents, discountCents? }. Quantities are whole units.\n', "// Line items: { sku, qty, unitCents, discountCents? }. Quantities are whole units.\nconst { assertInt } = require('./validate')\n\n");
commit('dana', '2026-11-23T10:15:00Z', 'Validation: shared assertInt helper',
  'lineItems had three hand-rolled integer checks; the marketplace importer needs\nthe same ones. assertInt(value, min, message) replaces them. No behaviour\nchange.');

// 5. Docs only: an @example on every exported helper.
const EXAMPLES = {
  'src/money/round.js': [['const roundCents', 'roundCents(1234.5) // 1235'], ['const sumCents', 'sumCents([100, 250, 5]) // 355']],
  'src/money/format.js': [['const formatMoney', "formatMoney(-450) // '-$4.50'"]],
  'src/currency.js': [['const convertCents', "convertCents(1000, 'EUR') // 920"]],
  'src/discount.js': [['const applyDiscountCode', "applyDiscountCode(5000, 'SPRING10') // 500"]],
  'src/tax.js': [['const computeTax', "computeTax(10000, 'CA-ON') // 1300"]],
  'src/lineItems.js': [['const normalizeLineItem', "normalizeLineItem({ sku: 'MUG-01', qty: '2', unitCents: 1250 })"], ['const lineTotal', "lineTotal({ qty: 2, unitCents: 1250, discountCents: 500 }) // 2000"]],
  'src/invoice.js': [['const buildInvoice', "buildInvoice([{ sku: 'MUG-01', qty: 2, unitCents: 1250 }], { region: 'CA-ON', code: 'SPRING10' })"]],
  'src/render.js': [['const renderInvoice', "renderInvoice(inv, 'EUR')"]],
  'src/validate.js': [['const assertInt', "assertInt(3, 1, 'bad qty') // 3"]],
};
for (const [f, list] of Object.entries(EXAMPLES)) {
  let s = read(f);
  for (const [at, ex] of list) {
    const i = s.indexOf(at);
    const end = s.lastIndexOf(' */', i);
    if (i < 0 || end < 0) throw new Error(`setup: no JSDoc before ${at} in ${f}`);
    // Single-line docs (/** ... */) become two lines; block docs gain a line.
    s = s[s.lastIndexOf('\n', end) + 1] === '/'
      ? s.slice(0, end) + `\n * @example ${ex}\n */` + s.slice(end + 3)
      : s.slice(0, end) + ` * @example ${ex}\n` + s.slice(end);
  }
  write(f, s);
}
commit('sam', '2026-11-24T08:50:00Z', 'Docs: @example on every exported helper', 'Comments only.');
