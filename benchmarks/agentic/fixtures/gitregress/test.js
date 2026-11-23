const { execFileSync } = require('child_process');
const { buildInvoice } = require('./src/invoice');
const { renderInvoice } = require('./src/render');

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};
const items = [{ sku: 'MUG-01', qty: 2, unitCents: 1250 }, { sku: 'TEE-L', qty: 1, unitCents: 2400 }];

// Tax applies to what the customer pays: the subtotal after the discount.
const on = buildInvoice(items, { region: 'CA-ON', code: 'SPRING10' });
check('CA-ON SPRING10 tax', on.tax, 573);
check('CA-ON SPRING10 total', on.total, 4983);
const de = buildInvoice(items, { region: 'DE', code: 'TAKE10' });
check('DE TAKE10 total', de.total, 4641);
const plain = buildInvoice(items, { region: 'US-CA' });
check('US-CA no code total', plain.total, 5255);
// The rest of the modernise commit stays: its export names are the API now.
check('renderInvoice export', typeof renderInvoice, 'function');

try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (e) { bad++; console.log('FAIL visible suite red'); }
process.exit(bad ? 1 : 0);
