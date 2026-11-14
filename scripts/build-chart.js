#!/usr/bin/env node
// Generates assets/benchmark.svg (dark) and assets/benchmark-light.svg from REAL measured results: billed output
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
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
// The README swaps these with <picture>. Bar tones follow ARMS order: two rivals,
// the previous Chisle, the current one.
const THEMES = [
  { out: path.join(ROOT, 'assets', 'benchmark.svg'), bg: '#0d1117', border: '#30363d', title: '#e6edf3', text: '#c9d1d9', muted: '#8b949e', accent: '#f0a85a', bars: ['#484f58', '#484f58', '#7d5530', '#d78a3c'] },
  { out: path.join(ROOT, 'assets', 'benchmark-light.svg'), bg: '#ffffff', border: '#d0d7de', title: '#1f2328', text: '#31363c', muted: '#59636e', accent: '#b35a14', bars: ['#afb8c1', '#afb8c1', '#ecc49b', '#d78a3c'] },
];

// Our own arm. The key is the token in the committed raw filenames
// (<task>__chisle.json); renaming it orphans the result cells and zeroes our
// bar, so reference it through this constant.
const SELF = 'chisle';
const ARMS = [
  { key: 'caveman', label: 'caveman' },
  { key: 'ponytail', label: 'ponytail' },
  { key: 'chisle-3.8.1', label: 'Chisle 3.8.1' },
  { key: SELF, label: 'Chisle' },
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

function buildSvg(stat, th) {
  const W = 860, H = 300;
  const left = 170, top = 92, rowH = 50, plotW = 600;
  const px = plotW / 110;
  const line100 = left + 100 * px;

  let body =
    `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + ARMS.length * rowH - 10}" stroke="${th.muted}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="${th.muted}" text-anchor="middle">100% = no ruleset</text>`;

  ARMS.forEach((a, i) => {
    const v = stat[a.key];
    const y = top + i * rowH;
    const self = a.key === SELF;
    const bold = self ? ' font-weight="700"' : '';
    const fill = self ? th.accent : th.text;
    const w = Math.max(2, v * px);
    const delay = (0.12 * i).toFixed(2);
    body +=
      `<text x="${left - 12}" y="${y + 21}" font-size="14" fill="${fill}" text-anchor="end"${bold}>${a.label}</text>` +
      `<rect x="${left}" y="${y + 2}" width="${w}" height="28" rx="5" fill="${th.bars[i]}">` +
      `<animate attributeName="width" values="0;${w}" dur="0.9s" begin="${delay}s" fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1"/></rect>` +
      `<text x="${left + w + 9}" y="${y + 21}" font-size="13" fill="${fill}"${bold}>${v}%</text>`;
  });

  const aria = `Claude Code benchmark, ${stat.n} tasks in one run, billed output tokens as percent of the same model with no ruleset. ` +
    ARMS.map((a) => `${a.label} ${stat[a.key]}%`).join(', ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}" role="img" aria-label="${aria}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${th.bg}" stroke="${th.border}"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="${th.title}" text-anchor="middle">Claude Code — billed output tokens, % of the same model with no ruleset</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="${th.muted}" text-anchor="middle">Haiku 4.5, ${stat.n} tasks, all arms in one run; lower = cheaper</text>
${body}</svg>
`;
}

function main() {
  const stat = collect();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(stat, null, 2)); return; }
  const check = process.argv.includes('--check');
  for (const th of THEMES) {
    const svg = buildSvg(stat, th);
    if (check) {
      let have = '';
      try { have = fs.readFileSync(th.out, 'utf8'); } catch (_) {}
      if (have !== svg) {
        console.error(`assets/${path.basename(th.out)} is stale. Run: node scripts/build-chart.js`);
        process.exit(1);
      }
      continue;
    }
    fs.mkdirSync(path.dirname(th.out), { recursive: true });
    fs.writeFileSync(th.out, svg);
    console.log(`wrote ${path.relative(ROOT, th.out)}: ` + ARMS.map((a) => `${a.label} ${stat[a.key]}%`).join(', '));
  }
  if (check) console.log('chart in sync.');
}

main();
