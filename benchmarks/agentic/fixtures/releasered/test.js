const { execFileSync } = require('child_process');
const { buildInvoice } = require('./src/invoice');
const { formatMoney } = require('./src/money');
const { convertCents } = require('./src/currency');
const { computeTax } = require('./src/tax');

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};
const tryRun = (f) => { try { return f(); } catch (e) { return 'throws: ' + e.message; } };
const items = [{ sku: 'MUG-01', qty: 2, unitCents: 1250 }, { sku: 'TEE-L', qty: 1, unitCents: 2400 }];

// Tax applies to what the customer pays: the subtotal after the order code.
const on = buildInvoice(items, { region: 'CA-ON', code: 'SPRING10' });
check('CA-ON SPRING10 tax', on.tax, 573);
check('CA-ON SPRING10 total', on.total, 4983);
check('DE TAKE10 total', buildInvoice(items, { region: 'DE', code: 'TAKE10' }).total, 4641);
check('US-CA no code total', buildInvoice(items, { region: 'US-CA' }).total, 5255);
// Cents pad on the left, whatever the amount.
check('formatMoney 1005', formatMoney(1005), '$10.05');
check('formatMoney -7', formatMoney(-7), '-$0.07');
check('formatMoney 30', formatMoney(30), '$0.30');

// Everything else since v2.0.0 stays.
check('thousands separators kept', formatMoney(123456789), '$1,234,567.89');
check('line discount kept', tryRun(() => buildInvoice([{ sku: 'A', qty: 2, unitCents: 1000, discountCents: 300 }], { region: 'CA-ON', code: 'SPRING10' }).total), 1729);
check('new currency kept', tryRun(() => convertCents(1000, 'THB')), 36400);
check('new state kept', tryRun(() => computeTax(10000, 'US-NV')), 685);

// Fix the source, not the tests (against the release commit, in case the agent committed).
const rc = execFileSync('git', ['log', '--all', '--format=%H', '--grep=^Release 2.1.0-rc.1$'], { encoding: 'utf8' }).trim().split('\n').pop();
try { execFileSync('git', ['diff', '--quiet', rc, '--', 'test'], { stdio: 'pipe' }); } catch (_) { bad++; console.log('FAIL test files edited'); }
try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (_) { bad++; console.log('FAIL visible suite red'); }
process.exit(bad ? 1 : 0);
