#!/usr/bin/env node
// Generates assets/benchmark.svg from REAL measured results: billed output
// tokens per ruleset as % of the same model with no ruleset, from the
// side-by-side run (Chisle 3.9 and 3.8.1, caveman and ponytail in one
// session, Haiku 4.5). Pooled sums over every task where all arms have a cell,
// the same method as benchmarks/pooled.js and the README table.
//
// Source: benchmarks/results/raw-nov-sidebyside/<suite>-s<seed>/<task>__<arm>.json
// Data-driven + CI-checkable: same cells in → same chart out.
//
// Run:  node scripts/build-chart.js          (write svg)
//       node scripts/build-chart.js --check   (fail if stale; for CI)
//       node scripts/build-chart.js --json

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'benchmarks', 'results', 'raw-nov-sidebyside');
const SVG_OUT = path.join(ROOT, 'assets', 'benchmark.svg');

// Our own arm. The key is the token in the committed raw filenames
// (<task>__chisle.json); renaming it orphans the result cells and zeroes our
// bar, so reference it through this constant.
const SELF = 'chisle';
const ARMS = [
  { key: 'caveman', label: 'caveman', color: '#d9822b' },
  { key: 'ponytail', label: 'ponytail', color: '#cf3b3b' },
  { key: 'chisle-3.8.1', label: 'Chisle 3.8.1', color: '#6e7681' },
  { key: SELF, label: 'Chisle', color: '#2da44e' },
];

function collect() {
  const rows = [];
  let dirs = [];
  try { dirs = fs.readdirSync(RAW_DIR); } catch (_) {}
  for (const d of dirs) {
    const dir = path.join(RAW_DIR, d);
    let files = [];
    try { files = fs.readdirSync(dir); } catch (_) { continue; }
    const cells = {};
    for (const f of files) {
      const m = f.match(/^(.+)__([\w.-]+)\.json$/);
      if (!m) continue;
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
      if (j && j.usage) (cells[m[1]] ||= {})[m[2]] = j.usage.output_tokens;
    }
    for (const c of Object.values(cells)) if (['vanilla', ...ARMS.map((a) => a.key)].every((k) => c[k] != null)) rows.push(c);
  }
  const base = rows.reduce((s, c) => s + c.vanilla, 0);
  const stat = { n: rows.length };
  for (const a of ARMS) stat[a.key] = base ? Math.round(100 * rows.reduce((s, c) => s + c[a.key], 0) / base) : 0;
  return stat;
}

function buildSvg(stat) {
  const W = 860, H = 300;
  const left = 170, top = 92, rowH = 50, plotW = 600;
  const px = plotW / 110;
  const line100 = left + 100 * px;

  let body =
    `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + ARMS.length * rowH - 10}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no ruleset</text>`;

  ARMS.forEach((a, i) => {
    const v = stat[a.key];
    const y = top + i * rowH;
    const bold = a.key === SELF ? ' font-weight="700"' : '';
    const w = Math.max(2, v * px);
    body +=
      `<text x="${left - 12}" y="${y + 21}" font-size="14" fill="#c9d1d9" text-anchor="end"${bold}>${a.label}</text>` +
      `<rect x="${left}" y="${y + 2}" width="${w}" height="28" rx="4" fill="${a.color}"/>` +
      `<text x="${left + w + 9}" y="${y + 21}" font-size="13" fill="#c9d1d9"${bold}>${v}%</text>`;
  });

  const aria = `Claude Code benchmark, ${stat.n} tasks in one run, billed output tokens as percent of the same model with no ruleset. ` +
    ARMS.map((a) => `${a.label} ${stat[a.key]}%`).join(', ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">Claude Code — billed output tokens, % of the same model with no ruleset</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="#8b949e" text-anchor="middle">Haiku 4.5, ${stat.n} tasks, all arms in one run; lower = cheaper</text>
${body}</svg>
`;
}

function main() {
  const stat = collect();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(stat, null, 2)); return; }
  const svg = buildSvg(stat);

  if (process.argv.includes('--check')) {
    let have = '';
    try { have = fs.readFileSync(SVG_OUT, 'utf8'); } catch (_) {}
    if (have !== svg) {
      console.error(`assets/${path.basename(SVG_OUT)} is stale. Run: node scripts/build-chart.js`);
      process.exit(1);
    }
    console.log('chart in sync.'); return;
  }

  fs.mkdirSync(path.dirname(SVG_OUT), { recursive: true });
  fs.writeFileSync(SVG_OUT, svg);
  console.log(`wrote ${path.relative(ROOT, SVG_OUT)}: ` + ARMS.map((a) => `${a.label} ${stat[a.key]}%`).join(', '));
}

main();
