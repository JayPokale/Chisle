#!/usr/bin/env node
// Side-by-side ruleset benchmark: any number of named rulesets in ONE run, so an
// old and a new Chisle (and the rivals) answer the same prompts in the same
// session of the same model. run-live.sh fixes its arm names; this does not.
//
// Same isolation and prompts as run-live.sh: credentials-only config dir,
// --tools "", --strict-mcp-config, the default + large suites read from it.
// Also requests thinking summaries and keeps them beside each cell
// (<task>__<arm>.think.txt), to see what the extra reasoning is about.
//
// Usage: node benchmarks/run-ablation.js <out-dir> <seeds> <parallel> <arm>...
//   arm: vanilla | name=path/to/SKILL.md   (frontmatter is stripped)
//   MODEL=claude-sonnet-5-5 picks the model (default Haiku 4.5).
// Example, old vs new ruleset:
//   git show v3.8.1:skills/chisle/SKILL.md > /tmp/old.md
//   node benchmarks/run-ablation.js results/raw-x 2 4 vanilla chisle-3.8.1=/tmp/old.md chisle=skills/chisle/SKILL.md
// Resumable: a cell whose JSON exists is skipped. Score with the README's
// method (pooled ratio of sums vs vanilla) over <out-dir>/*/.

const fs = require('fs'), os = require('os'), path = require('path');
const { execFile } = require('child_process');

const [out, seeds, par, ...armSpecs] = process.argv.slice(2);
if (!out || !armSpecs.length) { console.error('usage: run-ablation.js <out-dir> <seeds> <parallel> <arm>...'); process.exit(2); }
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';

const ISO = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-ablation-'));
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-ablation-work-'));
fs.copyFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), path.join(ISO, '.credentials.json'));
process.on('exit', () => { for (const d of [ISO, WORK]) fs.rmSync(d, { recursive: true, force: true }); });

const arms = armSpecs.map((spec) => {
  const [name, file] = spec.split('=');
  if (!file) return { name };
  const text = fs.readFileSync(file, 'utf8');
  const body = /^---\s*$/m.test(text.split('\n')[0]) ? text.split(/^---\s*$/m).slice(2).join('---').trim() : text.trim();
  const prompt = path.join(ISO, `${name}.txt`);
  fs.writeFileSync(prompt, body + '\n');
  return { name, prompt };
});

// The prompts live in run-live.sh; read them rather than keep a second copy.
// Normalize CRLF: a Windows checkout with core.autocrlf=true breaks the heredoc match.
const live = fs.readFileSync(path.join(__dirname, 'run-live.sh'), 'utf8').replace(/\r\n/g, '\n');
const heredoc = (v) => live.match(new RegExp(`\\n${v}=\\$\\(cat <<'EOF'\\n([\\s\\S]*?)\\nEOF`))[1];
const suites = { default: heredoc('TASKS'), large: heredoc('TASKS_LARGE') };

const cells = [];
for (let s = 1; s <= Number(seeds); s++) for (const [suite, tasks] of Object.entries(suites)) for (const line of tasks.split('\n')) {
  const [task, , prompt] = line.split('\t');
  for (const arm of arms) cells.push({ dir: path.join(out, `${suite}-s${s}`), task, prompt, arm });
}
const file = (c, ext) => path.join(c.dir, `${c.task}__${c.arm.name}.${ext}`);
const todo = cells.filter((c) => !fs.existsSync(file(c, 'json')));
console.log(`${MODEL} | ${todo.length}/${cells.length} cells | parallel ${par}`);
let limited = false;

const run = (c) => new Promise((resolve) => {
  fs.mkdirSync(c.dir, { recursive: true });
  const args = ['-p', c.prompt, '--model', MODEL, '--output-format', 'stream-json', '--verbose',
    '--tools', '', '--strict-mcp-config', '--settings', '{"showThinkingSummaries":true}'];
  if (c.arm.prompt) args.push('--append-system-prompt-file', c.arm.prompt);
  execFile('claude', args, { cwd: WORK, timeout: 240000, maxBuffer: 64 << 20, env: { ...process.env, HOME: WORK, CLAUDE_CONFIG_DIR: ISO } },
    (err, stdout) => {
      let result = null; const thinking = [];
      for (const l of String(stdout || '').split('\n')) {
        let e; try { e = JSON.parse(l); } catch (_) { continue; }
        if (e.type === 'assistant') for (const b of e.message.content || []) if (b.type === 'thinking' && b.thinking) thinking.push(b.thinking);
        if (e.type === 'result') result = e;
      }
      // Only a short, error-shaped result is a limit hit, not an answer about rate limiting.
      const text = String((result && result.result) || '');
      if (!result || !result.usage || !result.usage.output_tokens || result.is_error
          || (text.length < 300 && /limit reached|hit your .{0,20}limit|usage limit|session limit|rate_limit_error/i.test(text))) {
        c.tries = (c.tries || 0) + 1;
        console.log(`  ${path.basename(c.dir)}/${c.task}/${c.arm.name} not recorded (try ${c.tries}): ${(text || (err && err.message) || '').slice(0, 120)}`);
        if (c.tries >= 6) { limited = true; return resolve(); }
        return setTimeout(() => run(c).then(resolve), 60000 * c.tries);
      }
      fs.writeFileSync(file(c, 'json'), JSON.stringify(result));
      fs.writeFileSync(file(c, 'think.txt'), thinking.join('\n\n---\n\n'));
      resolve();
    });
});

(async () => {
  const q = todo.slice();
  await Promise.all(Array.from({ length: Number(par) }, async () => { while (q.length && !limited) await run(q.shift()); }));
  console.log(limited ? 'STOPPED after repeated failures (usage limit?). Re-run to resume.' : `done -> ${out}`);
})();
