// Builds the fixture's git history in the copied repo (cwd). repo/ holds HEAD:
// a "modernise" commit that renamed every export, switched var→const and
// quote style, and, buried in that diff, started taxing the pre-discount
// subtotal. HEAD~1 is derived from it by undoing those edits.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const NAMES = { formatMoney: 'fmtMoney', computeTax: 'calcTax', applyDiscountCode: 'calcDiscount', normalizeLineItem: 'normItem', lineTotal: 'itemTotal', buildInvoice: 'makeInvoice', renderInvoice: 'printInvoice', convertCents: 'convert' };
const files = ['src', 'test'].flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f))).filter((f) => f.endsWith('.js') && !f.endsWith('run.js'));
const head = Object.fromEntries(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const before = (f, src) => {
  let s = src.replace('computeTax(subtotal, region)', 'computeTax(subtotal - discount, region)');
  for (const [now, was] of Object.entries(NAMES)) s = s.split(now).join(was);
  // Tests keep const: their loop closures need block scope.
  if (f.startsWith('src')) s = s.replace(/\bconst /g, 'var ');
  return s.replace(/"/g, "'");
};

const who = { GIT_AUTHOR_NAME: 'Dana Ortiz', GIT_AUTHOR_EMAIL: 'dana@example.com', GIT_COMMITTER_NAME: 'Dana Ortiz', GIT_COMMITTER_EMAIL: 'dana@example.com' };
const git = (args, date) => execFileSync('git', args, { stdio: 'pipe', env: { ...process.env, ...who, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
git(['init', '-q', '-b', 'main']);
for (const f of files) fs.writeFileSync(f, before(f, head[f]));
git(['add', '-A']);
git(['commit', '-q', '-m', 'Invoicing: line items, discount codes, regional tax, rendering'], '2026-10-02T10:00:00Z');
for (const f of files) fs.writeFileSync(f, head[f]);
git(['add', '-A']);
git(['commit', '-q', '-m', 'Modernise: const, double quotes, clearer export names', '-m', 'No behaviour change intended.'], '2026-11-14T16:30:00Z');
