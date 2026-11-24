// Minimal Jest-style runner. Usage: node test/run.js [filter]
const fs = require('fs');
const path = require('path');

const filter = process.argv[2] || '';
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js') && f.includes(filter)).sort();
let passed = 0;
let failed = 0;

for (const file of files) {
  const cases = require(path.join(__dirname, file));
  const lines = [];
  const failures = [];
  cases.forEach((c, i) => {
    const got = c.got();
    if (got === c.want) {
      passed++;
      lines.push(`    ✓ ${c.name} (${(i * 7) % 5 + 1} ms)`);
    } else {
      failed++;
      lines.push(`    ✕ ${c.name} (${(i * 7) % 5 + 1} ms)`);
      failures.push(`  ● ${file.replace('.test.js', '')} › ${c.name}\n\n    Expected: ${JSON.stringify(c.want)}\n    Received: ${JSON.stringify(got)}\n`);
    }
  });
  console.log(`${failures.length ? ' FAIL ' : ' PASS '} test/${file}`);
  console.log(lines.join('\n'));
  if (failures.length) console.log('\n' + failures.join('\n'));
}

console.log(`\nTests:       ${failed ? failed + ' failed, ' : ''}${passed} passed, ${passed + failed} total`);
process.exit(failed ? 1 : 0);
