#!/usr/bin/env node
// Agentic benchmark: the arms get a real repo and real tools, not a chat prompt.
//
// Each fixture is a small repo with a planted trap that only a careful agent
// avoids -- an existing helper that should be reused, a shared bug with three
// call sites, a one-line config ask that invites a framework. The agent never
// sees the test: test.js is copied in AFTER the run and decides pass/fail.
//
// Usage: node benchmarks/agentic/run.js [model] [seeds] [parallel]
// Resumable: a cell whose result JSON already exists is skipped.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const crypto = require('crypto');

const MODEL = process.argv[2] || 'claude-haiku-4-5-20251001';
const SEEDS = Number(process.argv[3] || 3);
const PAR = Number(process.argv[4] || 5);

const HERE = __dirname;
const FIX = path.join(HERE, 'fixtures');
const RAW = path.join(HERE, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const ISO = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-agentic-'));
fs.copyFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(ISO, '.credentials.json'));
const skill = fs.readFileSync(path.join(HERE, '..', '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
const body = skill.split(/^---\s*$/m).slice(2).join('---').trim();
if (!body) { console.error('empty chisle system prompt'); process.exit(1); }
fs.writeFileSync(path.join(ISO, 'chisle.txt'), body + '\n');
process.on('exit', () => fs.rmSync(ISO, { recursive: true, force: true }));

const fixtures = fs.readdirSync(FIX).filter((f) => fs.existsSync(path.join(FIX, f, 'task.txt')));

const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name === '.git') return [];
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
});
const stat = (p) => {
  // Hash the contents: a one-character fix changes no line count, and comparing
  // line counts alone silently reported those runs as "no files touched".
  let src = '';
  try { src = fs.readFileSync(p, 'utf8'); } catch (_) {}
  return { loc: src.split('\n').filter((l) => l.trim()).length, hash: crypto.createHash('sha1').update(src).digest('hex') };
};
const snapshot = (root) => Object.fromEntries(walk(root).map((f) => [f, stat(path.join(root, f))]));

const cells = [];
for (const arm of ['vanilla', 'chisle']) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const fx of fixtures) cells.push({ fx, arm, seed });
  }
}
const outPath = (c) => path.join(RAW, `${c.fx}__${c.arm}__${c.seed}.json`);
const todo = cells.filter((c) => !fs.existsSync(outPath(c)));
let limited = false;
console.log(`model ${MODEL} | seeds ${SEEDS} | parallel ${PAR} | ${todo.length} of ${cells.length} cells to run`);

function runCell(c) {
  return new Promise((resolve) => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), `wk-${c.fx}-`));
    const repo = path.join(work, 'repo');
    fs.cpSync(path.join(FIX, c.fx, 'repo'), repo, { recursive: true });
    const before = snapshot(repo);
    const task = fs.readFileSync(path.join(FIX, c.fx, 'task.txt'), 'utf8').trim();

    const args = ['-p', task, '--model', MODEL, '--output-format', 'json', '--dangerously-skip-permissions'];
    if (c.arm === 'chisle') args.push('--append-system-prompt-file', path.join(ISO, 'chisle.txt'));

    execFile('claude', args, {
      cwd: repo,
      timeout: 300000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, HOME: work, CLAUDE_CONFIG_DIR: ISO },
    }, (err, stdout) => {
      const rec = { fixture: c.fx, arm: c.arm, seed: c.seed };
      if (err && !stdout) {
        rec.error = String(err.message).slice(0, 200);
      } else {
        let d = {};
        try { d = JSON.parse(stdout); } catch (_) {}
        rec.out_tokens = d.usage ? d.usage.output_tokens : 0;
        rec.input_tokens = d.usage ? (d.usage.input_tokens || 0) + (d.usage.cache_creation_input_tokens || 0) + (d.usage.cache_read_input_tokens || 0) : 0;
        rec.cost_usd = d.total_cost_usd || 0;
        rec.turns = d.num_turns || 0;
        rec.answer = (d.result || '').trim();

        // A usage-limit refusal is not a measurement. Writing it would score as
        // "the agent changed nothing", which is exactly how a limit hit
        // mid-suite produced 89 fake failures the first time this was run.
        if (!rec.out_tokens || /session limit|usage limit|rate limit/i.test(rec.answer)) {
          fs.rmSync(work, { recursive: true, force: true });
          console.log(`  ${c.fx}/${c.arm}/${c.seed} LIMITED — not recorded`);
          limited = true;
          return resolve();
        }

        // The hidden test lands only now, after the agent is finished.
        fs.copyFileSync(path.join(FIX, c.fx, 'test.js'), path.join(repo, '__hidden_test.js'));
        try {
          execFileSync('node', ['__hidden_test.js'], { cwd: repo, timeout: 20000, stdio: 'pipe' });
          rec.pass = true; rec.test_output = '';
        } catch (e) {
          rec.pass = false;
          rec.test_output = String((e.stdout || '') + (e.stderr || '')).trim().slice(0, 400);
        }
        fs.rmSync(path.join(repo, '__hidden_test.js'), { force: true });

        const after = snapshot(repo);
        rec.files_created = Object.keys(after).filter((f) => !(f in before));
        rec.files_touched = Object.keys(after).filter((f) => f in before && after[f].hash !== before[f].hash);
        rec.loc_before = Object.values(before).reduce((a, b) => a + b.loc, 0);
        rec.loc_after = Object.values(after).reduce((a, b) => a + b.loc, 0);
        rec.loc_delta = rec.loc_after - rec.loc_before;
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
          rec.deps_added = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
        } catch (_) { rec.deps_added = []; }
      }
      fs.writeFileSync(outPath(c), JSON.stringify(rec, null, 1));
      fs.rmSync(work, { recursive: true, force: true });
      console.log(`  ${c.fx}/${c.arm}/${c.seed} ${rec.error ? 'ERROR' : rec.pass ? 'PASS' : 'FAIL'}`);
      resolve();
    });
  });
}

(async () => {
  const queue = todo.slice();
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (queue.length && !limited) await runCell(queue.shift());
  }));
  if (limited) console.log('\nSTOPPED: usage limit reached. No partial cells were written; re-run to resume.');
  console.log('done -> ' + RAW);
})();
