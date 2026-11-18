// chisle — command-aware output filters (RTK-style, but post-hoc).
//
// The size tiers in chisle-compress-output.js only start at 1k/8k chars and
// know nothing about which command ran. Most shell noise is smaller and
// command-specific: git's "(use git add ...)" hints, passing-test lines,
// install/download progress. Knowing the command lets us drop exactly those
// lines at any size, from inside the hook that already runs, so it works on
// every OS and harness Chisle hooks, with no wrapper binary and no command
// rewriting.
//
// Safety rules:
//   - Only commands we recognise are touched; anything else returns null.
//   - A segment piped into anything but head/tail is skipped: the agent shaped
//     that output itself (`npm i | grep WARN` must keep its WARN lines).
//     That is also the escape hatch the marker advertises: `| cat` = raw.
//   - Only passing/progress/hint lines are dropped. Failures, errors,
//     warnings and summaries are never matched by a drop rule.
//   - Output already filtered by rtk (`rtk git status`) is left alone.

const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// Wrappers that run another program: skip them to find the real one.
const RUNNERS = new Set(['sudo', 'time', 'command', 'exec', 'nice', 'env', 'npx', 'bunx', 'pnpx']);
const RUNNER_PAIRS = /^(?:(?:pnpm|yarn) (?:exec|dlx)|(?:uv|poetry|pipenv|rye|hatch|pdm) run|bundle exec|python[\d.]* -m|py -m)\s+/;

const TEST_PROGRAMS = new Set(['pytest', 'py.test', 'jest', 'vitest', 'mocha', 'ava', 'tap', 'rspec', 'phpunit']);
const PKG_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);

function stripQuotes(command) {
  return command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
}

// One command segment → set of filter kinds, or null if unknown/piped.
function classify(segment) {
  const parts = segment.split('|').map(s => s.trim());
  const pipedTo = parts.slice(1).map(p => p.split(/\s+/)[0]);
  if (pipedTo.some(p => p !== 'head' && p !== 'tail')) return null;

  let s = parts[0].replace(/^(?:\w+=\S*\s+)+/, '');
  for (;;) {
    const word = s.split(/\s+/)[0];
    if (RUNNERS.has(word)) { s = s.slice(word.length).trim().replace(/^(?:\w+=\S*\s+)+/, ''); continue; }
    const pair = s.match(RUNNER_PAIRS);
    if (pair) { s = s.slice(pair[0].length); continue; }
    break;
  }
  const words = s.split(/\s+/).filter(w => w && !/^[<>]|^\d>/.test(w));
  const prog = (words[0] || '').replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd)$/i, '');
  // First non-option argument after the program, skipping `-C dir`-style pairs.
  let sub = '';
  for (let i = 1; i < words.length; i++) {
    if (/^-[Cc]$/.test(words[i])) { i++; continue; }
    if (!words[i].startsWith('-')) { sub = words[i]; break; }
  }

  const kinds = new Set();
  if (prog === 'rtk') return null;
  if (prog === 'git') {
    if (sub === 'status') kinds.add('git-status');
    if (/^(?:push|pull|fetch|clone)$/.test(sub)) kinds.add('progress');
    if (sub === 'log' && !/--(?:format|pretty|oneline)\b|--graph\b/.test(s)) kinds.add('git-log');
  }
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
  return kinds.size ? kinds : null;
}

function kindsFor(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  const kinds = new Set();
  for (const seg of stripQuotes(command).split(/&&|\|\||;|\n/)) {
    const k = seg.trim() && classify(seg.trim());
    if (k) for (const x of k) kinds.add(x);
  }
  return kinds.size ? kinds : null;
}

// ── Drop rules: [kind, label, regex] ─────────────────────────────────────────
const DROP = [
  ['git-status', 'git hint', /^\s*\((?:use "git |commit or discard )[^)]*\)\s*$/],
  ['progress', 'progress', /^(?:remote: )?(?:Enumerating|Counting|Compressing|Writing|Receiving|Unpacking) objects:|^(?:remote: )?Resolving deltas:|^(?:remote: )?Total \d+ \(delta|^Delta compression using|^(?:Updating|Checking out) files:/],
  // npm / pnpm
  ['progress', 'progress', /^\d+ packages? (?:is|are) looking for funding$|^\s*run `npm fund` for details$|^Progress: resolved \d+|^\+{5,}$/],
  // pip
  ['progress', 'progress', /^Requirement already satisfied: |^\s*(?:Collecting|Downloading|Using cached|Obtaining) \S|^\s*━+/],
  // cargo / go
  ['progress', 'progress', /^\s+(?:Compiling|Checking|Downloaded|Downloading|Fresh|Locking|Adding|Blocking) \S|^\s+Updating crates\.io index$|^go: (?:downloading|finding|extracting) /],
  // docker pull / buildkit
  ['progress', 'progress', /^[0-9a-f]{12}: (?:Pulling fs layer|Waiting|Verifying Checksum|Download complete|Pull complete|Already exists|Downloading|Extracting)|^#\d+ (?:sha256:[0-9a-f]+ [\d.]+[kMG]?B \/|transferring |extracting sha256:)/],
  // passing tests: pytest dots/-v, jest/vitest/mocha/node spec ticks, cargo, go
  ['test', 'passing-test', /^\S+\.py\s+[.sx]+\s*\[\s*\d+%\]$|^\S+::\S.*\sPASSED(?:\s+\[\s*\d+%\])?$|^\s*[✓✔√]\s|^\s*PASS\s+\S|^\s*▶\s|^test \S+ \.\.\. ok$|^=== (?:RUN|PAUSE|CONT|NAME)\s|^\s*--- PASS: |^\s*# Subtest: /],
];

// node --test TAP: `ok N - name` plus its indented YAML block.
function dropTapPasses(lines, counts) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*ok \d+ - /.test(lines[i])) {
      counts['passing-test'] = (counts['passing-test'] || 0) + 1;
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

// Default `git log` blocks → one header line + 2-space-indented message.
// Hash shortened to 12 (still a valid ref); name, email and date kept verbatim.
function compactGitLog(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^commit ([0-9a-f]{40})(.*)$/);
    if (!m) { out.push(lines[i].trim() ? lines[i].replace(/^ {4}/, '  ') : ''); continue; }
    let head = m[1].slice(0, 12) + m[2];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const h = lines[j].match(/^(Merge|Author|Date):\s+(.*)$/);
      if (!h) break;
      head += h[1] === 'Merge' ? ' merge ' + h[2] : ' · ' + h[2];
    }
    out.push(head);
    if (lines[j] === '') j++;
    i = j - 1;
  }
  return out;
}

const PIPELINE_SAFE = /(?:error|fail|warn|denied|fatal|panic|exception|traceback)/i;

function filterCommand(command, text) {
  if (typeof text !== 'string' || !text) return null;
  const kinds = kindsFor(command);
  if (!kinds) return null;

  // Progress bars redraw with \r; only the last frame was ever visible.
  let lines = text.replace(ANSI_RE, '').split('\n').map(l => {
    const t = l.replace(/\r$/, '');
    return t.includes('\r') ? t.split('\r').filter(Boolean).pop() || '' : t;
  });
  const counts = {};
  if (kinds.has('test')) lines = dropTapPasses(lines, counts);
  lines = lines.filter(l => {
    for (const [kind, label, re] of DROP) {
      if (kinds.has(kind) && re.test(l) && !(kind !== 'test' && PIPELINE_SAFE.test(l))) {
        counts[label] = (counts[label] || 0) + 1;
        return false;
      }
    }
    return true;
  });
  if (kinds.has('git-log')) lines = compactGitLog(lines);
  if (kinds.has('git-status')) {
    lines = lines.map(l => l.replace(/^no changes added to commit \(use .*\)$/, 'no changes added to commit'));
  }

  const dropped = Object.entries(counts).map(([k, n]) => `${n} ${k} line${n === 1 ? '' : 's'}`);
  if (dropped.length) lines.push(`[chisle: hid ${dropped.join(', ')}; "| cat" shows all]`);
  const out = lines.join('\n');
  return out.length < text.length ? out : null;
}

module.exports = { filterCommand, kindsFor };
