const { execFileSync } = require('child_process');
const { parseDuration } = require('./src/duration');

let bad = 0;
const outcome = (s) => { try { return parseDuration(s); } catch (_) { return 'throws'; } };
const check = (name, got, want) => {
  if (got !== want) { bad++; console.log('FAIL ' + name + ' -> ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
};

check('2h', outcome('2h'), 7200000);
check('1h30m', outcome('1h30m'), 5400000);
check('1.5h', outcome('1.5h'), 5400000);
check('1h0m5s', outcome('1h0m5s'), 3605000);
check('1m30s', outcome('1m30s'), 90000);
check('250ms', outcome('250ms'), 250);
check('3d', outcome('3d'), 'throws');
check('h', outcome('h'), 'throws');

// The visible suite must still pass.
try { execFileSync('node', ['test/run.js'], { stdio: 'pipe' }); } catch (e) { bad++; console.log('FAIL visible suite red'); }

process.exit(bad ? 1 : 0);
