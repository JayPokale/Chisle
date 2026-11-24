const fs = require('fs');
const { execFileSync } = require('child_process');

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};
const outcome = (f) => { try { f(); return 'ok'; } catch (_) { return 'throws'; } };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

// The fix lands on the branch, which keeps its refactor.
check('branch checked out', git('rev-parse', '--abbrev-ref', 'HEAD'), 'refactor/modules');
check('money.js stays split', fs.existsSync('src/money.js'), false);
const load = (m) => { try { return require(m); } catch (e) { return {}; } };
const { formatMoney } = load('./src/money/format');
const { assertInt } = load('./src/validate');
check('money/format.js formats', typeof formatMoney === 'function' && formatMoney(123456), '$1,234.56');
check('validate.js kept', typeof assertInt, 'function');
const { convertCents } = load('./src/currency');
check('EUR rate unchanged', typeof convertCents === 'function' && convertCents(1000, 'EUR'), 920);

// Behaviour back to main's.
const { applyDiscountCode } = load('./src/discount');
const { buildInvoice } = load('./src/invoice');
if (typeof applyDiscountCode !== 'function' || typeof buildInvoice !== 'function') { bad++; console.log('FAIL modules missing'); }
else {
  check('unknown code throws', outcome(() => applyDiscountCode(5000, 'NOPE10')), 'throws');
  check('no code gives no discount', applyDiscountCode(5000), 0);
  check('SPRING10 still applies', applyDiscountCode(5000, 'SPRING10'), 500);
  const line = (qty, unitCents = 100) => outcome(() => buildInvoice([{ sku: 'A', qty, unitCents }], { region: 'US-OR' }));
  check('qty 0 rejected', line(0), 'throws');
  check('qty -1 rejected', line(-1), 'throws');
  check('qty 1.5 rejected', line(1.5), 'throws');
  check('qty 1 accepted', line(1), 'ok');
  check('qty "2" still coerced', line('2'), 'ok');
  check('free item accepted', line(1, 0), 'ok');
}

// The branch's own tests, as built (the agent may add tests, not weaken them), pass
// against the fixed source; so does whatever suite the agent leaves.
const tip = git('log', '--all', '--format=%H', '--grep=^Docs: @example on every exported helper').split('\n').pop();
fs.rmSync('__orig_test', { recursive: true, force: true });
fs.mkdirSync('__orig_test');
for (const f of git('ls-tree', '--name-only', tip, 'test/').split('\n')) fs.writeFileSync('__orig_test/' + f.replace('test/', ''), git('show', tip + ':' + f) + '\n');
try { execFileSync('node', ['__orig_test/run.js'], { stdio: 'pipe' }); } catch (_) { bad++; console.log('FAIL original tests red'); }
fs.rmSync('__orig_test', { recursive: true, force: true });
try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (_) { bad++; console.log('FAIL visible suite red'); }
process.exit(bad ? 1 : 0);
