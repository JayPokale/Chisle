// Pooled scorer behind the README tables: ratio of summed tokens vs vanilla
// across every cell in the given seed dirs, 95% bootstrap over cells, plus the
// same figures on rows where every arm delivered an answer (non-answers such as
// "which stack?" or "I need your code" are cheap and flatter any arm).
// Usage: ARMS=vanilla,caveman,ponytail,chisle node benchmarks/pooled.js <dir>...
//   e.g. node benchmarks/pooled.js benchmarks/results/raw-nov/*/
const fs = require('fs'), path = require('path');
const arms = (process.env.ARMS || 'vanilla,caveman,ponytail,chisle').split(',');
const coding = new Set(['debounce', 'cache', 'migration', 'statemachine', 'csvpipeline', 'authflow']);
const delivered = (task, r) => task === 'auth-bug' ? />=|<=/.test(r)
  : coding.has(task) ? /```|<parameter name="contents?">/.test(r)
  : r.length > 150 && !/^(I need|Need|Can you|What )/.test(r.trim());
const rows = [];
for (const d of process.argv.slice(2)) {
  const tasks = [...new Set(fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => f.split('__')[0]))];
  for (const t of tasks) {
    const row = { key: `${path.basename(d)}/${t}` };
    for (const a of arms) {
      let j; try { j = JSON.parse(fs.readFileSync(path.join(d, `${t}__${a}.json`), 'utf8')); } catch (_) { row.missing = true; continue; }
      const r = j.result || '', think = (Object.values(j.modelUsage || {})[0] || {}).thinkingTokens || 0;
      row[a] = { billed: j.usage.output_tokens, think, vis: j.usage.output_tokens - think, lines: r.trim().split('\n').length, ok: delivered(t, r) };
    }
    if (!row.missing) rows.push(row);
  }
}
const ratio = (set, a, k) => set.reduce((s, r) => s + r[a][k], 0) / set.reduce((s, r) => s + r.vanilla[k], 0);
const ci = (set, a, k, B = 5000) => { const xs = []; for (let i = 0; i < B; i++) { let s = 0, v = 0; for (let n = 0; n < set.length; n++) { const r = set[Math.random() * set.length | 0]; s += r[a][k]; v += r.vanilla[k]; } xs.push(s / v); } xs.sort((p, q) => p - q); return `${Math.round(100 * xs[B * 0.025 | 0])}–${Math.round(100 * xs[B * 0.975 | 0])}`; };
const pct = (x) => `${Math.round(100 * x)}%`;
for (const [label, set] of [['all cells', rows], ['every arm delivered', rows.filter((r) => arms.every((a) => r[a].ok))]]) {
  console.log(`\n${label} (n=${set.length})`);
  console.log('arm'.padEnd(9), 'answer len'.padStart(11), 'CI'.padStart(9), 'lines'.padStart(6), 'billed'.padStart(7), 'CI'.padStart(9), 'think'.padStart(6), 'backfires'.padStart(10));
  for (const a of arms.slice(1)) console.log(a.padEnd(9), pct(ratio(set, a, 'vis')).padStart(11), ci(set, a, 'vis').padStart(9), pct(ratio(set, a, 'lines')).padStart(6),
    pct(ratio(set, a, 'billed')).padStart(7), ci(set, a, 'billed').padStart(9), pct(ratio(set, a, 'think')).padStart(6), `${set.filter((r) => r[a].billed > r.vanilla.billed).length}/${set.length}`.padStart(10));
}
console.log('\nnon-answers: ' + arms.map((a) => `${a} ${rows.filter((r) => !r[a].ok).length}`).join(', '));
