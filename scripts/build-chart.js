#!/usr/bin/env node
// Generates assets/benchmark.svg from REAL measured results — the headline
// chart: each tool's TOTAL billed output across every 4-arm task, as % of the
// no-tool baseline (what the combined bill actually was), with each tool's
// worst single day and backfire count as a badge. Lower bar = cheaper.
//
// Source: the committed raw model outputs under benchmarks/results/raw*/
// (produced by run-live.sh). Data-driven + CI-checkable: same cells in →
// same chart out.
//
// Run:  node scripts/build-chart.js          (write svg)
//       node scripts/build-chart.js --check   (fail if stale; for CI)
//       node scripts/build-chart.js --json

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_DIRS = [
  path.join(ROOT, 'benchmarks', 'results', 'raw'),
  path.join(ROOT, 'benchmarks', 'results', 'raw-sonnet'),
  path.join(ROOT, 'benchmarks', 'results', 'raw-verify'),
];
const SVG_OUT = path.join(ROOT, 'assets', 'benchmark.svg');
const TASK_SVG_OUT = path.join(ROOT, 'assets', 'per-task.svg');
const SIZE_SVG_OUT = path.join(ROOT, 'assets', 'by-size.svg');
const KIND_SVG_OUT = path.join(ROOT, 'assets', 'by-kind.svg');
// Per-task chart uses the June suite alone: it is the one run where all four
// arms answered the same six prompts, so the bars are directly comparable.
const TASK_DIR = path.join(ROOT, 'benchmarks', 'results', 'raw');
const { KIND } = require('../benchmarks/aggregate');
// Short labels for the per-task chart; kinds themselves come from KIND.
const KIND_LABEL = { coding: 'code', noncoding: 'prose' };

// Our own arm. The key is the token in the committed raw filenames
// (raw*/<task>__rdxmin.json) and predates the RDXmin -> Chisle rename, so it
// stays put; only the display label follows the new name. Renaming the key
// silently orphans all 20 result cells and zeroes our bar — reference it
// through this constant so the two can never drift apart again.
const SELF = 'rdxmin';
const ARMS = [
  { key: 'caveman',  label: 'caveman', color: '#d9822b' },
  { key: 'ponytail', label: 'ponytail', color: '#cf3b3b' },
  { key: SELF,       label: 'Chisle',  color: '#2da44e' },
];

function tok(file) {
  try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); return d.is_error ? null : d.usage.output_tokens; }
  catch (_) { return null; }
}

// Collect per-(dir,task) baseline and compute each arm's worst % + backfire count.
function collect() {
  const cells = {}; // `${dir}|${task}|${arm}` -> tokens
  for (const dir of RAW_DIRS) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (_) { continue; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const m = f.slice(0, -5).match(/^(.+)__([a-z]+)$/);
      if (!m) continue;
      cells[`${dir}|${m[1]}|${m[2]}`] = tok(path.join(dir, f));
    }
  }
  const tasks = new Set();
  for (const k of Object.keys(cells)) {
    const [dir, task, arm] = k.split('|');
    if (arm === 'vanilla' && cells[k]) tasks.add(`${dir}|${task}`);
  }
  const stat = {};
  for (const a of ARMS) stat[a.key] = { worst: 0, over: 0, n: 0, sum: 0, base: 0 };
  for (const dt of tasks) {
    const [dir, task] = dt.split('|');
    const base = cells[`${dir}|${task}|vanilla`];
    for (const a of ARMS) {
      const v = cells[`${dir}|${task}|${a.key}`];
      if (!v) continue;
      const pct = Math.round((v / base) * 100);
      stat[a.key].n++;
      stat[a.key].sum += v;
      stat[a.key].base += base;
      if (pct > stat[a.key].worst) stat[a.key].worst = pct;
      if (pct > 100) stat[a.key].over++;
    }
  }
  for (const a of ARMS) {
    const s = stat[a.key];
    s.total = s.base ? Math.round((s.sum / s.base) * 100) : 0;
  }
  return { stat, taskCount: tasks.size };
}

function buildSvg(stat, taskCount) {
  const W = 860, H = 340;
  const left = 150, top = 96, rowH = 64, plotW = 620;
  const maxPct = 120;                 // total-bill bars live under 100%
  const px = plotW / maxPct;          // px per percent
  const line100 = left + 100 * px;    // the "no tool" baseline

  let body = `<line x1="${line100}" y1="${top - 16}" x2="${line100}" y2="${top + ARMS.length * rowH - 8}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  body += `<text x="${line100}" y="${top - 22}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no tool</text>`;

  ARMS.forEach((a, i) => {
    const s = stat[a.key];
    const y = top + i * rowH;
    const w = Math.max(2, s.total * px);
    const bold = a.key === SELF ? ' font-weight="700"' : '';
    const badge = s.over === 0
      ? `worst day ${s.worst}% · never backfired`
      : `worst day ${s.worst}% · backfired ${s.over}/${taskCount} tasks`;
    body += `<text x="${left - 12}" y="${y + 21}" font-size="14" fill="#c9d1d9" text-anchor="end"${bold}>${a.label}</text>` +
            `<rect x="${left}" y="${y + 4}" width="${w}" height="30" rx="4" fill="${a.color}"/>` +
            `<text x="${left + w + 9}" y="${y + 18}" font-size="14" fill="#c9d1d9"${bold}>${s.total}% of the bill</text>` +
            `<text x="${left + w + 9}" y="${y + 32}" font-size="10.5" fill="#8b949e">${badge}</text>`;
  });

  // Only claim the fix when the data shows exactly the one backfire it fixed.
  const fixNote = stat[SELF].over === 1
    ? `<text x="${W / 2}" y="${H - 14}" font-size="11" fill="#8b949e" text-anchor="middle">Chisle's single backfire was root-caused, the rule fixed, and re-validated live at 93% — benchmarks/results/2026-07-07-verify-rerun.md</text>`
    : '';

  const aria = `Total billed output across ${taskCount} tasks as percent of the no-tool baseline. ` +
    ARMS.map(a => `${a.label} ${stat[a.key].total}% (worst day ${stat[a.key].worst}%, backfired ${stat[a.key].over})`).join(', ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">The ${taskCount}-task bill — % of a bare model (lower = cheaper)</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="#8b949e" text-anchor="middle">total billed output vs using no tool at all (Haiku + Sonnet, two suites; code, prose &amp; judgment prompts)</text>
${body}${fixNote}</svg>
`;
}

// Every task cell across all suites, with each arm as a % of that task's own
// vanilla baseline. Baseline size doubles as the "how big an answer did this
// prompt want" axis.
function collectAllCells() {
  const cells = {};
  for (const dir of RAW_DIRS) {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (_) { continue; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const m = f.slice(0, -5).match(/^(.+)__([a-z]+)$/);
      if (m) (cells[`${dir}|${m[1]}`] ||= {})[m[2]] = tok(path.join(dir, f));
    }
  }
  const rows = [];
  for (const key of Object.keys(cells)) {
    const c = cells[key];
    const base = c.vanilla;
    if (!base) continue;
    const row = { task: key.split('|')[1], base, tok: {} };
    if (ARMS.every(a => c[a.key])) {
      for (const a of ARMS) {
        row.tok[a.key] = c[a.key];              // raw tokens: exact aggregation
        row[a.key] = Math.round((c[a.key] / base) * 100);  // display only
      }
      rows.push(row);
    }
  }
  return rows.sort((x, y) => x.base - y.base);
}

// Total bill for a group = sum(arm tokens) / sum(baseline tokens), so big
// tasks carry the weight they actually carry on a real bill.
// Aggregate from RAW tokens, never from the per-row percentages: rounding each
// row first and summing those drifts a point against the same figure computed
// honestly, which is exactly how a chart ends up contradicting its own README.
function groupBill(group, key) {
  const base = group.reduce((s, r) => s + r.base, 0);
  const arm = group.reduce((s, r) => s + r.tok[key], 0);
  return base ? Math.round((arm / base) * 100) : 0;
}

function buildSizeSvg(rows) {
  const mid = Math.floor(rows.length / 2);
  const groups = [
    { label: 'short answers', rows: rows.slice(0, mid) },
    { label: 'long answers', rows: rows.slice(mid) },
  ];
  const W = 860, left = 168, top = 104, barH = 20, gap = 6, plotW = 560;
  const maxPct = 130, px = plotW / maxPct, line100 = left + 100 * px;
  const blockH = ARMS.length * (barH + gap) + 42;
  const H = top + groups.length * blockH + 26;

  let body = `<line x1="${line100}" y1="${top - 16}" x2="${line100}" y2="${top + groups.length * blockH - 30}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 22}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no tool</text>`;

  groups.forEach((g, gi) => {
    const gy = top + gi * blockH;
    const lo = g.rows[0].base, hi = g.rows[g.rows.length - 1].base;
    body += `<text x="${left - 14}" y="${gy + 4}" font-size="13" font-weight="700" fill="#c9d1d9" text-anchor="end">${g.label}</text>` +
            `<text x="${left - 14}" y="${gy + 19}" font-size="10" fill="#8b949e" text-anchor="end">${lo}–${hi} tok · n=${g.rows.length}</text>`;
    ARMS.forEach((a, i) => {
      const pct = groupBill(g.rows, a.key);
      const y = gy + i * (barH + gap);
      const w = Math.max(2, pct * px);
      const bold = a.key === SELF ? ' font-weight="700"' : '';
      body += `<rect x="${left}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${a.color}"/>` +
              `<text x="${left + w + 8}" y="${y + 14}" font-size="12" fill="#c9d1d9"${bold}>${pct}%  ${a.label}</text>`;
    });
  });

  const small = groups[0].rows, large = groups[1].rows;
  const sub = `Chisle ${groupBill(small, SELF)}% on short answers vs ${groupBill(large, SELF)}% on long ones — the headline average hides both`;
  const aria = `Total billed output by answer size. ` + groups.map(g =>
    `${g.label}: ` + ARMS.map(a => `${a.label} ${groupBill(g.rows, a.key)}%`).join(', ')).join('; ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">Does it pay off more on bigger answers?</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="#8b949e" text-anchor="middle">${rows.length} tasks split at the median baseline; bill weighted by task size</text>
<text x="${W / 2}" y="72" font-size="11" fill="#8b949e" text-anchor="middle">${sub}</text>
${body}</svg>
`;
}

// Kind x size. Coding prompts average ~3x the baseline of explanation prompts,
// so the two axes are confounded; crossing them is the only way to see which is
// doing the work. Cells are small (n=3..7) and the chart says so.
function buildKindSvg(rows) {
  const mid = Math.floor(rows.length / 2);
  const median = rows[mid].base;
  const pick = (kind, size) => rows.filter(r =>
    (KIND[r.task] === kind) && (size === 'short' ? r.base < median : r.base >= median));
  const groups = [
    { label: 'code · short', rows: pick('coding', 'short') },
    { label: 'code · long', rows: pick('coding', 'long') },
    { label: 'explain · short', rows: pick('noncoding', 'short') },
    { label: 'explain · long', rows: pick('noncoding', 'long') },
  ].filter(g => g.rows.length);

  const W = 860, left = 150, barH = 15, gap = 4, plotW = 560, top = 96;
  const maxPct = 130, px = plotW / maxPct, line100 = left + 100 * px;
  const blockH = ARMS.length * (barH + gap) + 26;
  const H = top + groups.length * blockH + 18;

  let body = `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + groups.length * blockH - 22}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no tool</text>`;

  groups.forEach((g, gi) => {
    const gy = top + gi * blockH;
    body += `<text x="${left - 12}" y="${gy + 6}" font-size="12.5" font-weight="700" fill="#c9d1d9" text-anchor="end">${g.label}</text>` +
            `<text x="${left - 12}" y="${gy + 20}" font-size="9.5" fill="#8b949e" text-anchor="end">n=${g.rows.length}</text>`;
    const best = Math.min(...ARMS.map(a => groupBill(g.rows, a.key)));
    ARMS.forEach((a, i) => {
      const pct = groupBill(g.rows, a.key);
      const y = gy + i * (barH + gap);
      const w = Math.max(2, pct * px);
      const win = pct === best ? ' font-weight="700"' : '';
      body += `<rect x="${left}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${a.color}"/>` +
              `<text x="${left + w + 7}" y="${y + 11.5}" font-size="11" fill="#c9d1d9"${win}>${pct}%  ${a.label}</text>`;
    });
  });

  const aria = 'Billed output by task kind crossed with answer size. ' + groups.map(g =>
    `${g.label}: ` + ARMS.map(a => `${a.label} ${groupBill(g.rows, a.key)}%`).join(', ')).join('; ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="34" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">Code vs explanation, short vs long</text>
<text x="${W / 2}" y="54" font-size="11.5" fill="#8b949e" text-anchor="middle">bold = leanest in that cell; split at the median baseline (${median} tok)</text>
<text x="${W / 2}" y="72" font-size="11" fill="#8b949e" text-anchor="middle">small cells — directional, not a leaderboard</text>
${body}</svg>
`;
}

// Per-task bars: each arm's billed output as % of that task's vanilla run.
function collectPerTask() {
  let files = [];
  try { files = fs.readdirSync(TASK_DIR); } catch (_) { return []; }
  const cells = {};
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const m = f.slice(0, -5).match(/^(.+)__([a-z]+)$/);
    if (m) (cells[m[1]] ||= {})[m[2]] = tok(path.join(TASK_DIR, f));
  }
  return Object.keys(cells).sort().map(task => {
    const base = cells[task].vanilla;
    if (!base) return null;
    return {
      task,
      kind: KIND_LABEL[KIND[task]] || 'other',
      arms: ARMS.map(a => ({
        ...a,
        pct: cells[task][a.key] ? Math.round((cells[task][a.key] / base) * 100) : null,
      })),
    };
  }).filter(Boolean);
}

function buildTaskSvg(rows) {
  const W = 860, left = 132, top = 92, groupH = 62, barH = 15, plotW = 600;
  const maxPct = 140, px = plotW / maxPct, line100 = left + 100 * px;
  const H = top + rows.length * groupH + 44;

  let body = `<line x1="${line100}" y1="${top - 14}" x2="${line100}" y2="${top + rows.length * groupH - 12}" stroke="#8b949e" stroke-width="1.5" stroke-dasharray="4 3"/>` +
    `<text x="${line100}" y="${top - 20}" font-size="11" fill="#8b949e" text-anchor="middle">100% = no tool</text>`;

  rows.forEach((r, i) => {
    const gy = top + i * groupH;
    body += `<text x="${left - 12}" y="${gy + 14}" font-size="12.5" fill="#c9d1d9" text-anchor="end">${r.task}</text>` +
            `<text x="${left - 12}" y="${gy + 28}" font-size="9.5" fill="#8b949e" text-anchor="end">${r.kind}</text>`;
    r.arms.forEach((a, j) => {
      if (a.pct == null) return;
      const y = gy + j * (barH + 2);
      const w = Math.max(2, a.pct * px);
      const win = a.key === SELF ? ' font-weight="700"' : '';
      body += `<rect x="${left}" y="${y}" width="${w}" height="${barH}" rx="3" fill="${a.color}"/>` +
              `<text x="${left + w + 7}" y="${y + 11.5}" font-size="10.5" fill="#c9d1d9"${win}>${a.pct}%</text>`;
    });
  });

  const legend = ARMS.map((a, i) =>
    `<rect x="${left + i * 132}" y="${H - 26}" width="10" height="10" rx="2" fill="${a.color}"/>` +
    `<text x="${left + i * 132 + 15}" y="${H - 17}" font-size="11" fill="#8b949e">${a.label}</text>`).join('');

  const wins = rows.filter(r => {
    const self = r.arms.find(a => a.key === SELF);
    return self && r.arms.every(a => a.pct == null || a.key === SELF || self.pct <= a.pct);
  }).length;

  const aria = `Billed output per task as percent of the no-tool baseline, June suite. ` +
    rows.map(r => `${r.task}: ` + r.arms.map(a => `${a.label} ${a.pct}%`).join(', ')).join('; ') + '.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${aria}">
<rect width="${W}" height="${H}" rx="10" fill="#0d1117"/>
<text x="${W / 2}" y="32" font-size="17" font-weight="700" fill="#c9d1d9" text-anchor="middle">Task by task — % of a bare model (lower = cheaper)</text>
<text x="${W / 2}" y="52" font-size="11.5" fill="#8b949e" text-anchor="middle">June suite, Haiku, same six prompts to every arm — Chisle leanest on ${wins} of ${rows.length}</text>
${body}${legend}</svg>
`;
}

function main() {
  const { stat, taskCount } = collect();
  const taskRows = collectPerTask();
  const sizeRows = collectAllCells();
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ stat, taskCount, taskRows, sizeRows }, null, 2)); return; }

  const outputs = [
    [SVG_OUT, buildSvg(stat, taskCount)],
    [TASK_SVG_OUT, buildTaskSvg(taskRows)],
    [SIZE_SVG_OUT, buildSizeSvg(sizeRows)],
    [KIND_SVG_OUT, buildKindSvg(sizeRows)],
  ];

  if (process.argv.includes('--check')) {
    for (const [file, svg] of outputs) {
      let have = '';
      try { have = fs.readFileSync(file, 'utf8'); } catch (_) {}
      if (have !== svg) {
        console.error(`assets/${path.basename(file)} is stale. Run: node scripts/build-chart.js`);
        process.exit(1);
      }
    }
    console.log('charts in sync.'); return;
  }

  for (const [file, svg] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, svg);
    console.log(`wrote ${path.relative(ROOT, file)}`);
  }
  console.log(`worst case: ` +
    ARMS.map(a => `${a.label} ${stat[a.key].worst}%`).join(', ') + ` over ${taskCount} tasks`);
}

main();
