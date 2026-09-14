#!/usr/bin/env node
// Scores benchmarks/agentic/raw/*.json into a correctness-first table.
//
// pass       -- the hidden test the agent never saw
// files      -- new files created (YAGNI / "fewest files possible")
// loc        -- net lines added to the repo (shortest working diff)
// deps       -- dependencies added to package.json (ladder rung 5)
// tokens     -- billed output + total context read (the cost side)
//
// Usage: node benchmarks/agentic/score.js [--json]

const fs = require('fs');
const path = require('path');
const { fisher, wilson, fmtP } = require('../stats.js');

const RAW = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : path.join(__dirname, 'raw');
const ARMS = ['vanilla', 'chisle'];

const rows = [];
for (const f of fs.existsSync(RAW) ? fs.readdirSync(RAW) : []) {
  if (!f.endsWith('.json')) continue;
  try { rows.push(JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'))); } catch (_) {}
}
if (!rows.length) { console.error('no results — run: node benchmarks/agentic/run.js'); process.exit(1); }

if (process.argv.includes('--json')) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

// Only compare (fixture, seed) pairs that completed in BOTH arms. A run cut
// short mid-suite otherwise leaves the arms with different seed sets, and the
// comparison silently stops being like-for-like.
const all = rows.filter((r) => !r.error);
const have = new Set(all.map((r) => `${r.fixture}|${r.seed}|${r.arm}`));
const ok = all.filter((r) => have.has(`${r.fixture}|${r.seed}|vanilla`) && have.has(`${r.fixture}|${r.seed}|chisle`));
const dropped = all.length - ok.length;
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (n, d = 0) => Number(n).toFixed(d);

const fixtures = [...new Set(ok.map((r) => r.fixture))].sort();

console.log('## Hidden-test pass rate by fixture\n');
console.log('| fixture | vanilla | chisle | Fisher p |');
console.log('|---------|--------:|-------:|---------:|');
for (const fx of fixtures) {
  const arm = (a) => ok.filter((r) => r.fixture === fx && r.arm === a);
  const v = arm('vanilla'), h = arm('chisle');
  const cell = (c) => (c.length ? `${c.filter((r) => r.pass).length}/${c.length}` : '—');
  const p = (v.length && h.length)
    ? fmtP(fisher(h.filter((r) => r.pass).length, h.length - h.filter((r) => r.pass).length,
                  v.filter((r) => r.pass).length, v.length - v.filter((r) => r.pass).length))
    : '—';
  console.log(`| ${fx} | ${cell(v)} | ${cell(h)} | ${p} |`);
}

console.log('\n## Overall\n');
console.log('| arm | n | passed | pass rate | new files | net LOC | deps added | out tokens | context tokens | $ / run |');
console.log('|-----|--:|-------:|----------:|----------:|--------:|-----------:|-----------:|---------------:|--------:|');
for (const arm of ARMS) {
  const c = ok.filter((r) => r.arm === arm);
  if (!c.length) continue;
  console.log(`| ${arm} | ${c.length} | ${c.filter((r) => r.pass).length} | ${fmt(100 * c.filter((r) => r.pass).length / c.length, 1)}% | `
    + `${fmt(mean(c.map((r) => (r.files_created || []).length)), 2)} | ${fmt(mean(c.map((r) => r.loc_delta || 0)), 1)} | `
    + `${fmt(mean(c.map((r) => (r.deps_added || []).length)), 2)} | ${fmt(mean(c.map((r) => r.out_tokens || 0)))} | `
    + `${fmt(mean(c.map((r) => r.input_tokens || 0)))} | ${fmt(mean(c.map((r) => r.cost_usd || 0)), 4)} |`);
}

// Overall significance, stated whether or not it flatters the tool.
const V = ok.filter((r) => r.arm === 'vanilla'), H = ok.filter((r) => r.arm === 'chisle');
if (V.length && H.length) {
  const vp = V.filter((r) => r.pass).length, hp = H.filter((r) => r.pass).length;
  const ci = (k, n) => wilson(k, n).map((x) => (100 * x).toFixed(1) + '%').join('–');
  const p = fisher(hp, H.length - hp, vp, V.length - vp);
  console.log('\n## Significance\n');
  console.log(`vanilla ${vp}/${V.length}, 95% CI ${ci(vp, V.length)}`);
  console.log(`chisle  ${hp}/${H.length}, 95% CI ${ci(hp, H.length)}`);
  console.log(`Fisher exact, two-sided: p = ${fmtP(p)}` + (p < 0.05 ? '' : ' — not separable from noise at this cell count.'));
}

const fails = ok.filter((r) => !r.pass);
console.log('\n## Every failed cell\n');
if (!fails.length) console.log('_None._');
else {
  console.log('| arm | fixture | seed | first failing assertion |');
  console.log('|-----|---------|-----:|-------------------------|');
  for (const f of fails.sort((a, b) => a.arm.localeCompare(b.arm) || a.fixture.localeCompare(b.fixture))) {
    console.log(`| ${f.arm} | ${f.fixture} | ${f.seed} | ${(f.test_output || '').split('\n')[0].replace(/\|/g, '\\|').slice(0, 100)} |`);
  }
}

if (dropped) console.log(`\n_${dropped} cell(s) excluded: no counterpart in the other arm, so the seed sets stay matched._`);

const errs = rows.filter((r) => r.error);
if (errs.length) console.log(`\n_${errs.length} cell(s) errored and are excluded._`);
