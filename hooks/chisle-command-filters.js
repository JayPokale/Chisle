// chisle — command-aware output filters (RTK-style, but post-hoc).
//
// Design credit: RTK (https://github.com/rtk-ai/rtk). The short git status,
// one-line log headers with capped bodies, folded remote branches and compact
// ls/wc/test output follow its output shapes; no RTK code is used.
//
// The size tiers in chisle-compress-output.js only start at 1k/8k chars and
// know nothing about which command ran. Most shell noise is smaller and
// command-specific: git's "(use git add ...)" hints, passing-test lines,
// install/download progress, padded columns. Knowing the command lets us drop
// or reformat exactly those lines at any size, from inside the hook that
// already runs, so it works on every OS and harness Chisle hooks, with no
// wrapper binary. chisle-run.js reuses the same filters before a command
// exits, so Claude Code failures (which no PostToolUse hook can rewrite) get
// filtered too.
//
// Safety rules:
//   - Only commands we recognise are touched; anything else returns null.
//   - A segment piped into anything but head/tail is skipped: the agent shaped
//     that output itself (`npm i | grep WARN` must keep its WARN lines).
//     `| cat` therefore always shows raw output.
//   - Failures, errors, warnings and summaries are never dropped. Lossy
//     reformatting is limited to multi-item overviews (git log bodies and
//     stats past a cap, ls dates), with a "[+N]" count where lines go.
//   - Output already filtered by rtk (`rtk git status`) is left alone.
//   - The result is used only if it is shorter.

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// Wrappers that run another program: skip them to find the real one.
const RUNNERS = new Set(['sudo', 'time', 'command', 'exec', 'nice', 'env', 'npx', 'bunx', 'pnpx']);
const RUNNER_PAIRS = /^(?:(?:pnpm|yarn) (?:exec|dlx)|(?:uv|poetry|pipenv|rye|hatch|pdm) run|bundle exec|python[\d.]* -m|py -m)\s+/;
const ENV_ASSIGN = /^(?:[A-Za-z_]\w*=(?:'[^']*'|"(?:\\.|[^"\\])*"|[^\s'"\\])*\s+)+/;

const TEST_PROGRAMS = new Set(['pytest', 'py.test', 'jest', 'vitest', 'mocha', 'ava', 'tap', 'rspec', 'phpunit']);
const PKG_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

function stripQuotes(command) {
  return command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
}

// One command segment → { kinds, prog, sub, flags }, or null if unknown/piped.
function classify(segment) {
  const parts = segment.split('|').map(s => s.trim());
  const pipedTo = parts.slice(1).map(p => p.split(/\s+/)[0]);
  if (pipedTo.some(p => p !== 'head' && p !== 'tail')) return null;

  let s = parts[0].replace(ENV_ASSIGN, '');
  for (;;) {
    const word = s.split(/\s+/)[0];
    if (RUNNERS.has(word)) { s = s.slice(word.length).trim().replace(ENV_ASSIGN, ''); continue; }
    const pair = s.match(RUNNER_PAIRS);
    if (pair) { s = s.slice(pair[0].length); continue; }
    break;
  }
  const words = s.split(/\s+/).filter(w => w && !/^[<>&]|^\d>/.test(w));
  const prog = (words[0] || '').replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd)$/i, '');
  if (prog === 'rtk') return null;
  // First non-option argument after the program, skipping `-C dir`-style pairs.
  let sub = '';
  for (let i = 1; i < words.length; i++) {
    if (/^-[Cc]$/.test(words[i])) { i++; continue; }
    if (!words[i].startsWith('-')) { sub = words[i]; break; }
  }
  // Short-flag letters (`-la` → l, a) plus long flags, for ls/grep/git branch.
  const flags = new Set();
  for (const w of words.slice(1)) {
    if (/^--\w/.test(w)) flags.add(w.replace(/=.*/, ''));
    else if (/^-[A-Za-z]+$/.test(w)) for (const c of w.slice(1)) flags.add(c);
  }

  const kinds = new Set();
  if (prog === 'git') {
    const fmt = /--(?:format|pretty|oneline)\b|--graph\b/.test(s);
    if (sub === 'status' && !flags.has('s') && !flags.has('--short') && !flags.has('--porcelain')) kinds.add('git-status');
    if (/^(?:push|pull|fetch|clone)$/.test(sub)) kinds.add('progress');
    if ((sub === 'log' || sub === 'show') && !fmt) kinds.add('git-log');
    if (/^(?:diff|show|log)$/.test(sub)) kinds.add('git-diff');
    if (sub === 'branch' && !flags.has('v') && !flags.has('--verbose')) kinds.add('git-branch');
  }
  if (prog === 'ls' && flags.has('l')) kinds.add('ls');
  if (prog === 'wc') kinds.add('wc');
  if ((prog === 'grep' || prog === 'egrep' || prog === 'rg') &&
      (flags.has('n') || flags.has('--line-number') || prog === 'rg') &&
      (flags.has('r') || flags.has('R') || flags.has('H') || flags.has('--recursive') || prog === 'rg')) kinds.add('grep');
  if (TEST_PROGRAMS.has(prog) || (prog === 'node' && /\s--test\b/.test(s)) ||
      (['go', 'deno', 'bun', 'dotnet'].includes(prog) && sub === 'test') ||
      (prog === 'cargo' && /^(?:test|nextest)$/.test(sub)) ||
      (PKG_MANAGERS.has(prog) && (/^(?:test|t)$/.test(sub) || (/^run(?:-script)?$/.test(sub) && /\s(?:run|run-script)\s+test/.test(s)))) ||
      (prog === 'make' && /\b(?:test|check)\b/.test(sub))) kinds.add('test');
  if ((PKG_MANAGERS.has(prog) && /^(?:install|i|ci|add|update|upgrade)$/.test(sub)) ||
      /^pip\d*(?:\.\d+)?$/.test(prog) || (prog === 'uv' && /^(?:pip|sync|add)$/.test(sub)) ||
      (prog === 'poetry' && /^(?:install|add|update)$/.test(sub)) ||
      (prog === 'cargo' && /^(?:build|check|run|test|nextest|clippy|install|update|fetch|doc)$/.test(sub)) ||
      (prog === 'go' && /^(?:build|test|get|mod|run|install|vet)$/.test(sub)) ||
      (prog === 'docker' && /^(?:build|pull|compose|buildx)$/.test(sub)) || prog === 'docker-compose' ||
      (['bundle', 'composer'].includes(prog) && /^(?:install|update)$/.test(sub))) kinds.add('progress');
  return kinds.size ? { kinds, prog, sub, flags, text: s } : null;
}

// Segments that print nothing, so they cannot be mangled by a filter.
const SILENT = /^(?:cd(?:\s|$)|export\s+[A-Za-z_]|(?:[A-Za-z_]\w*=\S*\s*)+$)/;

// Kinds to filter for a whole command line, or null. One unrecognised segment
// that prints (`git status && cat m.py`) means null: the filters run over the
// combined output and would rewrite that segment's lines too.
function kindsFor(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  const kinds = new Set();
  for (const seg of stripQuotes(command).split(/&&|\|\||;|\n/)) {
    const s = seg.trim();
    if (!s || SILENT.test(s)) continue;
    const c = classify(s);
    if (!c) return null;
    for (const x of c.kinds) kinds.add(x);
  }
  return kinds.size ? kinds : null;
}

// Worth running through chisle-run.js: commands that end on their own and fail
// loudly (tests, builds, installs). Not git/docker, not `run`, not watch mode.
function wrappable(segment) {
  const c = classify(stripQuotes(segment).trim());
  if (!c || /--watch\b/.test(c.text)) return false;
  if (c.kinds.has('test')) return true;
  return c.kinds.has('progress') && !/^(?:git|docker|docker-compose)$/.test(c.prog) && c.sub !== 'run';
}

// ── Drop rules: [kind, regex] ────────────────────────────────────────────────
const DROP = [
  ['git-status', /^\s*\((?:use "git |commit or discard )[^)]*\)\s*$/],
  ['progress', /^(?:remote: )?(?:Enumerating|Counting|Compressing|Writing|Receiving|Unpacking) objects:|^(?:remote: )?Resolving deltas:|^(?:remote: )?Total \d+ \(delta|^Delta compression using|^(?:Updating|Checking out) files:/],
  // npm / pnpm
  ['progress', /^\d+ packages? (?:is|are) looking for funding$|^\s*run `npm fund` for details$|^Progress: resolved \d+|^\+{5,}$/],
  // pip
  ['progress', /^Requirement already satisfied: |^\s*(?:Collecting|Downloading|Using cached|Obtaining) \S|^\s*━+/],
  // cargo / go
  ['progress', /^\s+(?:Compiling|Checking|Downloaded|Downloading|Fresh|Locking|Adding|Blocking) \S|^\s+Updating crates\.io index$|^go: (?:downloading|finding|extracting) /],
  // docker pull / buildkit
  ['progress', /^[0-9a-f]{12}: (?:Pulling fs layer|Waiting|Verifying Checksum|Download complete|Pull complete|Already exists|Downloading|Extracting)|^#\d+ (?:sha256:[0-9a-f]+ [\d.]+[kMG]?B \/|transferring |extracting sha256:)/],
  // passing tests: pytest dots/-v, jest/vitest/mocha/node spec ticks, cargo, go
  ['test', /^\S+\.py\s+[.sx]+\s*\[\s*\d+%\]$|^\S+::\S.*\sPASSED(?:\s+\[\s*\d+%\])?$|^\s*[✓✔√]\s|^\s*PASS\s+\S|^\s*▶\s|^test \S+ \.\.\. ok$|^\s*--- PASS: |^\s*# Subtest: /],
  // cargo test scaffolding: build/run banners, per-suite headers, empty suites,
  // and the backtrace hint
  ['test', /^\s+Finished `|^\s+Running \S.* \(target[\\/]|^\s+Doc-tests \S+$|^running \d+ tests?$|^test result: ok\. 0 passed; 0 failed;|^note: run with `RUST_BACKTRACE=1`/],
];

// `go test -v`: a test's log lines sit between its `=== RUN`/`CONT` line and
// the next marker. Passing tests go whole (header and logs), so no log line
// is left orphaned beside a failure; failing and skipped tests keep theirs.
function goVerbose(lines) {
  if (!lines.some(l => /^=== RUN\s/.test(l))) return lines;
  const keep = new Set(lines.map(l => l.match(/^\s*--- (?:FAIL|SKIP): (\S+)/)).filter(Boolean).map(m => m[1]));
  const out = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^=== (RUN|PAUSE|CONT|NAME)\s+(\S+)/);
    if (m) { cur = m[2]; if (keep.has(cur) && m[1] !== 'PAUSE') out.push(l); continue; }
    if (/^\s*--- (?:PASS|FAIL|SKIP): /.test(l)) cur = null;
    else if (cur && !keep.has(cur)) continue;
    out.push(l);
  }
  return out;
}

// node --test TAP: `ok N - name` plus its indented YAML block.
function dropTapPasses(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*ok \d+ - /.test(lines[i])) {
      if (lines[i + 1] && /^\s*---$/.test(lines[i + 1])) {
        let j = i + 2;
        while (j < lines.length && !/^\s*\.\.\.$/.test(lines[j])) j++;
        i = j;
      }
      continue;
    }
    out.push(lines[i]);
  }
  return out;
}

// cargo: zero counts carry nothing; the trailing `failures:` name list repeats
// the `---- name stdout ----` blocks above it.
function compactCargo(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l === 'failures:' && /^    \S+$/.test(lines[i + 1] || '')) {
      while (/^    \S+$/.test(lines[i + 1] || '')) i++;
      continue;
    }
    out.push(l.replace(/^(test result: \w+\. .*?); finished in (\S+)$/, (_, head, t) =>
      `${head.replace(/; 0 [a-z ]+(?=;|$)/g, '')} (${t})`));
  }
  return out;
}

// Long `git status` → the short format (`XY path`), as `git status -sb` prints.
const STATUS_SECTIONS = { 'Changes to be committed:': 'x', 'Changes not staged for commit:': 'y', 'Unmerged paths:': 'u', 'Untracked files:': '??', 'Ignored files:': '!!' };
const STATUS_CODES = { modified: 'M', 'new file': 'A', deleted: 'D', renamed: 'R', copied: 'C', typechange: 'T' };
const UNMERGED_CODES = { 'both modified': 'UU', 'added by us': 'AU', 'added by them': 'UA', 'deleted by us': 'DU', 'deleted by them': 'UD', 'both added': 'AA', 'both deleted': 'DD' };

function shortStatus(lines) {
  const out = [];
  const files = new Map();
  let sec = null;
  let at = -1;
  for (const l of lines) {
    if (l in STATUS_SECTIONS) { sec = STATUS_SECTIONS[l]; if (at < 0) at = out.length; continue; }
    if (!l.trim()) { sec = null; continue; }
    if (sec && l.startsWith('\t')) {
      const e = l.slice(1);
      if (sec === '??' || sec === '!!') { files.set(sec + e, `${sec} ${e}`); continue; }
      const m = e.match(/^([a-z ]+):\s+(.*)$/);
      const code = m && (sec === 'u' ? UNMERGED_CODES[m[1]] : STATUS_CODES[m[1]]);
      if (code) {
        if (sec === 'u') { files.set(m[2], `${code} ${m[2]}`); continue; }
        const prev = files.get(m[2]);
        const x = sec === 'x' ? code : (prev ? prev[0] : ' ');
        const y = sec === 'y' ? code : ' ';
        files.set(m[2], `${x}${y} ${m[2]}`);
        continue;
      }
    }
    if (/^no changes added to commit|^nothing added to commit but untracked files present/.test(l)) continue;
    out.push(l);
  }
  if (at >= 0) out.splice(at, 0, ...files.values());
  // Branch header, `## branch...upstream [ahead N, behind M]` style.
  const text = out.join('\n')
    .replace(/^On branch (\S+)\nYour branch is up to date with '([^']+)'\.$/m, '* $1...$2')
    .replace(/^On branch (\S+)\nYour branch is (ahead of|behind) '([^']+)' by (\d+) commits?(?:, and can be fast-forwarded)?\.$/m,
      (_, b, dir, up, n) => `* ${b}...${up} [${dir === 'behind' ? 'behind' : 'ahead'} ${n}]`)
    .replace(/^On branch (\S+)\nYour branch and '([^']+)' have diverged,\nand have (\d+) and (\d+) different commits each, respectively\.$/m,
      '* $1...$2 [ahead $3, behind $4]')
    .replace(/^On branch (\S+)$/m, '* $1');
  return text.split('\n');
}

// Diff headers (`diff --git`, `index`, `---`, `+++`) → one path line.
function compactDiff(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^diff --git a\/(.*) b\/(.*)$/);
    if (!m) { out.push(lines[i]); continue; }
    let path = m[2];
    const notes = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const h = lines[j];
      let x;
      if (/^index [0-9a-f]+\.\.[0-9a-f]+/.test(h) || /^similarity index /.test(h) || /^dissimilarity index /.test(h)) continue;
      if ((x = h.match(/^new file mode (\d+)/))) { notes.push('new'); continue; }
      if ((x = h.match(/^deleted file mode (\d+)/))) { notes.push('deleted'); continue; }
      if ((x = h.match(/^old mode (\d+)/))) { notes.push(`mode ${x[1]}`); continue; }
      if ((x = h.match(/^new mode (\d+)/))) { notes.push(`-> ${x[1]}`); continue; }
      if ((x = h.match(/^(?:rename|copy) from (.*)/))) { path = `${x[1]} -> ${path}`; continue; }
      if (/^(?:rename|copy) to /.test(h)) continue;
      if ((x = h.match(/^--- (?:a\/(.*)|\/dev\/null)$/))) continue;
      if ((x = h.match(/^\+\+\+ (?:b\/(.*)|\/dev\/null)$/))) { if (x[1]) path = path.includes(' -> ') ? path : x[1]; continue; }
      break;
    }
    out.push(notes.length ? `${path} (${notes.join(' ')})` : path);
    i = j - 1;
  }
  return out;
}

// --stat blocks: drop the +/- bar and the alignment padding. Only lines in
// the run right above a ` N files changed` summary count, so a diff context
// line that happens to read ` Total | 42` is never touched.
const STAT_RE = /^ (\S.*?)\s+\|\s+(\d+(?= ?[+-]*$)|Bin .*)/;
function compactStat(lines) {
  const out = lines.slice();
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].match(/^ (\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?$/);
    if (!t) continue;
    out[i] = `${t[1]} file${t[1] === '1' ? '' : 's'}${t[2] ? ` +${t[2]}` : ''}${t[3] ? ` -${t[3]}` : ''}`;
    for (let j = i - 1, m; j >= 0 && (m = lines[j].match(STAT_RE)); j--) out[j] = `${m[1]} | ${m[2]}`;
  }
  return out;
}

const MONTHS = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const BODY_CAP = 3;

// Default `git log`/`git show` blocks → `hash subject (date author)`, body
// indented. Hash shortened to 10 (unambiguous in all but the largest
// repos; git's default 7 collides there), email dropped,
// date to the day, an author shared by every commit named once. With more
// than one commit, bodies past a cap become a count (`git show <hash>` has
// the rest). --stat file lists are never capped: a hidden file would read
// as "this commit did not touch it".
function compactGitLog(lines) {
  const commits = lines.filter(l => /^commit [0-9a-f]{40}/.test(l)).length;
  const many = commits > 1;
  const authors = new Set(lines.filter(l => /^Author:\s/.test(l)).map(l => l.replace(/^Author:\s+/, '').replace(/\s*<[^>]*>$/, '')));
  const oneAuthor = many && authors.size === 1 ? [...authors][0] : null;
  const out = oneAuthor ? [`(all by ${oneAuthor})`] : [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^commit ([0-9a-f]{40})(.*)$/);
    if (!m) { out.push(lines[i]); continue; }
    let meta = '';
    let merge = '';
    let j = i + 1;
    for (; j < lines.length; j++) {
      const h = lines[j].match(/^(Merge|Author|Date):\s+(.*)$/);
      if (!h) break;
      if (h[1] === 'Merge') merge = ` merge ${h[2]}`;
      else if (h[1] === 'Author') meta += oneAuthor ? '' : ` ${h[2].replace(/\s*<[^>]*>$/, '')}`;
      else {
        const d = h[2].match(/^\w{3} (\w{3}) (\d{1,2}) [\d:]+ (\d{4}) [+-]\d{4}$/);
        meta = ` ${d && MONTHS[d[1]] ? `${d[3]}-${MONTHS[d[1]]}-${d[2].padStart(2, '0')}` : h[2]}` + meta;
      }
    }
    if (lines[j] === '') j++;
    // Message: 4-space-indented lines (blank lines inside it dropped).
    const body = [];
    for (; j < lines.length && (lines[j].startsWith('    ') || lines[j].trim() === ''); j++) {
      if (lines[j].trim()) body.push(lines[j].slice(4));
      else if (j + 1 < lines.length && !lines[j + 1].startsWith('    ')) { j++; break; }
    }
    out.push(`${m[1].slice(0, 10)}${m[2]}${merge} ${body.shift() || ''} (${meta.trim()})`);
    const keep = many ? body.slice(0, BODY_CAP) : body;
    for (const b of keep) out.push(`  ${b}`);
    if (keep.length < body.length) out.push(`  [+${body.length - keep.length} lines]`);
    // Stat block or patch (if any) follows.
    for (; j < lines.length && !/^commit [0-9a-f]{40}/.test(lines[j]); j++) {
      if (many && !lines[j].trim()) continue;
      out.push(lines[j]);
    }
    i = j - 1;
  }
  return out;
}

// `git branch -a`: remote branches folded into one line per remote.
function compactBranches(lines, allRemote) {
  const out = [];
  const remotes = new Map();
  for (const l of lines) {
    const m = allRemote ? l.match(/^  ([^/\s]+)\/(\S+(?: -> \S+)?)$/) : l.match(/^  remotes\/([^/\s]+)\/(\S+(?: -> \S+)?)$/);
    if (!m) { out.push(l); continue; }
    if (!remotes.has(m[1])) { remotes.set(m[1], []); out.push(m[1]); }
    remotes.get(m[1]).push(m[2].replace(` -> ${m[1]}/`, ' -> '));
  }
  return out.map(l => (remotes.has(l) && !l.startsWith(' ') ? `${l}/: ${remotes.get(l).join(', ')}` : l));
}

// `ls -l`: octal mode, size, name. Owner named once up top unless it is you
// for every entry, then only where an entry differs; date only with -t
// (sorted by it). Link count, `total` and `..` dropped; `.` kept (the
// directory's own mode); ACL/xattr marks (`+`, `@`) kept on the mode.
const LS_RE = /^([-dlcbps])([rwxsStT-]{9})([.+@]?)\s+\d+\s+(\S+)\s+(\S+)\s+(\d+|\d+,\s*\d+|[\d.]+[KMGTP]?)\s+(\w{3}\s+\d{1,2}\s+(?:\d{1,2}:\d{2}|\d{4})|\d{4}-\d{2}-\d{2}(?: [\d:.]+(?: [+-]\d{4})?)?)\s(.+)$/;
let me = null;
try { me = require('os').userInfo().username; } catch (_) {}

function octal(perm) {
  let special = 0;
  let digits = '';
  for (let k = 0; k < 3; k++) {
    const t = perm.slice(k * 3, k * 3 + 3);
    let v = (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0);
    if ('xst'.includes(t[2])) v += 1;
    if ('sStT'.includes(t[2])) special += [4, 2, 1][k];
    digits += v;
  }
  return special ? special + digits : digits;
}

function compactLs(lines, keepDate) {
  const parsed = lines.map(l => l.match(LS_RE));
  const owners = new Map();
  for (const p of parsed) if (p) owners.set(`${p[4]}:${p[5]}`, (owners.get(`${p[4]}:${p[5]}`) || 0) + 1);
  const main = [...owners.entries()].sort((a, b) => b[1] - a[1])[0];
  const out = [];
  if (main && (owners.size > 1 || main[0].split(':')[0] !== me)) out.push(`(owner ${main[0]}${owners.size > 1 ? ' unless shown' : ''})`);
  lines.forEach((l, i) => {
    const p = parsed[i];
    if (!p) { if (!/^total \d/.test(l)) out.push(l); return; }
    let name = p[8];
    if (name === '..') return;
    const own = `${p[4]}:${p[5]}` === main[0] ? '' : ` ${p[4]}:${p[5]}`;
    const date = keepDate ? ` ${p[7].replace(/\s+/g, ' ')}` : '';
    if (p[1] === 'd') name += '/';
    const size = p[1] === 'd' ? '' : ` ${p[6]}`;
    const type = '-dl'.includes(p[1]) ? '' : p[1];
    out.push(`${type}${octal(p[2])}${p[3] === '.' ? '' : p[3]}${size}${own}${date} ${name}`);
  });
  return out;
}

// `wc`: column padding dropped; a directory shared by every path said once,
// as a header line like grep's.
function compactWc(lines) {
  const rows = lines.map(l => l.trim().split(/\s+/));
  const paths = rows.filter(r => r.length > 1 && r[r.length - 1] !== 'total').map(r => r[r.length - 1]);
  const dir = paths.length > 1 && paths[0].includes('/') ? paths[0].slice(0, paths[0].lastIndexOf('/') + 1) : '';
  const shared = dir && paths.every(p => p.startsWith(dir) && !p.slice(dir.length).includes('/'));
  const out = rows.map(r => {
    if (shared && r.length > 1 && r[r.length - 1] !== 'total') r[r.length - 1] = r[r.length - 1].slice(dir.length);
    return r.join(' ');
  });
  return shared ? [dir, ...out] : out;
}

// `grep -rn` / `rg`: `path:line:text` → path once, then `line:text`.
function groupGrep(lines) {
  const out = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^(.+?):(\d+):(.*)$/);
    const ctx = !m && cur && l.startsWith(cur + '-') && l.slice(cur.length).match(/^-(\d+)-(.*)$/);
    if (m) {
      if (m[1] !== cur) { cur = m[1]; out.push(cur); }
      out.push(`${m[2]}:${m[3]}`);
    } else if (ctx) out.push(`${ctx[1]}-${ctx[2]}`);
    else { if (l !== '--') cur = null; out.push(l); }
  }
  return out;
}

const PIPELINE_SAFE = /(?:error|fail|warn|denied|fatal|panic|exception|traceback)/i;

function filterCommand(command, text) {
  if (typeof text !== 'string' || !text) return null;
  const kinds = kindsFor(command);
  if (!kinds) return null;
  const segs = stripQuotes(command).split(/&&|\|\||;|\n/).map(s => s.trim() && classify(s.trim())).filter(Boolean);
  const has = (flag) => segs.some(c => c.flags.has(flag));

  // Progress bars redraw with \r; only the last frame was ever visible.
  let lines = text.replace(ANSI_RE, '').split('\n').map(l => {
    const t = l.replace(/\r$/, '');
    return t.includes('\r') ? t.split('\r').filter(Boolean).pop() || '' : t;
  });
  if (kinds.has('test')) lines = goVerbose(dropTapPasses(lines));
  lines = lines.filter(l => !DROP.some(([kind, re]) => kinds.has(kind) && re.test(l) && !(kind !== 'test' && PIPELINE_SAFE.test(l))));
  if (kinds.has('test')) lines = compactCargo(lines);
  if (kinds.has('git-status')) lines = shortStatus(lines);
  if (kinds.has('git-diff')) lines = compactStat(compactDiff(lines));
  if (kinds.has('git-log')) lines = compactGitLog(lines);
  if (kinds.has('git-branch')) lines = compactBranches(lines, has('r') || has('--remotes'));
  if (kinds.has('ls')) lines = compactLs(lines, has('t'));
  if (kinds.has('wc') && kinds.size === 1) lines = compactWc(lines);
  if (kinds.has('grep') && kinds.size === 1) lines = groupGrep(lines);

  const out = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  return out.length < text.replace(/^\n+|\n+$/g, '').length ? out : null;
}

module.exports = { filterCommand, kindsFor, wrappable };
