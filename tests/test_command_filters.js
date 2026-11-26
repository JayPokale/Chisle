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

test('git status: long format becomes the short one, nothing lost', () => {
  assert.equal(filterCommand('git status', GIT_STATUS), '* main\n M src/a.js\n?? src/b.js');
  const full = `On branch dev
Your branch and 'origin/dev' have diverged,
and have 1 and 2 different commits each, respectively.
  (use "git pull" if you want to integrate the remote branch with yours)

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
\tnew file:   a.js
\trenamed:    b.js -> c.js
\tmodified:   d.js

Changes not staged for commit:
\tmodified:   d.js
\tdeleted:    e.js

Unmerged paths:
\tboth modified:   f.js
`;
  assert.equal(filterCommand('git status', full),
    '* dev...origin/dev [ahead 1, behind 2]\nA  a.js\nR  b.js -> c.js\nMM d.js\n D e.js\nUU f.js');
  assert.equal(filterCommand('git status', "On branch main\nYour branch is ahead of 'origin/main' by 3 commits.\n  (use \"git push\" to publish your local commits)\n\nnothing to commit, working tree clean"),
    '* main...origin/main [ahead 3]\nnothing to commit, working tree clean');
  assert.equal(kindsFor('git status -s'), null);
});

test('pytest: passing dot lines dropped, the failing file line and failure kept', () => {
  const out = filterCommand('python -m pytest -q', PYTEST);
  assert.ok(!out.includes('tests/test_a1.py ....'));
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

const commit = (h, who, body) => `commit ${h.repeat(40)}
Author: ${who} <${who.toLowerCase()}@x.dev>
Date:   Tue Nov 17 17:48:30 2026 +0530

    Subject ${h}

${body.map(b => '    ' + b).join('\n')}
`;

test('git log: one line per commit header, single commit keeps its whole body', () => {
  const one = commit('a', 'Ada', ['b1', 'b2', 'b3', 'b4', 'b5']).replace(`${'a'.repeat(40)}`, `${'a'.repeat(40)} (HEAD -> main)`);
  assert.equal(filterCommand('git show HEAD', one), `aaaaaaaaaa (HEAD -> main) Subject a (2026-11-17 Ada)\n  b1\n  b2\n  b3\n  b4\n  b5`);
  assert.equal(filterCommand('git log --oneline', one), null);
});

test('git log: several commits cap bodies (never stats), shared author named once', () => {
  const stat = Array.from({ length: 7 }, (_, i) => ` src/f${i}.js | ${i + 1} +`).join('\n') + '\n 7 files changed, 28 insertions(+)\n';
  const text = commit('a', 'Ada', ['b1', 'b2', 'b3', 'b4', 'b5']) + '\n' + stat + '\n' + commit('b', 'Ada', ['c1']);
  assert.equal(filterCommand('git log --stat', text), [
    '(all by Ada)', 'aaaaaaaaaa Subject a (2026-11-17)', '  b1', '  b2', '  b3', '  [+2 lines]',
    ...Array.from({ length: 7 }, (_, i) => `src/f${i}.js | ${i + 1}`), '7 files +28',
    'bbbbbbbbbb Subject b (2026-11-17)', '  c1'].join('\n'));
  const two = commit('a', 'Ada', ['x']) + '\n' + commit('b', 'Bo', ['y']);
  assert.match(filterCommand('git log', two), /^a{10} Subject a \(2026-11-17 Ada\)\n  x\nb{10} Subject b \(2026-11-17 Bo\)\n  y$/);
});

test('git log -p: several commits keep blank context lines in their hunks', () => {
  // The second hunk line is one space: an empty line of x.js as context.
  const patch = ['diff --git a/x.js b/x.js', 'index 1111111..2222222 100644', '--- a/x.js', '+++ b/x.js',
    '@@ -1,3 +1,3 @@', ' a', ' ', '-old', '+new', ''].join('\n');
  const text = commit('a', 'Ada', []) + '\n' + patch + '\n' + commit('b', 'Ada', []) + '\n' + patch;
  const out = filterCommand('git log -p -2', text);
  assert.equal(out.split('\n').filter(l => l === ' ').length, 2);
  assert.match(out, /@@ -1,3 \+1,3 @@\n a\n \n-old\n\+new/);
});

test('git diff: headers become one path line, hunks untouched', () => {
  const text = `diff --git a/x.js b/x.js
index 1111111..2222222 100644
--- a/x.js
+++ b/x.js
@@ -1,2 +1,2 @@
-old
+new
 same
diff --git a/n.js b/n.js
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/n.js
@@ -0,0 +1 @@
+hi
diff --git a/o.js b/p.js
similarity index 90%
rename from o.js
rename to p.js
diff --git a/s.sh b/s.sh
old mode 100644
new mode 100755`;
  assert.equal(filterCommand('git diff', text),
    'x.js\n@@ -1,2 +1,2 @@\n-old\n+new\n same\nn.js (new)\n@@ -0,0 +1 @@\n+hi\no.js -> p.js\ns.sh (mode 100644 -> 100755)');
  // A context line that reads like a stat line is diff content, not a stat.
  const table = 'diff --git a/t.md b/t.md\nindex 1..2 100644\n--- a/t.md\n+++ b/t.md\n@@ -1,2 +1,2 @@\n Total | 42\n-x\n+y';
  assert.equal(filterCommand('git diff', table), 't.md\n@@ -1,2 +1,2 @@\n Total | 42\n-x\n+y');
  assert.equal(filterCommand('git diff --stat', ' a.js | 3 ++-\n b.md | 10 +++++\n 2 files changed, 12 insertions(+), 1 deletion(-)'),
    'a.js | 3\nb.md | 10\n2 files +12 -1');
});

test('git branch -a: remotes folded per remote; ls -l compacted', () => {
  const br = '* main\n  dev\n  remotes/origin/HEAD -> origin/main\n  remotes/origin/main\n  remotes/origin/feat/x';
  assert.equal(filterCommand('git branch -a', br), '* main\n  dev\norigin/: HEAD -> main, main, feat/x');
  const ls = `total 12
drwxr-xr-x  3 ada ada  4096 Nov 19 03:44 .
drwxr-xr-x 26 ada ada  4096 Nov 19 03:44 ..
drwxr-xr-x  2 ada ada  4096 Nov 19 03:44 src
-rwxr-xr-x  1 ada ada  1234 Nov 19 03:44 run.sh
lrwxrwxrwx  1 ada ada     5 Nov 19 03:44 link -> run.sh
-rw-r--r--  1 root root  10 Nov 19 03:44 my file.txt`;
  assert.equal(filterCommand('ls -la', ls), '(owner ada:ada unless shown)\n755 ./\n755 src/\n755 1234 run.sh\n777 5 link -> run.sh\n644 10 root:root my file.txt');
  // A single owner is named unless it is the current user.
  const mine = require('os').userInfo().username;
  const one = (who) => `-rw-r--r--+ 1 ${who} ${who} 10 Nov 19 03:44 a.txt\n-rw-r--r--  1 ${who} ${who} 20 Nov 19 03:44 b.txt`;
  assert.equal(filterCommand('ls -l', one(mine)), '644+ 10 a.txt\n644 20 b.txt');
  assert.equal(filterCommand('ls -l', one('root')), '(owner root:root)\n644+ 10 a.txt\n644 20 b.txt');
  assert.match(filterCommand('ls -lt', ls), /755 1234 Nov 19 03:44 run\.sh/);
  assert.equal(kindsFor('ls -a'), null);
});

test('wc and grep -rn: padding and repeated paths dropped', () => {
  assert.equal(filterCommand('wc -l src/*.js', '   10 src/a.js\n  200 src/b.js\n  210 total'), 'src/\n10 a.js\n200 b.js\n210 total');
  assert.equal(filterCommand('wc -l a.js lib/b.js', '   10 a.js\n  200 lib/b.js\n  210 total'), '10 a.js\n200 lib/b.js\n210 total');
  const g = 'src/a.js:3:const x = 1;\nsrc/a.js:9:  x += 2;\nsrc/b.js:1:import x';
  assert.equal(filterCommand('grep -rn x src', g), 'src/a.js\n3:const x = 1;\n9:  x += 2;\nsrc/b.js\n1:import x');
  assert.equal(filterCommand('grep -n x src/a.js', g), null);
});

test('go test -v: passing tests leave no orphan log lines; failing and skipped keep theirs', () => {
  const text = `=== RUN   TestConnect
    a_test.go:3: connecting
--- PASS: TestConnect (0.00s)
=== RUN   TestSkip
    a_test.go:5: needs docker
--- SKIP: TestSkip (0.00s)
=== RUN   TestPar
=== RUN   TestPar/x
=== PAUSE TestPar/x
=== RUN   TestPar/y
=== PAUSE TestPar/y
=== CONT  TestPar/x
    a_test.go:8: sub x
=== CONT  TestPar/y
    a_test.go:8: y broke
--- FAIL: TestPar (0.00s)
    --- PASS: TestPar/x (0.00s)
    --- FAIL: TestPar/y (0.00s)
FAIL`;
  assert.equal(filterCommand('go test -v ./...', text), `=== RUN   TestSkip
    a_test.go:5: needs docker
--- SKIP: TestSkip (0.00s)
=== RUN   TestPar
=== RUN   TestPar/y
=== CONT  TestPar/y
    a_test.go:8: y broke
--- FAIL: TestPar (0.00s)
    --- FAIL: TestPar/y (0.00s)
FAIL`);
});

test('cargo test: banners, passes and the repeated failure list dropped, zero counts trimmed', () => {
  const text = `    Finished \`test\` profile [unoptimized + debuginfo] target(s) in 0.01s
     Running unittests src/lib.rs (target/debug/deps/rt-a01b)

running 3 tests
test t::a ... ok
test t::b ... FAILED
test t::c ... ok

failures:

---- t::b stdout ----
thread 't::b' panicked at src/lib.rs:15:9:
assertion failed
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace


failures:
    t::b

test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

error: test failed, to rerun pass \`--lib\``;
  assert.equal(filterCommand('cargo test', text), `test t::b ... FAILED

failures:

---- t::b stdout ----
thread 't::b' panicked at src/lib.rs:15:9:
assertion failed

test result: FAILED. 2 passed; 1 failed (0.00s)

error: test failed, to rerun pass \`--lib\``);
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
  assert.ok(GIT_STATUS.length < 1024 && out && !out.includes('(use "git') && out.includes('?? src/b.js'));
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
