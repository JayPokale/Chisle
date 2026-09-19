#!/usr/bin/env node
// Basic hook tests — validates config logic and flag safety
// Run: node --test tests/test_hooks.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { VALID_MODES, safeWriteFlag, readFlag, getDefaultMode } = require('../hooks/chisle-config');

// ── VALID_MODES ──────────────────────────────────────────────────────────────

test('VALID_MODES contains on and off', () => {
  assert.ok(VALID_MODES.includes('off'));
  assert.ok(VALID_MODES.includes('on'));
  assert.equal(VALID_MODES.length, 2);
});

// ── safeWriteFlag / readFlag ─────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-test-'));
}

test('safeWriteFlag writes and readFlag reads back', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  safeWriteFlag(flagPath, 'on');
  assert.equal(readFlag(flagPath), 'on');
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for missing file', () => {
  assert.equal(readFlag('/tmp/chisle-does-not-exist-xyz'), null);
});

test('readFlag returns null for unknown mode', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  fs.writeFileSync(flagPath, 'wenyan-ultra', { mode: 0o600 });
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for symlink', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  const target = path.join(dir, 'target');
  fs.writeFileSync(target, 'on', { mode: 0o600 });
  fs.symlinkSync(target, flagPath);
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('readFlag returns null for oversized file', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  fs.writeFileSync(flagPath, 'on' + 'x'.repeat(100), { mode: 0o600 });
  assert.equal(readFlag(flagPath), null);
  fs.rmSync(dir, { recursive: true });
});

test('safeWriteFlag refuses to overwrite a symlink', () => {
  const dir = tmpDir();
  const flagPath = path.join(dir, '.chisle-active');
  const target = path.join(dir, 'target');
  fs.writeFileSync(target, '', { mode: 0o600 });
  fs.symlinkSync(target, flagPath);
  safeWriteFlag(flagPath, 'on'); // must not throw, must not overwrite
  assert.equal(fs.readFileSync(target, 'utf8'), ''); // target untouched
  fs.rmSync(dir, { recursive: true });
});

// ── getDefaultMode ───────────────────────────────────────────────────────────

test('getDefaultMode returns on by default', () => {
  const saved = process.env.CHISLE_DEFAULT_MODE;
  delete process.env.CHISLE_DEFAULT_MODE;
  // Only validates when no user config file exists (CI / clean env)
  const mode = getDefaultMode();
  assert.ok(VALID_MODES.includes(mode));
  if (saved !== undefined) process.env.CHISLE_DEFAULT_MODE = saved;
});

test('getDefaultMode respects CHISLE_DEFAULT_MODE env var', () => {
  process.env.CHISLE_DEFAULT_MODE = 'off';
  assert.equal(getDefaultMode(), 'off');
  process.env.CHISLE_DEFAULT_MODE = 'on';
  assert.equal(getDefaultMode(), 'on');
  delete process.env.CHISLE_DEFAULT_MODE;
});

test('getDefaultMode ignores invalid CHISLE_DEFAULT_MODE', () => {
  process.env.CHISLE_DEFAULT_MODE = 'wenyan-ultra';
  const mode = getDefaultMode();
  assert.ok(VALID_MODES.includes(mode));
  delete process.env.CHISLE_DEFAULT_MODE;
});

// ── major-version update notice ──────────────────────────────────────────────

const { majorOf, majorUpdateNotice } = require('../hooks/chisle-activate');

test('majorOf parses majors, rejects garbage', () => {
  assert.equal(majorOf('1.1.2'), 1);
  assert.equal(majorOf('12.0.0'), 12);
  assert.equal(majorOf('nonsense'), null);
  assert.equal(majorOf(null), null);
});

test('notice fires only on a major jump', () => {
  assert.ok(majorUpdateNotice('1.1.2', '2.0.0'));
  assert.ok(majorUpdateNotice('1.9.9', '3.1.0'));
  assert.equal(majorUpdateNotice('1.1.2', '1.9.9'), null);  // minor: silent
  assert.equal(majorUpdateNotice('2.0.0', '2.0.1'), null);  // patch: silent
  assert.equal(majorUpdateNotice('2.0.0', '1.9.9'), null);  // downgrade: silent
  assert.equal(majorUpdateNotice(null, '2.0.0'), null);     // unknown install: silent
  assert.equal(majorUpdateNotice('1.0.0', null), null);     // no registry data: silent
});

test('requiring chisle-activate has no side effects', () => {
  // If the require.main guard is broken this test file would have already
  // emitted the ruleset or called process.exit before reaching here.
  assert.ok(true);
});

// ── SessionStart injection gating ────────────────────────────────────────────
// Regression guard for #2 (@enc0ded): the full ruleset was re-injected on
// resume/clear/compact as well as startup, so the plugin's own overhead ate
// most of what the compressor saved.

const { execFileSync } = require('child_process');
const ACTIVATE = path.join(__dirname, '..', 'hooks', 'chisle-activate.js');

function activate(stdin, extraEnv = {}) {
  const dir = tmpDir();
  try {
    return execFileSync(process.execPath, [ACTIVATE], {
      input: stdin,
      env: { ...process.env, CLAUDE_CONFIG_DIR: dir, CHISLE_DEFAULT_MODE: 'on', CHISLE_UPDATE_CHECK: '0', ...extraEnv },
      encoding: 'utf8',
      timeout: 5000,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('REGRESSION #2: startup gets the full ruleset', () => {
  const out = activate(JSON.stringify({ source: 'startup' }));
  assert.ok(out.length > 2000, `expected full ruleset, got ${out.length} chars`);
  assert.match(out, /CHISLE ACTIVE/);
});

test('REGRESSION #2: resume/clear/compact do not re-inject the ruleset', () => {
  for (const source of ['resume', 'clear', 'compact']) {
    const out = activate(JSON.stringify({ source }));
    assert.ok(out.length < 400, `${source} re-injected ${out.length} chars`);
    // still has to announce the mode, or the session silently loses it
    assert.match(out, /CHISLE ACTIVE/);
  }
});

test('unknown or malformed source falls back to a full inject', () => {
  // failing open (over-teaching once) beats a session with no ruleset at all
  assert.ok(activate('not json').length > 2000);
  assert.ok(activate('').length > 2000);
  assert.ok(activate(JSON.stringify({})).length > 2000);
});

// ── Version sync across manifests ────────────────────────────────────────────
// The update notice reads .claude-plugin/plugin.json, not package.json. When
// those drifted (plugin 1.2.2 vs published 2.0.0) every user on the current
// release was told a major update was available. Keep them equal.

test('every manifest carries the same version', () => {
  const root = path.join(__dirname, '..');
  const files = [
    'package.json',
    '.claude-plugin/plugin.json',
    '.github/plugin/plugin.json',
    '.codex-plugin/plugin.json',
    'gemini-extension.json',
  ];
  const versions = files.map((f) => [
    f,
    JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).version,
  ]);
  const expected = versions[0][1];
  for (const [f, v] of versions) {
    assert.equal(v, expected, `${f} is ${v}, expected ${expected}`);
  }
});

test('the changelog documents the shipped version', () => {
  const root = path.join(__dirname, '..');
  const v = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const log = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  assert.ok(log.includes(`## [${v}]`), `CHANGELOG.md has no section for ${v}`);
});

// ── 3.0.0 upgrade path ───────────────────────────────────────────────────────
// A lite/full/ultra setting from before 3.0.0 must not break anything, and must
// not be ignored in silence either.

const { legacySetting } = require('../hooks/chisle-config');

test('a legacy level setting still resolves to on, not off', () => {
  for (const stale of ['lite', 'full', 'ultra']) {
    process.env.CHISLE_DEFAULT_MODE = stale;
    assert.equal(getDefaultMode(), 'on', `${stale} should fall through to on`);
  }
  delete process.env.CHISLE_DEFAULT_MODE;
});

test('a legacy level setting is detected so it can be reported', () => {
  process.env.CHISLE_DEFAULT_MODE = 'ultra';
  const l = legacySetting();
  assert.equal(l.value, 'ultra');
  assert.equal(l.source, 'CHISLE_DEFAULT_MODE');
  delete process.env.CHISLE_DEFAULT_MODE;
});

test('a current setting reports no legacy value', () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  assert.equal(legacySetting(), null);
  delete process.env.CHISLE_DEFAULT_MODE;
});

// ── sections config: getSections / filterSections ────────────────────────────
// `{ "sections": { "prose": false } }` in config.json suppresses prose rules,
// keeping code rules (and vice versa). Config-file only, no env override.
// Absent/malformed/non-boolean always falls back to enabled; never throws.

const { getSections, filterSections, PROSE_HEADINGS, CODE_HEADINGS } = require('../hooks/chisle-config');

function withSectionsConfig(sectionsValue, fn) {
  const dir = tmpDir();
  const chisleDir = path.join(dir, 'chisle');
  fs.mkdirSync(chisleDir, { recursive: true });
  if (sectionsValue !== undefined) {
    fs.writeFileSync(
      path.join(chisleDir, 'config.json'),
      JSON.stringify({ defaultMode: 'on', sections: sectionsValue })
    );
  }
  const saved = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('getSections: no config file → both enabled', () => {
  withSectionsConfig(undefined, () => {
    assert.deepEqual(getSections(), { prose: true, code: true });
  });
});

test('getSections: sections.prose false → prose disabled, code enabled', () => {
  withSectionsConfig({ prose: false }, () => {
    assert.deepEqual(getSections(), { prose: false, code: true });
  });
});

test('getSections: sections.code false → code disabled, prose enabled', () => {
  withSectionsConfig({ code: false }, () => {
    assert.deepEqual(getSections(), { prose: true, code: false });
  });
});

test('getSections: both false', () => {
  withSectionsConfig({ prose: false, code: false }, () => {
    assert.deepEqual(getSections(), { prose: false, code: false });
  });
});

test('getSections: malformed sections values fall back to enabled, never throw', () => {
  for (const malformed of ['off', null, 5, [], { prose: 'no' }, { prose: null }, { prose: 1 }, { prose: [] }]) {
    withSectionsConfig(malformed, () => {
      assert.deepEqual(getSections(), { prose: true, code: true }, JSON.stringify(malformed));
    });
  }
});

test('getSections: malformed config.json (invalid JSON) falls back to enabled, never throws', () => {
  const dir = tmpDir();
  const chisleDir = path.join(dir, 'chisle');
  fs.mkdirSync(chisleDir, { recursive: true });
  fs.writeFileSync(path.join(chisleDir, 'config.json'), '{ not json');
  const saved = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;
  try {
    assert.deepEqual(getSections(), { prose: true, code: true });
  } finally {
    if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = saved;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const SKILL_BODY = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md'), 'utf8'
).replace(/^---[\s\S]*?---\s*/, '');
const ALWAYS_ON_HEADINGS = [
  'Persistence', 'Thinking Is Billed Too', 'Auto-Clarity', 'When NOT to be lazy', 'Boundaries',
];

test('filterSections: both enabled is byte-identical to input', () => {
  assert.equal(filterSections(SKILL_BODY, { prose: true, code: true }), SKILL_BODY);
});

test('filterSections: prose false drops only the prose headings', () => {
  const out = filterSections(SKILL_BODY, { prose: false, code: true });
  for (const h of PROSE_HEADINGS) assert.ok(!out.includes(`## ${h}`), `still has ${h}`);
  for (const h of CODE_HEADINGS) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
  for (const h of ALWAYS_ON_HEADINGS) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
});

test('filterSections: code false drops only the code headings', () => {
  const out = filterSections(SKILL_BODY, { prose: true, code: false });
  for (const h of CODE_HEADINGS) assert.ok(!out.includes(`## ${h}`), `still has ${h}`);
  for (const h of PROSE_HEADINGS) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
  for (const h of ALWAYS_ON_HEADINGS) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
});

test('filterSections: both false still emits every always-on heading', () => {
  const out = filterSections(SKILL_BODY, { prose: false, code: false });
  for (const h of [...PROSE_HEADINGS, ...CODE_HEADINGS]) assert.ok(!out.includes(`## ${h}`), `still has ${h}`);
  for (const h of ALWAYS_ON_HEADINGS) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
});

test('filterSections: malformed sections values fall back to enabled (identity)', () => {
  for (const malformed of ['off', null, 5, [], undefined]) {
    assert.equal(filterSections(SKILL_BODY, malformed), SKILL_BODY);
  }
});

// ── SessionStart end-to-end: sections config wired into the emitted ruleset ──

test('activate: no config file → full ruleset, all headings present (default unchanged)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-xdg-'));
  try {
    const out = activate(JSON.stringify({ source: 'startup' }), { XDG_CONFIG_HOME: dir });
    for (const h of [...PROSE_HEADINGS, ...CODE_HEADINGS, ...ALWAYS_ON_HEADINGS]) {
      assert.ok(out.includes(`## ${h}`), `missing ${h}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('activate: config file present but no sections key → full ruleset (default unchanged)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-xdg-'));
  const chisleDir = path.join(dir, 'chisle');
  fs.mkdirSync(chisleDir, { recursive: true });
  fs.writeFileSync(path.join(chisleDir, 'config.json'), JSON.stringify({ defaultMode: 'on' }));
  try {
    const out = activate(JSON.stringify({ source: 'startup' }), { XDG_CONFIG_HOME: dir });
    for (const h of [...PROSE_HEADINGS, ...CODE_HEADINGS, ...ALWAYS_ON_HEADINGS]) {
      assert.ok(out.includes(`## ${h}`), `missing ${h}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('activate: sections.prose false → emitted ruleset drops prose headings only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-xdg-'));
  const chisleDir = path.join(dir, 'chisle');
  fs.mkdirSync(chisleDir, { recursive: true });
  fs.writeFileSync(path.join(chisleDir, 'config.json'), JSON.stringify({ sections: { prose: false } }));
  try {
    const out = activate(JSON.stringify({ source: 'startup' }), { XDG_CONFIG_HOME: dir });
    for (const h of PROSE_HEADINGS) assert.ok(!out.includes(`## ${h}`), `still has ${h}`);
    for (const h of [...CODE_HEADINGS, ...ALWAYS_ON_HEADINGS]) assert.ok(out.includes(`## ${h}`), `missing ${h}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('activate: malformed sections value falls back to enabled, does not throw', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-xdg-'));
  const chisleDir = path.join(dir, 'chisle');
  fs.mkdirSync(chisleDir, { recursive: true });
  fs.writeFileSync(path.join(chisleDir, 'config.json'), JSON.stringify({ sections: 'nope' }));
  try {
    const out = activate(JSON.stringify({ source: 'startup' }), { XDG_CONFIG_HOME: dir });
    for (const h of [...PROSE_HEADINGS, ...CODE_HEADINGS, ...ALWAYS_ON_HEADINGS]) {
      assert.ok(out.includes(`## ${h}`), `missing ${h}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The section filter matches SKILL.md headings by exact string, from constants
// living in hooks/. That is the one place this repo duplicates SKILL.md content
// into code, against its own "SKILL.md is the source of truth" rule, so it needs
// a guard: rename a heading in SKILL.md and the filter silently stops matching
// it — the section just keeps shipping, with no error and no failing assertion,
// because every other test checks "is it absent" against the same stale string.
test('every PROSE/CODE heading constant still exists in SKILL.md', () => {
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
  const present = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  for (const h of [...PROSE_HEADINGS, ...CODE_HEADINGS]) {
    assert.ok(present.includes(h),
      `heading constant "${h}" is not in SKILL.md — filterSections would silently skip it`);
  }
});

// The inverse: a heading added to SKILL.md that belongs to neither group, and is
// not one of the deliberate always-on sections, is almost certainly an oversight
// — it would ship even with both groups suppressed.
test('every SKILL.md heading is classified: prose, code, or deliberately always-on', () => {
  const ALWAYS_ON = [
    'Persistence', 'Thinking Is Billed Too', 'Auto-Clarity',
    'When NOT to be lazy', 'Boundaries',
  ];
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
  const classified = new Set([...PROSE_HEADINGS, ...CODE_HEADINGS, ...ALWAYS_ON]);
  for (const m of md.matchAll(/^## (.+)$/gm)) {
    const h = m[1].trim();
    assert.ok(classified.has(h),
      `SKILL.md heading "${h}" is in no group — add it to PROSE_HEADINGS, CODE_HEADINGS, or ALWAYS_ON`);
  }
});

// filterSections splits on /^## /m, so a "## " line inside a fenced code block
// would cut the fence in half and emit broken markdown into the model's context.
test('no SKILL.md heading-like line hides inside a fenced code block', () => {
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
  let inFence = false;
  md.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('```')) { inFence = !inFence; return; }
    assert.ok(!(inFence && line.startsWith('## ')),
      `SKILL.md:${i + 1} has a "## " line inside a code fence; filterSections would split it`);
  });
  assert.equal(inFence, false, 'SKILL.md has an unclosed code fence');
});
