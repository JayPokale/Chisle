#!/usr/bin/env node
// Agentic benchmark: the arms get a real repo and real tools, not a chat prompt.
//
// Each fixture is a small repo with a planted trap that only a careful agent
// avoids -- an existing helper that should be reused, a shared bug with three
// call sites, a one-line config ask that invites a framework. The agent never
// sees the test: test.js is copied in AFTER the run and decides pass/fail.
//
// Usage: node benchmarks/agentic/run.js [model] [seeds] [parallel]
//   ARMS=vanilla,chisle,chisle-hook  arms to run (default: vanilla,chisle)
//   FIXTURES=noisylog,reuse          run only these fixtures (default: all)
//   RAW_DIR=path                     where cells go (default: ./raw); use a fresh
//                                    dir when the ruleset changes, or old cells
//                                    are reused as if they were new
// Resumable: a cell whose result JSON already exists is skipped.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const crypto = require('crypto');

const MODEL = process.argv[2] || 'claude-haiku-4-5-20251001';
const SEEDS = Number(process.argv[3] || 3);
const PAR = Number(process.argv[4] || 5);

const KNOWN_ARMS = ['vanilla', 'chisle', 'chisle-hook'];
const ARMS = (process.env.ARMS || 'vanilla,chisle').split(',').map((a) => a.trim()).filter(Boolean);
const unknown = ARMS.filter((a) => !KNOWN_ARMS.includes(a));
if (unknown.length) { console.error(`unknown arm(s): ${unknown.join(', ')}; known: ${KNOWN_ARMS.join(', ')}`); process.exit(1); }

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const FIX = path.join(HERE, 'fixtures');
const RAW = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : path.join(HERE, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const ISO = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-agentic-'));
fs.copyFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(ISO, '.credentials.json'));
const skill = fs.readFileSync(path.join(HERE, '..', '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
const body = skill.split(/^---\s*$/m).slice(2).join('---').trim();
if (!body) { console.error('empty chisle system prompt'); process.exit(1); }
fs.writeFileSync(path.join(ISO, 'chisle.txt'), body + '\n');
process.on('exit', () => fs.rmSync(ISO, { recursive: true, force: true }));

// chisle-hook arm: the ruleset plus the shipped PostToolUse compressor, taken
// verbatim from plugin.json so the arm cannot drift from what users install.
const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
const HOOK_SETTINGS = JSON.stringify({ hooks: { PostToolUse: plugin.hooks.PostToolUse } })
  .split('${CLAUDE_PLUGIN_ROOT}').join(ROOT);

const only = process.env.FIXTURES ? process.env.FIXTURES.split(',').map((f) => f.trim()) : null;
const fixtures = fs.readdirSync(FIX).filter((f) => fs.existsSync(path.join(FIX, f, 'task.txt')) && (!only || only.includes(f)));
if (only && fixtures.length !== only.length) { console.error(`unknown fixture in FIXTURES=${process.env.FIXTURES}`); process.exit(1); }

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
for (const arm of ARMS) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (const fx of fixtures) cells.push({ fx, arm, seed });
  }
}
// One short line per tool call: enough to see the pattern, small enough to commit.
const summarize = (i) => String(i.command || i.pattern || (i.file_path ? path.basename(i.file_path)
  + (i.offset || i.limit ? ` [${i.offset || 1}+${i.limit || ''}]` : '') : '') || i.path || '').slice(0, 100);
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

    // stream-json, so each cell also records the tool calls it made, not only totals.
    const args = ['-p', task, '--model', MODEL, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
    if (c.arm !== 'vanilla') args.push('--append-system-prompt-file', path.join(ISO, 'chisle.txt'));
    let cfg = ISO;
    if (c.arm === 'chisle-hook') {
      // Own config dir per cell: the hook keeps its on/off flag, savings ledger
      // and spill files there, and parallel cells must not share them.
      cfg = path.join(work, 'cfg');
      fs.mkdirSync(cfg);
      fs.copyFileSync(path.join(ISO, '.credentials.json'), path.join(cfg, '.credentials.json'));
      fs.writeFileSync(path.join(cfg, '.chisle-active'), 'on');
      args.push('--settings', HOOK_SETTINGS);
    }

    execFile('claude', args, {
      cwd: repo,
      timeout: 300000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, HOME: work, CLAUDE_CONFIG_DIR: cfg },
    }, (err, stdout) => {
      const rec = { fixture: c.fx, arm: c.arm, seed: c.seed };
      if (err && !stdout) {
        rec.error = String(err.message).slice(0, 200);
      } else {
        let d = {};
        const calls = [];
        const prompts = new Map(); // API request id -> its prompt size in tokens
        for (const line of stdout.split('\n')) {
          let e; try { e = JSON.parse(line); } catch (_) { continue; }
          if (e.type === 'result') d = e;
          const u = e.type === 'assistant' && e.message && e.message.usage;
          if (u) prompts.set(e.message.id, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0));
          const blocks = (e.message && Array.isArray(e.message.content)) ? e.message.content : [];
          for (const b of blocks) {
            if (b.type === 'tool_use') calls.push({ tool: b.name, input: summarize(b.input || {}) });
            if (b.type === 'tool_result') {
              const text = typeof b.content === 'string' ? b.content : (b.content || []).map((x) => x.text || '').join('');
              const call = calls[calls.length - 1];
              if (call && call.chars === undefined) { call.chars = text.length; if (b.is_error) call.error = true; }
            }
          }
        }
        rec.out_tokens = d.usage ? d.usage.output_tokens : 0;
        rec.input_tokens = d.usage ? (d.usage.input_tokens || 0) + (d.usage.cache_creation_input_tokens || 0) + (d.usage.cache_read_input_tokens || 0) : 0;
        rec.cost_usd = d.total_cost_usd || 0;
        rec.turns = d.num_turns || 0;
        rec.answer = (d.result || '').trim();
        rec.tool_calls = calls;
        rec.request_prompts = [...prompts.values()];
        if (c.arm === 'chisle-hook') {
          let stats = {};
          try { stats = JSON.parse(fs.readFileSync(path.join(cfg, '.chisle-compress-stats.json'), 'utf8')); } catch (_) {}
          rec.compressed_chars = stats.savedChars || 0;
          rec.compress_events = stats.events || 0;
        }

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
