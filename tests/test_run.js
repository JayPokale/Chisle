#!/usr/bin/env node
// chisle-run.js: the PreToolUse rewrite (what gets wrapped, what never does)
// and the runner (filtered output, the command's own exit status).
// Run: node --test tests/test_run.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { rewriteCommand, guardedPrograms } = require('../hooks/chisle-run');

const RUNNER = path.join(__dirname, '..', 'hooks', 'chisle-run.js');
const P = 'RUN ';

test('rewrite: test/build/install segments wrapped, the rest left as written', () => {
  assert.equal(rewriteCommand('npm test', P), 'RUN npm test');
  assert.equal(rewriteCommand('cd app && CI=1 npx vitest run 2>&1 | tail -20', P), 'cd app && CI=1 RUN npx vitest run 2>&1 | tail -20');
  assert.equal(rewriteCommand('FOO="a b" cargo test; go build ./...', P), 'FOO="a b" RUN cargo test; RUN go build ./...');
  assert.equal(rewriteCommand('git status && pytest -q', P), 'git status && RUN pytest -q');
  for (const c of ['git status', 'ls -la', 'cargo run', 'docker build .', 'npm run dev', 'npm test | grep FAIL',
    'npm test -- --watch', 'sudo npm install', 'time npm test', 'echo "npm test"']) {
    assert.equal(rewriteCommand(c, P), null, c);
  }
});

test('rewrite: shell it cannot parse safely is never touched', () => {
  for (const c of ['npm test &', 'echo $(npm test)', 'echo `npm test`', '(cd a && npm test)', '{ npm test; }',
    'for f in a; do npm test; done', 'cat <<EOF\nnpm test\nEOF', 'npm test # run', 'npm test "unterminated',
    'RUN npm test']) {
    assert.equal(rewriteCommand(c, P), null, c);
  }
  assert.equal(rewriteCommand('npm test 2>&1 > out.log', P), 'RUN npm test 2>&1 > out.log');
  assert.equal(rewriteCommand('cd "${HOME}/a b" && go test ./...', P), 'cd "${HOME}/a b" && RUN go test ./...');
});

test('rewrite: programs named by deny/ask Bash rules are never wrapped', () => {
  assert.equal(rewriteCommand('npm install x', P, new Set(['npm'])), null);
  assert.equal(rewriteCommand('npm install x && go test', P, new Set(['npm'])), 'npm install x && RUN go test');
  assert.equal(rewriteCommand('go test', P, new Set(['*'])), null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-run-'));
  fs.mkdirSync(path.join(dir, 'proj', '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'proj', '.claude', 'settings.json'),
    JSON.stringify({ permissions: { deny: ['Bash(npm publish:*)', 'WebFetch'], ask: ['Bash(pip install *)'] } }));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ permissions: { deny: ['Bash'] } }));
  assert.deepEqual([...guardedPrograms(path.join(dir, 'proj', 'sub'), path.join(dir, 'none'))].sort(), ['npm', 'pip']);
  assert.deepEqual([...guardedPrograms(path.join(dir, 'proj'), dir)].sort(), ['*', 'npm', 'pip']);
  fs.rmSync(dir, { recursive: true, force: true });
});

function hook(payload, env = {}) {
  const r = spawnSync(process.execPath, [RUNNER], {
    input: JSON.stringify(payload), encoding: 'utf8',
    env: { ...process.env, CHISLE_DEFAULT_MODE: 'on', CHISLE_COMPRESS_WRAP: '', ...env },
  });
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.updatedInput.command : null;
}

test('hook: wraps only in bypassPermissions mode unless CHISLE_COMPRESS_WRAP=1', { skip: process.platform === 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-hook-'));
  const env = { CLAUDE_CONFIG_DIR: dir };
  assert.equal(hook({ tool_name: 'Bash', cwd: dir, permission_mode: 'bypassPermissions', tool_input: { command: 'npm test' } }, env), null, 'no flag file: chisle off');
  fs.writeFileSync(path.join(dir, '.chisle-active'), 'on');
  const base = { tool_name: 'Bash', cwd: dir, tool_input: { command: 'npm test', description: 'd' } };
  const out = hook({ ...base, permission_mode: 'bypassPermissions' }, env);
  assert.ok(out && out.endsWith(' -- npm test') && out.includes('chisle-run.js'), out);
  assert.equal(hook({ ...base, permission_mode: 'default' }, env), null);
  assert.ok(hook({ ...base, permission_mode: 'default' }, { ...env, CHISLE_COMPRESS_WRAP: '1' }));
  assert.equal(hook({ ...base, permission_mode: 'bypassPermissions' }, { ...env, CHISLE_COMPRESS_WRAP: '0' }), null);
  assert.equal(hook({ ...base, tool_name: 'Read', permission_mode: 'bypassPermissions' }, env), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('runner: filters a failing run and keeps its exit status and streams', { skip: process.platform === 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-runner-'));
  const script = path.join(dir, 'fake-test.js');
  const passes = Array.from({ length: 30 }, (_, i) => `--- PASS: TestOk${i} (0.00s)`).join('\n');
  fs.writeFileSync(script, `process.stdout.write(${JSON.stringify(passes + '\n--- FAIL: TestBad (0.00s)\nFAIL\n')});
process.stderr.write('warn: flaky\\n'); process.exit(3);`);
  // `go test` classifies as a test command; node stands in for go.
  const shim = path.join(dir, 'go');
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${script}"\n`, { mode: 0o755 });
  const r = spawnSync(process.execPath, [RUNNER, '--', 'go', 'test', './...'], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, CLAUDE_CONFIG_DIR: dir },
  });
  assert.equal(r.status, 3);
  assert.equal(r.stdout, '--- FAIL: TestBad (0.00s)\nFAIL\n');
  assert.equal(r.stderr, 'warn: flaky\n');
  // stdout and stderr into one place (2>&1): order kept, all on stdout.
  fs.writeFileSync(script, `const w = (s, t) => new Promise(r => setTimeout(() => { s.write(t); r(); }, 20));
(async () => { await w(process.stdout, 'out-1\\n'); await w(process.stderr, 'ERR-2\\n'); await w(process.stdout, 'out-3\\n'); process.exit(1); })();`);
  const both = spawnSync('sh', ['-c', `"${process.execPath}" "${RUNNER}" -- go test ./... 2>&1`], {
    encoding: 'utf8', env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, CLAUDE_CONFIG_DIR: dir },
  });
  assert.equal(both.status, 1);
  assert.equal(both.stdout, 'out-1\nERR-2\nout-3\n');
  const missing = spawnSync(process.execPath, [RUNNER, '--', 'chisle-no-such-cmd'], { encoding: 'utf8' });
  assert.equal(missing.status, 127);
  assert.match(missing.stderr, /chisle-no-such-cmd: command not found/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hook: Antigravity PreToolUse rewrites wrappable run_command and ignores non-wrappable', { skip: process.platform === 'win32' }, () => {
  const emptyAgyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-agy-empty-'));
  const call = (payload, env = {}) => {
    const r = spawnSync(process.execPath, [RUNNER], {
      input: JSON.stringify(payload), encoding: 'utf8',
      env: { ...process.env, AGY_CONFIG_DIR: emptyAgyDir, CHISLE_DEFAULT_MODE: 'on', CHISLE_COMPRESS: '', CHISLE_COMPRESS_FILTERS: '', CHISLE_COMPRESS_WRAP: '', ...env },
    });
    return r.stdout ? JSON.parse(r.stdout) : null;
  };
  const out = call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't1', name: 'run_command', args: { CommandLine: 'npm test' } },
  });
  assert.equal(out.decision, 'ask');
  assert.ok(out.overwrite.CommandLine.endsWith(' -- npm test') && out.overwrite.CommandLine.includes('--state-dir') && out.overwrite.CommandLine.includes('chisle-run.js'));
  const compound = call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't1b', name: 'run_command', args: { CommandLine: 'rm -rf /tmp/x && npm test' } },
  });
  assert.equal(compound.decision, 'ask');
  assert.ok(compound.overwrite.CommandLine.startsWith('rm -rf /tmp/x && ') && compound.overwrite.CommandLine.endsWith(' -- npm test'));
  assert.equal(call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't2', name: 'run_command', args: { CommandLine: 'git status' } },
  }), null);
  assert.equal(call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't3', name: 'view_file', args: { Path: 'a.js' } },
  }), null);
  assert.equal(call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't4', name: 'run_command', args: { CommandLine: 'npm test' } },
  }, { CHISLE_DEFAULT_MODE: 'off' }), null);
  const flagDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-agy-flag-'));
  fs.writeFileSync(path.join(flagDir, '.chisle-active'), 'off');
  assert.equal(call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't5', name: 'run_command', args: { CommandLine: 'npm test' } },
  }, { AGY_CONFIG_DIR: flagDir }), null);
  assert.equal(call({
    hookEventName: 'PreToolUse',
    toolCall: { id: 't6', name: 'run_command', args: { CommandLine: 'node /other/chisle-run.js -- npm test' } },
  }), null);
  fs.rmSync(flagDir, { recursive: true, force: true });
  fs.rmSync(emptyAgyDir, { recursive: true, force: true });
});

test('runner: --state-dir routes stats away from CLAUDE_CONFIG_DIR', { skip: process.platform === 'win32' }, () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-agy-runner-')));
  const claudeDir = path.join(dir, 'claude');
  const agyDir = path.join(dir, 'agy');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(agyDir, { recursive: true });
  const script = path.join(dir, 'fake-test.js');
  const passes = Array.from({ length: 30 }, (_, i) => `--- PASS: TestOk${i} (0.00s)`).join('\n');
  fs.writeFileSync(script, `process.stdout.write(${JSON.stringify(passes + '\n--- FAIL: TestBad (0.00s)\nFAIL\n')}); process.exit(3);`);
  const shim = path.join(dir, 'go');
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${script}"\n`, { mode: 0o755 });
  const r = spawnSync(process.execPath, [RUNNER, '--state-dir', agyDir, '--', 'go', 'test', './...'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, CLAUDE_CONFIG_DIR: claudeDir },
  });
  assert.equal(r.status, 3);
  assert.equal(r.stdout, '--- FAIL: TestBad (0.00s)\nFAIL\n');
  const agyStats = JSON.parse(fs.readFileSync(path.join(agyDir, '.chisle-compress-stats.json'), 'utf8'));
  assert.ok(agyStats.savedChars > 0);
  assert.equal(agyStats.events, 1);
  assert.equal(fs.existsSync(path.join(claudeDir, '.chisle-compress-stats.json')), false);

  const envStateDir = path.join(dir, 'env-state');
  fs.mkdirSync(envStateDir, { recursive: true });
  const r2 = spawnSync(process.execPath, [RUNNER, '--', 'go', 'test', './...'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, CLAUDE_CONFIG_DIR: claudeDir, CHISLE_STATE_DIR: envStateDir },
  });
  assert.equal(r2.status, 3);
  assert.ok(fs.existsSync(path.join(envStateDir, '.chisle-compress-stats.json')));
  assert.equal(fs.existsSync(path.join(claudeDir, '.chisle-compress-stats.json')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
