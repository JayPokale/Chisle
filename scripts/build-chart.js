#!/usr/bin/env node
// Generates assets/benchmark-pi.svg from REAL measured results: the visible
// answer each tool's ruleset produced on the Pi + GPT-5.5 suite, as % of the
// same model with no ruleset. Lower bar = shorter answer. Every other
// benchmark figure is published as text/tables in README.md and
// docs/benchmarks.md, not as a chart.
//
// Source: the committed raw model outputs under benchmarks/results/raw-pi/.
// Data-driven + CI-checkable: same cells in → same chart out.
//
// Run:  node scripts/build-chart.js          (write svg)
//       node scripts/build-chart.js --check   (fail if stale; for CI)
//       node scripts/build-chart.js --json

const fs = require('fs');
const path = require('path');
const { estTok } = require('../benchmarks/aggregate');

const ROOT = path.join(__dirname, '..');
const PI_RAW_DIR = path.join(ROOT, 'benchmarks', 'results', 'raw-pi');
const PI_SVG_OUT = path.join(ROOT, 'assets', 'benchmark-pi.svg');

// Our own arm. The key is the token in the committed raw filenames
// (raw*/<task>__chisle.json); renaming it orphans the result cells and zeroes
// our bar, so reference it through this constant.
const SELF = 'chisle';
const ARMS = [
  { key: 'caveman',  label: 'caveman', color: '#d9822b' },
  { key: 'ponytail', label: 'ponytail', color: '#cf3b3b' },
  { key: SELF,       label: 'Chisle',  color: '#2da44e' },
];

// Per arm: visible answer as % of vanilla, paired per task.
function collectPi() {
  const cells = {};
  let files = [];
  try { files = fs.readdirSync(PI_RAW_DIR); } catch (_) {}
  for (const f of files) {
    const m = f.match(/^(.+)__([a-z]+)\.json$/);
    if (!m) continue;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(PI_RAW_DIR, f), 'utf8')); } catch (_) { continue; }
    if (!d || d.is_error || !d.usage) continue;
    (cells[m[1]] ||= {})[m[2]] = estTok(d.result);
  }
  const stat = {};
  for (const a of ARMS) {
    let ans = 0, base = 0, n = 0;
    for (const c of Object.values(cells)) {
      if (c.vanilla == null || c[a.key] == null) continue;
      ans += c[a.key]; base += c.vanilla; n++;
    }
    stat[a.key] = { ans: base ? Math.round(100 * ans / base) : 0, n };
  }
  return stat;
}

function buildSvg(stat) {
  const W = 860, H = 260;
  const left = 150, top = 92, rowH = 50, plotW = 620;
  const px = plotW / 110;
  const line100 = left + 100 * px;

  let body =
    `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + ARMS.length * rowH - 10}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no ruleset</text>`;

  ARMS.forEach((a, i) => {
    const s = stat[a.key];
    const y = top + i * rowH;
    const bold = a.key === SELF ? ' font-weight="700"' : '';
    const w = Math.max(2, s.ans * px);
    body +=
      `<text x="${left - 12}" y="${y + 21}" font-size="14" fill="#c9d1d9" text-anchor="end"${bold}>${a.label}</text>` +
      `<rect x="${left}" y="${y + 2}" width="${w}" height="28" rx="4" fill="${a.color}"/>` +
      `<text x="${left + w + 9}" y="${y + 21}" font-size="13" fill="#c9d1d9"${bold}>${s.ans}%</text>`;
  });

  const aria = `Pi benchmark, ${stat[SELF].n} tasks, answer length as percent of the same model with no ruleset. ` +
    ARMS.map(a => `${a.label} ${stat[a.key].ans}%`).join(', ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">Pi — answer length, % of the same model with no ruleset</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="#8b949e" text-anchor="middle">${stat[SELF].n} tasks, one run; the answer the user reads; lower = leaner</text>
${body}</svg>
`;
}

function main() {
  const stat = collectPi();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(stat, null, 2)); return; }
  const svg = buildSvg(stat);

  if (process.argv.includes('--check')) {
    let have = '';
    try { have = fs.readFileSync(PI_SVG_OUT, 'utf8'); } catch (_) {}
    if (have !== svg) {
      console.error(`assets/${path.basename(PI_SVG_OUT)} is stale. Run: node scripts/build-chart.js`);
      process.exit(1);
    }
    console.log('chart in sync.'); return;
  }

  fs.mkdirSync(path.dirname(PI_SVG_OUT), { recursive: true });
  fs.writeFileSync(PI_SVG_OUT, svg);
  console.log(`wrote ${path.relative(ROOT, PI_SVG_OUT)}: ` + ARMS.map(a => `${a.label} ${stat[a.key].ans}%`).join(', '));
}

main();
