#!/usr/bin/env node
// Generates assets/benchmark.svg (dark) and assets/benchmark-light.svg from REAL measured results: billed output
// tokens per ruleset as % of the same model with no ruleset, from the
// side-by-side run (Chisle 3.14 and 3.13, which share one ruleset, caveman
// and ponytail in one session, Haiku 4.5, 2026-11-19). Pooled sums over every task where all arms have a cell,
// the same method as benchmarks/pooled.js and the README table.
//
// Source: benchmarks/results/raw-314-sidebyside/<suite>-s<seed>/<task>__<arm>.json
// Data-driven + CI-checkable: same cells in → same chart out.
//
// A second chart, assets/benchmark-terminal(-light).svg, shows the input
// axis: terminal output Claude reads, as % of raw, over the 37-command corpus
// in benchmarks/results/raw-314-commands/commands.json (benchmarks/replay-commands.js
// --json). caveman and ponytail are rulesets with no tool-output hook, so
// they read 100% by construction; RTK is the measured rival there.
//
// A third chart, assets/benchmark-cost(-light).svg: see collectCost().
//
// Run:  node scripts/build-chart.js          (write svg)
//       node scripts/build-chart.js --check   (fail if stale; for CI)
//       node scripts/build-chart.js --json

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'benchmarks', 'results', 'raw-314-sidebyside');
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
  { key: 'chisle-3.13', label: 'Chisle 3.13' },
  { key: SELF, label: 'Chisle' },
];
const TERM_ARMS = [
  { key: 'caveman', label: 'caveman' },
  { key: 'ponytail', label: 'ponytail' },
  { key: 'rtk', label: 'RTK' },
  { key: SELF, label: 'Chisle' },
];

function collectTerminal() {
  const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks', 'results', 'raw-314-commands', 'commands.json'), 'utf8'));
  const sum = (k) => rows.reduce((s, r) => s + r.chars[k], 0);
  const pct = (k) => Math.round((100 * sum(k)) / sum('bare'));
  return { n: rows.length, held: rows.filter((r) => r.held).length, caveman: 100, ponytail: 100, rtk: pct('rtk'), [SELF]: pct(SELF) };
}

// Third chart, assets/benchmark-cost(-light).svg: cost per fix on one real
// agent task (noisylog: a failing npm test with a 17k-char log, real repo,
// hidden test), mean $ per run as % of the bare agent, all arms in one session.
// Source: benchmarks/agentic/raw-noisylog/<fixture>__<arm>__<seed>.json
const COST_DIR = path.join(ROOT, 'benchmarks', 'agentic', 'raw-noisylog');
function collectCost() {
  const runs = {};
  for (const f of fs.readdirSync(COST_DIR)) {
    const r = JSON.parse(fs.readFileSync(path.join(COST_DIR, f), 'utf8'));
    (runs[r.arm] ||= []).push(r);
  }
  const mean = (a) => runs[a].reduce((s, r) => s + r.cost_usd, 0) / runs[a].length;
  const pct = (a) => Math.round((100 * mean(a)) / mean('vanilla'));
  return {
    n: runs.vanilla.length,
    allPassed: Object.values(runs).every((a) => a.every((r) => r.pass)),
    vsPrev: 100 - Math.round((100 * mean('chisle-hook')) / mean('chisle-hook-3.13')),
    caveman: pct('caveman'), ponytail: pct('ponytail'), rtk: pct('rtk'), [SELF]: pct('chisle-hook'),
  };
}

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

function buildSvg(stat, th, spec) {
  const ARMS = spec.arms;
  const W = 860, H = 300;
  const left = 170, top = 92, rowH = 50, plotW = 600;
  const px = plotW / 110;
  const line100 = left + 100 * px;

  let body =
    `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + ARMS.length * rowH - 10}" stroke="${th.muted}" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="${th.muted}" text-anchor="middle">${spec.line}</text>`;

  ARMS.forEach((a, i) => {
    const v = stat[a.key];
    const y = top + i * rowH;
    const self = a.key === SELF;
    const bold = self ? ' font-weight="700"' : '';
    const fill = self ? th.accent : th.text;
    const w = Math.max(2, v * px);
    const delay = (0.12 * i).toFixed(2);
    // A value label that would straddle the dashed 100% line goes just past it.
    let lx = left + w + 9;
    if (lx < line100 && lx + 36 > line100) lx = line100 + 8;
    body +=
      `<text x="${left - 12}" y="${y + 21}" font-size="14" fill="${fill}" text-anchor="end"${bold}>${a.label}</text>` +
      `<rect x="${left}" y="${y + 2}" width="${w}" height="28" rx="5" fill="${(spec.bars ? spec.bars(th) : th.bars)[i]}">` +
      `<animate attributeName="width" values="0;${w}" dur="0.9s" begin="${delay}s" fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.2 1"/></rect>` +
      `<text x="${lx}" y="${y + 21}" font-size="13" fill="${fill}"${bold}>${v}%</text>`;
  });

  const aria = spec.aria(stat) + ' ' + ARMS.map((a) => `${a.label} ${stat[a.key]}%`).join(', ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}" role="img" aria-label="${aria}">
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="${th.bg}" stroke="${th.border}"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="${th.title}" text-anchor="middle">${spec.title}</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="${th.muted}" text-anchor="middle">${spec.sub(stat)}</text>
${body}</svg>
`;
}

const CHARTS = [
  { collect, arms: ARMS, suffix: '', line: '100% = no ruleset',
    title: 'Claude Code — billed output tokens, % of the same model with no ruleset',
    sub: (s) => `Haiku 4.5, ${s.n} answers, all arms in one run; lower = cheaper; 3.13 and 3.14 share one ruleset`,
    aria: (s) => `Claude Code benchmark, ${s.n} answers in one run, billed output tokens as percent of the same model with no ruleset.` },
  { collect: collectTerminal, arms: TERM_ARMS, suffix: '-terminal', line: '100% = raw output',
    bars: (th) => [th.bars[0], th.bars[0], th.bars[0], th.bars[3]], // RTK is a rival, not an older Chisle
    title: 'Terminal output Claude reads, % of the raw output',
    sub: (s) => `${s.n} shell commands (${s.held} held out), Claude Code limits; caveman and ponytail never touch tool output`,
    aria: (s) => `Terminal output Claude reads across ${s.n} shell commands, as percent of the raw output.` },
  { collect: collectCost, arms: TERM_ARMS, suffix: '-cost', line: '100% = no ruleset',
    bars: (th) => [th.bars[0], th.bars[0], th.bars[0], th.bars[3]],
    title: 'Cost per fix on a real agent task, % of the same agent with no ruleset',
    sub: (s) => `Fix a failing npm test (17k-char log) in a real repo, Haiku 4.5, ${s.n} runs per arm${s.allPassed ? ', every run fixed it' : ''}; Chisle 3.14 is ${s.vsPrev}% cheaper than 3.13`,
    aria: (s) => `Cost per fix on a real agent task, fixing a failing npm test, as percent of the same agent with no ruleset. Chisle 3.14 is ${s.vsPrev}% cheaper than 3.13.` },
];

function main() {
  const stats = CHARTS.map((c) => c.collect());
  if (process.argv.includes('--json')) { console.log(JSON.stringify(stats, null, 2)); return; }
  const check = process.argv.includes('--check');
  for (const [ci, spec] of CHARTS.entries()) for (const th0 of THEMES) {
    const stat = stats[ci];
    const th = { ...th0, out: th0.out.replace(/benchmark(-light)?\.svg$/, (m, l) => `benchmark${spec.suffix}${l || ''}.svg`) };
    const svg = buildSvg(stat, th, spec);
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
    console.log(`wrote ${path.relative(ROOT, th.out)}: ` + spec.arms.map((a) => `${a.label} ${stat[a.key]}%`).join(', '));
  }
  if (check) console.log('chart in sync.');
}

main();
