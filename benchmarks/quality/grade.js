#!/usr/bin/env node
// Grades benchmarks/quality/raw/*.json.
//
//   math -> the required "ANSWER:" line must match the key exactly, after
//           stripping $ , % and trailing zeros. No partial credit, no judge.
//   code -> the single fenced JS block is extracted, the exported function is
//           called against unit tests the model never saw. All cases must pass.
//
// Reports accuracy per arm with a paired-item breakdown, plus output tokens, so
// cost and correctness are read off the same run.
//
// Usage: node benchmarks/quality/grade.js [--json]

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { fisher, wilson, fmtP } = require('../stats.js');

const HERE = __dirname;
const RAW = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : path.join(HERE, 'raw');
const ARMS = ['vanilla', 'chisle'];
const math = JSON.parse(fs.readFileSync(path.join(HERE, 'math.json'), 'utf8'));
const code = JSON.parse(fs.readFileSync(path.join(HERE, 'code.json'), 'utf8'));
const mathById = Object.fromEntries(math.map((m) => [m.id, m]));
const codeById = Object.fromEntries(code.map((c) => [c.id, c]));

// --- graders ---------------------------------------------------------------

// Grade the VALUE, not the formatting: strip currency/percent marks, thousands
// separators and a trailing unit ("2 km/h" -> "2"), then normalise 3.60 -> 3.6.
// Whether the arm obeyed the exact output format is tracked separately below,
// because "wrote the unit anyway" is a compliance miss, not a wrong answer.
const normNum = (s) => {
  let t = String(s).trim()
    .replace(/^\**|\**$/g, '')
    .replace(/^[$\u20ac\u00a3]/, '')
    .replace(/^\+/, '')
    .replace(/[,\s]/g, '');
  const m = t.match(/^-?\d+\/\d+/) || t.match(/^-?\d*\.?\d+/);
  if (!m) return t.toLowerCase();
  t = m[0];
  if (/^-?\d+\.\d+$/.test(t)) t = String(parseFloat(t));
  else if (/^-?\d+$/.test(t)) t = String(parseInt(t, 10));
  return t;
};

// Exact-format compliance: the reply ends with an ANSWER line carrying the bare
// value and nothing else (no unit, no trailing prose).
const isClean = (raw, want) => {
  const t = String(raw).trim().replace(/^\**|\**$/g, '');
  return t === String(want).trim() || t === '+' + String(want).trim();
};

function gradeMath(item, answer) {
  const lines = String(answer).trim().split('\n');
  const line = [...lines].reverse().find((l) => /ANSWER\s*:/i.test(l));
  if (!line) return { pass: false, clean: false, why: 'no ANSWER line' };
  const raw = line.replace(/.*ANSWER\s*:/i, '');
  const got = normNum(raw);
  const want = normNum(item.answer);
  return {
    pass: got === want,
    clean: isClean(raw, item.answer),
    why: got === want ? '' : `got ${got} want ${want}  [raw: ${raw.trim().slice(0, 40)}]`,
  };
}

function extractBlock(answer) {
  const blocks = [...String(answer).matchAll(/```(?:js|javascript|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  return blocks.length ? blocks.join('\n\n') : null;
}

function gradeCode(item, answer) {
  const src = extractBlock(answer);
  if (!src) return { pass: false, why: 'no code block' };
  // Normalise ESM exports away; the harness calls the function by name.
  const cleaned = src
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+(?=(function|const|let|var|class)\b)/gm, '')
    .replace(/^\s*module\.exports.*$/gm, '')
    .replace(/^\s*import\s.*$/gm, '');
  const ctx = { module: { exports: {} }, exports: {}, console: { log() {} }, require: () => { throw new Error('no deps allowed'); } };
  vm.createContext(ctx);
  try {
    vm.runInContext(cleaned + `\n;globalThis.__fn = typeof ${item.fn} === 'function' ? ${item.fn} : undefined;`, ctx, { timeout: 3000 });
  } catch (e) { return { pass: false, why: 'eval: ' + e.message }; }
  const fn = ctx.__fn;
  if (typeof fn !== 'function') return { pass: false, why: `no function ${item.fn}` };
  for (const [args, want] of item.cases) {
    let got;
    try { got = vm.runInContext('__fn', ctx).apply(null, JSON.parse(JSON.stringify(args))); }
    catch (e) { return { pass: false, why: `threw on ${JSON.stringify(args)}: ${e.message}` }; }
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      return { pass: false, why: `${JSON.stringify(args)} -> ${JSON.stringify(got)} want ${JSON.stringify(want)}` };
    }
  }
  return { pass: true, why: '' };
}

// --- load + grade ----------------------------------------------------------

function load() {
  if (!fs.existsSync(RAW)) return [];
  const rows = [];
  for (const f of fs.readdirSync(RAW)) {
    const m = f.match(/^(math|code)__(.+)__(vanilla|chisle)__(\d+)\.json$/);
    if (!m) continue;
    const [, suite, id, arm, seed] = m;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); } catch (_) { continue; }
    if (!d || d.is_error) continue;
    const answer = d.result || '';
    const item = suite === 'math' ? mathById[id] : codeById[id];
    if (!item) continue;
    const g = suite === 'math' ? gradeMath(item, answer) : gradeCode(item, answer);
    rows.push({
      suite, id, arm, seed: Number(seed), tier: item.tier || 'base',
      pass: g.pass, clean: g.clean !== false, why: g.why,
      out: d.usage ? d.usage.output_tokens : 0,
      chars: answer.trim().length,
    });
  }
  return rows;
}

const pct = (n, d) => (d ? (100 * n / d).toFixed(1) + '%' : '—');

function main() {
  const all = load();
  const have = new Set(all.map((r) => `${r.suite}|${r.id}|${r.seed}|${r.arm}`));
  const rows = all.filter((r) => have.has(`${r.suite}|${r.id}|${r.seed}|vanilla`) && have.has(`${r.suite}|${r.id}|${r.seed}|chisle`));
  const dropped = all.length - rows.length;
  if (!rows.length) { console.error('no graded cells — run: node benchmarks/quality/run.js'); process.exit(1); }

  const agg = {};
  for (const r of rows) {
    for (const seg of [`${r.suite} ${r.tier}`, 'all']) {
      const k = seg + '|' + r.arm;
      (agg[k] ||= { n: 0, pass: 0, clean: 0, out: 0, chars: 0 });
      agg[k].n++; agg[k].pass += r.pass ? 1 : 0; agg[k].clean += r.clean ? 1 : 0; agg[k].out += r.out; agg[k].chars += r.chars;
    }
  }

  if (process.argv.includes('--json')) { console.log(JSON.stringify({ rows, agg }, null, 2)); return; }

  console.log('## Accuracy (auto-graded, no judge model)\n');
  if (dropped) console.log(`_${dropped} cell(s) excluded: no counterpart in the other arm._\n`);
  console.log('| suite | arm | n | correct | accuracy | format-clean | mean output tokens | mean answer chars |');
  console.log('|-------|-----|--:|--------:|---------:|-------------:|-------------------:|------------------:|');
  const segs = [...new Set(rows.map((r) => `${r.suite} ${r.tier}`))].sort().concat('all');
  for (const seg of segs) {
    for (const arm of ARMS) {
      const a = agg[seg + '|' + arm];
      if (!a) continue;
      console.log(`| ${seg} | ${arm} | ${a.n} | ${a.pass} | ${pct(a.pass, a.n)} | ${pct(a.clean, a.n)} | ${Math.round(a.out / a.n)} | ${Math.round(a.chars / a.n)} |`);
    }
  }

  // Overall significance, stated whether or not it flatters the tool.
  {
    const v = agg['all|vanilla'], h = agg['all|chisle'];
    if (v && h) {
      const ci = (k, n) => wilson(k, n).map((x) => (100 * x).toFixed(1) + '%').join('–');
      const p = fisher(h.pass, h.n - h.pass, v.pass, v.n - v.pass);
      console.log('\n## Significance\n');
      console.log(`vanilla ${v.pass}/${v.n}, 95% CI ${ci(v.pass, v.n)}`);
      console.log(`chisle  ${h.pass}/${h.n}, 95% CI ${ci(h.pass, h.n)}`);
      console.log(`Fisher exact, two-sided: p = ${fmtP(p)}` + (p < 0.05 ? '' : ' — not separable from noise at this cell count.'));
    }
  }

  // Per-item, paired: where do the arms actually differ?
  const byItem = {};
  for (const r of rows) {
    const k = r.suite + '/' + r.id;
    (byItem[k] ||= { vanilla: [], chisle: [] })[r.arm].push(r);
  }
  const diffs = [];
  for (const [k, v] of Object.entries(byItem)) {
    const van = v.vanilla.filter((r) => r.pass).length, vn = v.vanilla.length;
    const chi = v.chisle.filter((r) => r.pass).length, cn = v.chisle.length;
    if (!vn || !cn) continue;
    const d = (chi / cn) - (van / vn);
    if (d !== 0) diffs.push({ k, van: `${van}/${vn}`, chi: `${chi}/${cn}`, d });
  }
  diffs.sort((a, b) => a.d - b.d);
  console.log('\n## Items where the arms disagree (negative = Chisle worse)\n');
  if (!diffs.length) console.log('_None — every item scored identically in both arms._');
  else {
    console.log('| item | vanilla | chisle |');
    console.log('|------|--------:|-------:|');
    for (const d of diffs) console.log(`| ${d.k} | ${d.van} | ${d.chi} |`);
  }

  // Every failure, so the losses are auditable rather than summarised away.
  const fails = rows.filter((r) => !r.pass).sort((a, b) => a.arm.localeCompare(b.arm) || a.suite.localeCompare(b.suite) || a.id.localeCompare(b.id));
  console.log('\n## Every failed cell\n');
  if (!fails.length) console.log('_None._');
  else {
    console.log('| arm | suite | item | seed | why |');
    console.log('|-----|-------|------|-----:|-----|');
    for (const f of fails) console.log(`| ${f.arm} | ${f.suite} | ${f.id} | ${f.seed} | ${f.why.replace(/\|/g, '\\|').slice(0, 110)} |`);
  }
}

if (require.main === module) main();
