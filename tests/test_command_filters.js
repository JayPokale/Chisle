#!/usr/bin/env node
// Command-aware filter tests: what gets dropped, what must survive, and when
// filtering must not run at all.
// Run: node --test tests/test_command_filters.js

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { filterCommand, kindsFor } = require('../hooks/chisle-command-filters');
const { processPayload, commandOf } = require('../hooks/chisle-compress-output');

const GIT_STATUS = `On branch main
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
\tmodified:   src/a.js

Untracked files:
  (use "git add <file>..." to include in what will be committed)
\tsrc/b.js

no changes added to commit (use "git add" and/or "git commit -a")`;

const PYTEST = `============================= test session starts ==============================
collected 40 items

tests/test_a1.py ....................                                    [ 10%]
tests/test_a2.py ....................                                    [ 20%]
tests/test_a3.py ....................                                    [ 30%]
tests/test_a4.py ....................                                    [ 40%]
tests/test_b.py .........F..........                                     [100%]

=================================== FAILURES ===================================
___________________________________ test_x ____________________________________
E       assert 1 == 2
=========================== short test summary info ============================
FAILED tests/test_b.py::test_x - assert 1 == 2
========================= 1 failed, 39 passed in 0.12s =========================`;

const TAP = `TAP version 13
# Subtest: case 0
ok 2 - case 0
  ---
  duration_ms: 0.0
  ...
# Subtest: case 1
ok 3 - case 1
  ---
  duration_ms: 0.1
  ...
# Subtest: case 2
ok 4 - case 2
  ---
  duration_ms: 0.2
  ...
# Subtest: case 3
ok 5 - case 3
  ---
  duration_ms: 0.3
  ...
# Subtest: case 4
ok 6 - case 4
  ---
  duration_ms: 0.4
  ...
# Subtest: adds
ok 1 - adds
  ---
  duration_ms: 0.4
  ...
# Subtest: breaks
not ok 2 - breaks
  ---
  duration_ms: 0.9
  error: 'Expected values to be strictly equal'
  ...
1..2
# pass 1
# fail 1`;

test('git status: hints dropped, files and branch kept', () => {
  const out = filterCommand('git status', GIT_STATUS);
  assert.ok(!out.includes('(use "git'));
  for (const keep of ['On branch main', 'modified:   src/a.js', 'src/b.js', 'no changes added to commit']) {
    assert.ok(out.includes(keep), keep);
  }
  assert.match(out, /\[chisle: hid 3 git hint lines/);
});

test('pytest: passing dot lines dropped, the failing file line and failure kept', () => {
  const out = filterCommand('python -m pytest -q', PYTEST);
  assert.ok(!out.includes('tests/test_a.py ....'));
  assert.ok(out.includes('tests/test_b.py .........F'));
  assert.ok(out.includes('E       assert 1 == 2'));
  assert.ok(out.includes('1 failed, 39 passed'));
});

test('node --test TAP: passing blocks dropped, failing block kept whole', () => {
  const out = filterCommand('node --test --test-reporter=tap', TAP);
  assert.ok(!/^ok 1/m.test(out) && !out.includes('duration_ms: 0.4'));
  assert.ok(out.includes('not ok 2 - breaks') && out.includes("error: 'Expected values"));
  assert.ok(out.includes('# fail 1'));
});

test('spec reporters: ticks dropped, crosses kept', () => {
  const text = Array.from({ length: 20 }, (_, i) => `✔ case ${i} (1ms)`).concat(['✖ broken (2ms)', 'ℹ fail 1']).join('\n');
  const out = filterCommand('npm test', text);
  assert.ok(!out.includes('✔') && out.includes('✖ broken') && out.includes('ℹ fail 1'));
});

test('git log: default blocks compacted, nothing but labels and the hash tail lost', () => {
  const text = `commit ${'a'.repeat(40)} (HEAD -> main)
Author: Ada <ada@x.dev>
Date:   Tue Nov 17 17:48:30 2026 +0530

    Subject line

    Body line`;
  const out = filterCommand('git log -n 1', text);
  assert.equal(out, `${'a'.repeat(12)} (HEAD -> main) · Ada <ada@x.dev> · Tue Nov 17 17:48:30 2026 +0530\n  Subject line\n\n  Body line`);
  assert.equal(filterCommand('git log --oneline', text), null);
});

test('progress: install noise dropped, errors among it kept', () => {
  const text = [
    'Requirement already satisfied: requests in ./venv',
    'Collecting numpy',
    '  Downloading numpy-2.0.whl (18 MB)',
    'Collecting broken-error-pkg',
    'ERROR: No matching distribution found for nope',
  ].join('\n');
  const out = filterCommand('pip install -r requirements.txt', text);
  assert.ok(!out.includes('Requirement already') && !out.includes('Collecting numpy'));
  assert.ok(out.includes('broken-error-pkg') && out.includes('ERROR: No matching'));
});

test('carriage-return progress keeps only the last frame; CRLF lines survive', () => {
  const out = filterCommand('npm install', 'step 10%\rstep 50%\rstep 100%\r\nadded 3 packages\r\n' + 'x'.repeat(80));
  assert.ok(out.startsWith('step 100%\nadded 3 packages'));
});

test('no filtering: unknown commands, rtk, and pipes into anything but head/tail', () => {
  assert.equal(kindsFor('cat notes.txt'), null);
  assert.equal(kindsFor('rtk git status'), null);
  assert.equal(kindsFor('npm install | grep WARN'), null);
  assert.equal(kindsFor('git status | cat'), null);
  assert.equal(kindsFor(''), null);
  assert.equal(kindsFor(undefined), null);
  assert.deepEqual([...kindsFor('npm test 2>&1 | tail -20')], ['test']);
  assert.deepEqual([...kindsFor('cd app && CI=1 npx vitest run')], ['test']);
  assert.ok(kindsFor('git -C repo status').has('git-status'));
  // Operators inside quotes are not command boundaries.
  assert.equal(kindsFor('echo "a; git status"'), null);
  assert.equal(filterCommand('cat log.txt', GIT_STATUS), null);
});

test('hook: small Bash output is filtered via tool_input.command', () => {
  const prev = process.env.CHISLE_COMPRESS_FILTERS;
  delete process.env.CHISLE_COMPRESS_FILTERS;
  const payload = { tool_name: 'Bash', tool_input: { command: 'git status' }, tool_response: { stdout: GIT_STATUS, stderr: '' } };
  const out = processPayload(payload, 'on');
  assert.ok(GIT_STATUS.length < 1024 && out && !out.includes('(use "git'));
  process.env.CHISLE_COMPRESS_FILTERS = '0';
  assert.equal(processPayload(payload, 'on'), null);
  if (prev === undefined) delete process.env.CHISLE_COMPRESS_FILTERS; else process.env.CHISLE_COMPRESS_FILTERS = prev;
});

test('commandOf reads object and JSON-string args, rejects junk', () => {
  assert.equal(commandOf({ command: 'git status' }), 'git status');
  assert.equal(commandOf('{"command":"ls"}'), 'ls');
  assert.equal(commandOf('not json'), null);
  assert.equal(commandOf(null), null);
});
