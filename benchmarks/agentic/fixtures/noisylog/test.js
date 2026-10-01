const { execFileSync } = require('child_process');
const { applyDiscount } = require('./src/price');

let bad = 0;
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};

// Half-cents round up, everywhere, not just the one case the visible suite shows.
check('1995@10', applyDiscount(1995, 10), 1796);
check('1005@50', applyDiscount(1005, 50), 503);
check('1@50', applyDiscount(1, 50), 1);
check('999@33', applyDiscount(999, 33), 669);
check('1000@15', applyDiscount(1000, 15), 850);

// The visible suite must still pass as shipped.
try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (e) { bad++; console.log('FAIL visible suite still red'); }

process.exit(bad ? 1 : 0);
