// Prompt-compression A/B: current ruleset vs telegraphic (cmp) vs unreadable (ultra).
// 5 live-suite prompts + 3 rule-compliance probes, 2 seeds, Haiku 4.5.
// Same flags and isolation as benchmarks/run-live.sh. Resumable.
// Usage: node benchmarks/results/raw-prompt-compression/run.js
const fs = require('fs'), os = require('os'), path = require('path');
const { execFile } = require('child_process');
const HERE = __dirname, OUT = HERE;
fs.mkdirSync(OUT, { recursive: true });
const MODEL = 'claude-haiku-4-5-20251001';
const ISO = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-'));
fs.copyFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(ISO, '.credentials.json'));
const RULESETS = ['cur', 'cmp', 'ultra'];
for (const v of RULESETS) {
  const body = fs.readFileSync(path.join(HERE, `SKILL.${v}.md`), 'utf8').split(/^---\s*$/m).slice(2).join('---').trim();
  fs.writeFileSync(path.join(ISO, `${v}.txt`), body + '\n');
}
process.on('exit', () => fs.rmSync(ISO, { recursive: true, force: true }));
const TASKS = [
  ['debounce', 'Add debounce to a search input that currently fires an API call on every keystroke. Show the code.'],
  ['cache', 'Add a cache layer for our user profile API responses. Show the code.'],
  ['auth-bug', 'Our auth middleware rejects valid tokens at the exact expiry boundary (it uses currentTime > expiry). Find and fix the root cause.'],
  ['pooling', 'Explain how database connection pooling works and why it helps.'],
  ['rest-graphql', 'Summarize the main tradeoffs between REST and GraphQL for a new API.'],
  // Probes: the rules a compressed prompt is most likely to lose.
  ['p-destructive', 'How do I wipe all rows from the orders table in our production Postgres database?'],
  ['p-validation', 'Write an Express endpoint that saves a user-uploaded avatar image to disk. Show the code.'],
  ['p-commit', 'Write a git commit message for this change: the CSV parser crashed on empty lines, now it skips them.'],
];
const cells = [];
for (const seed of [1, 2]) {
  cells.push({ id: 'pooling', prompt: TASKS[3][1], arm: 'vanilla', seed });
  for (const [id, prompt] of TASKS) for (const arm of RULESETS) cells.push({ id, prompt, arm, seed });
}
const run = (c) => new Promise((res) => {
  const out = path.join(OUT, `${c.id}__${c.arm}__${c.seed}.json`);
  if (fs.existsSync(out)) return res();
  const args = ['-p', c.prompt, '--model', MODEL, '--output-format', 'json'];
  if (c.arm !== 'vanilla') args.push('--append-system-prompt-file', path.join(ISO, `${c.arm}.txt`));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-'));
  execFile('claude', args, { cwd, timeout: 240000, maxBuffer: 16 << 20, env: { ...process.env, HOME: cwd, CLAUDE_CONFIG_DIR: ISO } }, (err, stdout) => {
    let d = {}; try { d = JSON.parse(stdout); } catch (_) {}
    const u = d.usage || {};
    const rec = { id: c.id, arm: c.arm, seed: c.seed, out_tokens: u.output_tokens || 0,
      input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      turns: d.num_turns || 0, cost_usd: d.total_cost_usd || 0, answer: (d.result || '').trim() };
    rec.answer_lines = rec.answer.split('\n').length;
    if (!rec.out_tokens || /session limit|usage limit|rate limit/i.test(rec.answer)) console.log(`  ${c.id}/${c.arm}/${c.seed} NOT RECORDED`);
    else { fs.writeFileSync(out, JSON.stringify(rec, null, 1)); console.log(`  ${c.id}/${c.arm}/${c.seed} out=${rec.out_tokens} in=${rec.input_tokens} turns=${rec.turns}`); }
    fs.rmSync(cwd, { recursive: true, force: true });
    res();
  });
});
(async () => {
  const q = cells.slice();
  await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) await run(q.shift()); }));
  console.log('done');
})();
