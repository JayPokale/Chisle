// Ruleset A/B: bare vs three SKILL.md revisions, 5 live-suite prompts, 2 seeds,
// Haiku 4.5, same flags and isolation as benchmarks/run-live.sh.
// Usage: node benchmarks/results/raw-trim/run.js   (ARMS=new2 to run one arm)
// Resumable: a cell whose JSON already exists is skipped.
const fs = require('fs'), os = require('os'), path = require('path');
const { execFile, execFileSync } = require('child_process');
const REVS = { old: '72eb75a^', new: '72eb75a', new2: '48485e7' };
const HERE = __dirname, OUT = HERE;
fs.mkdirSync(OUT, { recursive: true });
const MODEL = 'claude-haiku-4-5-20251001';
const ISO = fs.mkdtempSync(path.join(os.tmpdir(), 'qt-'));
fs.copyFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(ISO, '.credentials.json'));
for (const [v, rev] of Object.entries(REVS)) {
  const body = execFileSync('git', ['show', `${rev}:skills/chisle/SKILL.md`], { cwd: HERE }).toString().split(/^---\s*$/m).slice(2).join('---').trim();
  fs.writeFileSync(path.join(ISO, `${v}.txt`), body + '\n');
}
process.on('exit', () => fs.rmSync(ISO, { recursive: true, force: true }));
const TASKS = [
  ['debounce', 'Add debounce to a search input that currently fires an API call on every keystroke. Show the code.'],
  ['cache', 'Add a cache layer for our user profile API responses. Show the code.'],
  ['auth-bug', 'Our auth middleware rejects valid tokens at the exact expiry boundary (it uses currentTime > expiry). Find and fix the root cause.'],
  ['pooling', 'Explain how database connection pooling works and why it helps.'],
  ['rest-graphql', 'Summarize the main tradeoffs between REST and GraphQL for a new API.'],
];
const cells = [];
for (const seed of [1, 2]) for (const [id, prompt] of TASKS) for (const arm of (process.env.ARMS || 'vanilla,old,new').split(',')) cells.push({ id, prompt, arm, seed });
const run = (c) => new Promise((res) => {
  const out = path.join(OUT, `${c.id}__${c.arm}__${c.seed}.json`);
  if (fs.existsSync(out)) return res();
  const args = ['-p', c.prompt, '--model', MODEL, '--output-format', 'json'];
  if (c.arm !== 'vanilla') args.push('--append-system-prompt-file', path.join(ISO, `${c.arm}.txt`));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'qtw-'));
  execFile('claude', args, { cwd, timeout: 240000, maxBuffer: 16 << 20, env: { ...process.env, HOME: cwd, CLAUDE_CONFIG_DIR: ISO } }, (err, stdout) => {
    let d = {}; try { d = JSON.parse(stdout); } catch (_) {}
    const u = d.usage || {};
    const rec = { ...c, prompt: undefined, out_tokens: u.output_tokens || 0,
      input_tokens: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
      cache_creation: u.cache_creation_input_tokens || 0, cost_usd: d.total_cost_usd || 0,
      answer_lines: (d.result || '').trim().split('\n').length, answer: d.result || '', error: err && !stdout ? String(err.message).slice(0, 200) : undefined };
    if (!rec.out_tokens || /session limit|usage limit|rate limit/i.test(rec.answer)) console.log(`  ${c.id}/${c.arm}/${c.seed} NOT RECORDED (limit or error)`);
    else { fs.writeFileSync(out, JSON.stringify(rec, null, 1)); console.log(`  ${c.id}/${c.arm}/${c.seed} out=${rec.out_tokens} in=${rec.input_tokens}`); }
    fs.rmSync(cwd, { recursive: true, force: true });
    res();
  });
});
(async () => {
  const q = cells.slice();
  await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) await run(q.shift()); }));
  console.log('done');
})();
