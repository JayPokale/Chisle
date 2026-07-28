#!/usr/bin/env node
// Aggregates benchmarks/results/raw/*.json (produced by run-live.sh) into a
// real measured comparison table across the four arms.
//
// Metrics per cell:
//   out_tokens  — model usage.output_tokens (the real generation cost)
//   answer_tok  — visible answer size, chars/4 (what the user reads)
//   lines       — answer line count (coding bloat proxy)
//
// Run:  node benchmarks/aggregate.js           (markdown table to stdout)
//       node benchmarks/aggregate.js --json
//       RAW_DIR=path node benchmarks/aggregate.js   (aggregate a fresh run)

const fs = require('fs');
const path = require('path');

const RAW = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : path.join(__dirname, 'results', 'raw');
const ARMS = ['vanilla', 'caveman', 'ponytail', 'rdxmin'];  // 'rdxmin' = chisle; historical key, matches committed raw filenames
// Task kinds. "coding" = the prompt wants working code back; "noncoding" = it
// wants an explanation. Classified from what the prompt asks for, not from
// whether the answer happens to contain a fenced block.
//
// palindrome is the one genuine borderline: it asks for a one-liner, so it is
// filed as coding here, while the Sonnet writeup groups it with the small
// prose prompts. Flipping it moves the coding/non-coding totals by ~1pt and
// changes no conclusion — see the sensitivity note in the README.
const KIND = {
  debounce: 'coding', cache: 'coding', 'auth-bug': 'coding',
  pooling: 'noncoding', 'rest-graphql': 'noncoding', 'regex-concept': 'noncoding',
  // Sonnet suite
  thread: 'coding', retry: 'coding', mixed: 'coding', signup: 'coding',
  ratelimit: 'coding', caching: 'coding', palindrome: 'coding',
  deadlock: 'noncoding', letconst: 'noncoding',
};

const estTok = (s) => Math.round((s || '').replace(/\s+/g, ' ').trim().length / 4);

function load() {
  if (!fs.existsSync(RAW)) return [];
  const cells = [];
  for (const f of fs.readdirSync(RAW)) {
    const m = f.match(/^(.+)__(\w+)\.json$/);
    if (!m) continue;
    const [, task, arm] = m;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')); } catch (_) { continue; }
    if (!d || d.is_error) continue;
    const result = d.result || '';
    cells.push({
      task, arm, kind: KIND[task] || 'other',
      out: d.usage ? d.usage.output_tokens : 0,
      ans: estTok(result),
      lines: result.trim() ? result.trim().split('\n').length : 0,
    });
  }
  return cells;
}

function pct(base, v) { return base ? Math.round((v / base) * 100) : 0; }

function main() {
  const cells = load();
  if (!cells.length) { console.error('no raw results yet — run: bash benchmarks/run-live.sh'); process.exit(1); }

  // Index: cells[task][arm]
  const byTask = {};
  for (const c of cells) (byTask[c.task] ||= {})[c.arm] = c;

  // Per-arm aggregates by metric (out=billed tokens, ans=visible answer tokens,
  // lines=answer lines), split by kind + overall.
  const sum = {};
  for (const arm of ARMS) sum[arm] = {
    coding: { out: 0, ans: 0, lines: 0, n: 0 },
    noncoding: { out: 0, ans: 0, lines: 0, n: 0 },
    all: { out: 0, ans: 0, lines: 0, n: 0 },
  };
  for (const c of cells) {
    if (!sum[c.arm]) continue;
    for (const seg of [c.kind, 'all']) {
      sum[c.arm][seg].out += c.out; sum[c.arm][seg].ans += c.ans;
      sum[c.arm][seg].lines += c.lines; sum[c.arm][seg].n++;
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ cells, sum }, null, 2));
    return;
  }

  const tasks = Object.keys(byTask).sort((a, b) => (KIND[a] || '').localeCompare(KIND[b] || '') || a.localeCompare(b));

  console.log('## Per-task billed output tokens (usage.output_tokens — includes model reasoning)\n');
  console.log('| task | kind | vanilla | caveman | ponytail | rdxmin |');
  console.log('|------|------|--------:|--------:|---------:|---------:|');
  for (const t of tasks) {
    const row = ARMS.map(a => byTask[t][a] ? String(byTask[t][a].out) : '—');
    console.log(`| ${t} | ${KIND[t]} | ${row.join(' | ')} |`);
  }

  console.log('\n## Per-task visible answer size (lines of the delivered answer)\n');
  console.log('| task | kind | vanilla | caveman | ponytail | rdxmin |');
  console.log('|------|------|--------:|--------:|---------:|---------:|');
  for (const t of tasks) {
    const row = ARMS.map(a => byTask[t][a] ? String(byTask[t][a].lines) : '—');
    console.log(`| ${t} | ${KIND[t]} | ${row.join(' | ')} |`);
  }

  for (const [metric, label] of [['out', 'billed output tokens'], ['ans', 'visible answer tokens'], ['lines', 'answer lines']]) {
    console.log(`\n## ${label} as % of vanilla baseline (lower = leaner)\n`);
    console.log('| segment | vanilla | caveman | ponytail | rdxmin |');
    console.log('|---------|--------:|--------:|---------:|---------:|');
    for (const seg of ['coding', 'noncoding', 'all']) {
      const base = sum.vanilla[seg][metric];
      const row = ARMS.map(a => `${pct(base, sum[a][seg][metric])}%`);
      console.log(`| ${seg} | ${row.join(' | ')} |`);
    }
  }

  console.log('\n## Raw totals (billed tokens / answer lines, n cells)\n');
  console.log('| segment | vanilla | caveman | ponytail | rdxmin |');
  console.log('|---------|--------:|--------:|---------:|---------:|');
  for (const seg of ['coding', 'noncoding', 'all']) {
    const row = ARMS.map(a => `${sum[a][seg].out}t/${sum[a][seg].lines}L (n=${sum[a][seg].n})`);
    console.log(`| ${seg} | ${row.join(' | ')} |`);
  }
}

main();
