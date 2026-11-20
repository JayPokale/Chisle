#!/usr/bin/env node
// OpenCode tool-output compression tests — allowlist, compression decision,
// and the plugin's tool.execute.after hook mutating output in place.
// Run: node --test tests/test_opencode.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { symlinkSkip } = require('./fixtures/symlinks');
const { spawn, spawnSync } = require('child_process');

// State (spill/dedup) must not leak into ~/.claude during tests.
process.env.CHISLE_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-'));

const opencodeCore = require('../hooks/chisle-compress-output');
const {
  opencodeToolAllowed, compressForOpencode, boundForOpencode, recordSavings,
  SAFE_TOOLS_OPENCODE, THRESHOLDS,
} = opencodeCore;
const { getOpencodeDir, getOpencodeStateDir } = require('../hooks/chisle-config');

function bigOutput(lines, prefix) {
  return Array.from({ length: lines }, (_, i) => `${prefix || 'line'} ${i} ${'x'.repeat(80)}`).join('\n');
}

function recoveryPath(output) {
  const match = output.match(/Full output: (.+?) \(grep it, do not re-run\)/);
  assert.ok(match);
  return match[1];
}

function hasUnpairedSurrogate(value) {
  return /[\uD800-\uDFFF]/u.test(value);
}

function sessionStateFile(stateDir, sessionId) {
  const name = crypto.createHash('sha256').update(sessionId).digest('hex') + '.json';
  return path.join(stateDir, 'chisle-dedup', name);
}

// ── config root ──────────────────────────────────────────────────────────────

test('OpenCode root follows host precedence and keeps an injectable home fallback', () => {
  const home = path.join(os.tmpdir(), 'chisle-home');
  assert.equal(getOpencodeDir({ env: {}, home }), path.join(home, '.config', 'opencode'));
  assert.equal(getOpencodeDir({ env: { XDG_CONFIG_HOME: '/xdg' }, home }), path.join('/xdg', 'opencode'));
  assert.equal(getOpencodeDir({ env: { XDG_CONFIG_HOME: '/xdg', OPENCODE_CONFIG_DIR: '/custom' }, home }), '/custom');
});

test('OpenCode state uses its config root unless CHISLE_STATE_DIR overrides it', () => {
  const home = path.join(os.tmpdir(), 'chisle-home');
  assert.equal(getOpencodeStateDir({ env: { OPENCODE_CONFIG_DIR: '/custom' }, home }), '/custom');
  assert.equal(getOpencodeStateDir({ env: { OPENCODE_CONFIG_DIR: '/custom', CHISLE_STATE_DIR: '/state' }, home }), '/state');
});

// ── allowlist ────────────────────────────────────────────────────────────────

test('opencodeToolAllowed allows only explicit read-heavy defaults', () => {
  const previous = process.env.CHISLE_COMPRESS_TOOLS;
  delete process.env.CHISLE_COMPRESS_TOOLS;
  try {
    assert.deepEqual(SAFE_TOOLS_OPENCODE, ['bash', 'shell', 'grep', 'glob', 'webfetch', 'websearch', 'list']);
    for (const t of SAFE_TOOLS_OPENCODE) assert.equal(opencodeToolAllowed(t), true, t);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS_TOOLS;
    else process.env.CHISLE_COMPRESS_TOOLS = previous;
  }
});

test('opencodeToolAllowed excludes source-bearing and mutating tools', () => {
  for (const t of [
    'read', 'edit', 'write', 'patch', 'apply_patch', 'multiedit',
    'notebookedit', 'notebookread', 'notebook_write', 'notebook_edit',
    'create', 'str_replace', 'insert', 'todowrite', 'todoread',
  ]) assert.equal(opencodeToolAllowed(t), false, t);
});

test('OpenCode source tools stay protected even in an explicit allowlist', () => {
  const previous = process.env.CHISLE_COMPRESS_TOOLS;
  const protectedTools = [
    'lsp',
    'github-tools_get_file_contents', 'github-tools_search_code',
    'github-com_get_file_contents', 'github-com_search_code',
    'github_tools_get_file_contents', 'github_tools_search_code',
    'github_com_get_file_contents', 'github_com_search_code',
  ];
  process.env.CHISLE_COMPRESS_TOOLS = [...protectedTools, 'glob', 'custom_report'].join(',');
  try {
    for (const tool of protectedTools) {
      assert.equal(opencodeToolAllowed(tool), false, tool);
      assert.equal(compressForOpencode(tool, bigOutput(500), { mode: 'on' }), null, tool);
    }
    assert.equal(opencodeToolAllowed('glob'), true);
    assert.equal(opencodeToolAllowed('custom_report'), true);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS_TOOLS;
    else process.env.CHISLE_COMPRESS_TOOLS = previous;
  }
});

test('opencodeToolAllowed does not infer safety from underscores', () => {
  assert.equal(opencodeToolAllowed('github-tools_search_code'), false);
  assert.equal(opencodeToolAllowed('unknown_mcp_tool'), false);
});

test('opencodeToolAllowed rejects junk', () => {
  assert.equal(opencodeToolAllowed(''), false);
  assert.equal(opencodeToolAllowed(null), false);
  assert.equal(opencodeToolAllowed(undefined), false);
});

test('CHISLE_COMPRESS_TOOLS override is an exact allowlist', () => {
  process.env.CHISLE_COMPRESS_TOOLS = 'bash,grep';
  try {
    assert.equal(opencodeToolAllowed('bash'), true);
    assert.equal(opencodeToolAllowed('glob'), false);       // not in override
    assert.equal(opencodeToolAllowed('github-tools_x'), false); // override wins over MCP heuristic
  } finally {
    delete process.env.CHISLE_COMPRESS_TOOLS;
  }
});

test('CHISLE_COMPRESS_TOOLS allows explicit MCP tools but not protected tools', () => {
  process.env.CHISLE_COMPRESS_TOOLS = 'custom_report,read,edit,write,patch,multiedit,notebookread';
  try {
    assert.equal(opencodeToolAllowed('custom_report'), true);
    for (const t of ['read', 'edit', 'write', 'patch', 'multiedit', 'notebookread']) {
      assert.equal(opencodeToolAllowed(t), false, t);
    }
  } finally {
    delete process.env.CHISLE_COMPRESS_TOOLS;
  }
});

// ── compression decision ─────────────────────────────────────────────────────

test('compressForOpencode elides a big bash output', () => {
  const text = bigOutput(500);
  const out = compressForOpencode('bash', text, { mode: 'on' });
  assert.ok(out && out.length < text.length);
  assert.match(out, /chisle: elided/);
});

test('compressForOpencode leaves small output untouched', () => {
  const out = compressForOpencode('bash', 'short output', { mode: 'on' });
  assert.equal(out, null);
});

test('compressForOpencode never touches read output even when huge', () => {
  const out = compressForOpencode('read', bigOutput(500), { mode: 'on' });
  assert.equal(out, null);
});

test('compressForOpencode honors mode off and the kill switch', () => {
  const text = bigOutput(500);
  assert.equal(compressForOpencode('bash', text, { mode: 'off' }), null);
  process.env.CHISLE_COMPRESS = '0';
  try {
    assert.equal(compressForOpencode('bash', text, { mode: 'on' }), null);
  } finally {
    delete process.env.CHISLE_COMPRESS;
  }
});

test('compressForOpencode salvages error lines from the elided middle', () => {
  const lines = [];
  for (let i = 0; i < 60; i++) lines.push(`head ${i}`);
  lines.push('ERROR: the one line that mattered');
  for (let i = 0; i < 400; i++) lines.push(`noise ${i} ${'y'.repeat(60)}`);
  for (let i = 0; i < 40; i++) lines.push(`tail ${i}`);
  const out = compressForOpencode('bash', lines.join('\n'), { mode: 'on' });
  assert.match(out, /ERROR: the one line that mattered/);
});

test('salvage matches severities inside underscore codes and ERR!, not inside words (#38)', () => {
  const keep = ['FATAL_MEMORY_PROBE: id-1', 'APP_ERROR_CODE: id-2', 'WARNING_LIMIT: id-3', 'npm ERR! code E404', 'ERR!attached'];
  const drop = ['fatalistic outlook', 'terror level', 'warningly said'];
  const lines = Array.from({ length: 450 }, (_, i) => `build ${i} ${'x'.repeat(70)}`);
  [...keep, ...drop].forEach((l, i) => lines.splice(200 + i * 5, 0, l));
  const out = compressForOpencode('bash', lines.join('\n'), { mode: 'on' });
  for (const l of keep) assert.ok(out.includes(l), 'dropped: ' + l);
  for (const l of drop) assert.ok(!out.includes(l), 'salvaged: ' + l);
});

test('maxChars is a final bound for long lines with late errors', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-bound-'));
  process.env.CHISLE_COMPRESS_MAX_CHARS = '4000';
  try {
    const text = [
      `BEGIN ${'a'.repeat(5000)}`,
      `${'b'.repeat(5000)} FATAL LATE_ERROR ${'c'.repeat(5000)}`,
      `${'d'.repeat(5000)} END`,
    ].join('\n');
    const out = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.ok(out.length <= 4000);
    assert.match(out, /BEGIN/);
    assert.match(out, /END/);
    assert.match(out, /FATAL LATE_ERROR/);
    assert.equal(fs.readFileSync(recoveryPath(out), 'utf8'), text);
  } finally {
    delete process.env.CHISLE_COMPRESS_MAX_CHARS;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('maxChars remains exact at its smallest valid value', () => {
  const previous = process.env.CHISLE_COMPRESS_MAX_CHARS;
  process.env.CHISLE_COMPRESS_MAX_CHARS = '1';
  try {
    assert.equal(compressForOpencode('bash', 'x'.repeat(5000), { mode: 'on' }).length, 1);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS_MAX_CHARS;
    else process.env.CHISLE_COMPRESS_MAX_CHARS = previous;
  }
});

test('maxChars bounds short output and duplicate markers', () => {
  const previous = process.env.CHISLE_COMPRESS_MAX_CHARS;
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-small-bound-'));
  try {
    process.env.CHISLE_COMPRESS_MAX_CHARS = '1';
    assert.equal(compressForOpencode('bash', 'x'.repeat(100), { mode: 'on', stateDir }).length, 1);
    process.env.CHISLE_COMPRESS_MAX_CHARS = '1000';
    const text = Array(5).fill('x'.repeat(300)).join('\n') + '\n' + 'y'.repeat(3000);
    const opts = { mode: 'on', stateDir, sessionId: 'bounded-dedup' };
    compressForOpencode('bash', text, { ...opts, callId: 'first' });
    const duplicate = compressForOpencode('bash', text, { ...opts, callId: 'second' });
    assert.ok(duplicate.length <= 1000);
    assert.match(duplicate, /byte-identical/);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS_MAX_CHARS;
    else process.env.CHISLE_COMPRESS_MAX_CHARS = previous;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('small bounds retain late diagnostics and head/tail context', () => {
  const previous = process.env.CHISLE_COMPRESS_MAX_CHARS;
  process.env.CHISLE_COMPRESS_MAX_CHARS = '1000';
  try {
    const text = `BEGIN ${'a'.repeat(5000)} FATAL LATE_ERROR ${'b'.repeat(5000)} END`;
    const out = compressForOpencode('bash', text, { mode: 'on' });
    assert.ok(out.length <= 1000);
    assert.match(out, /BEGIN/);
    assert.match(out, /FATAL LATE_ERROR/);
    assert.match(out, /END/);
    assert.equal(fs.readFileSync(recoveryPath(out), 'utf8'), text);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS_MAX_CHARS;
    else process.env.CHISLE_COMPRESS_MAX_CHARS = previous;
  }
});

test('spill preserves the byte-identical pre-scrub output', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-spill-'));
  try {
    const text = `\u001b[31mBEGIN\u001b[0m   \n${bigOutput(200)}\n\n\nEND`;
    const out = compressForOpencode('bash', text, { mode: 'on', stateDir });
    const recovery = recoveryPath(out);
    assert.deepEqual(fs.readFileSync(recovery), Buffer.from(text));
    if (process.platform !== 'win32') assert.equal(fs.statSync(recovery).mode & 0o777, 0o600); // NTFS has no POSIX mode bits
    assert.deepEqual(fs.readdirSync(path.dirname(recovery)).filter(name => name.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('spill rejects symlinked directories and final files', { skip: process.platform === 'win32' }, () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-spill-link-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-spill-outside-'));
  try {
    const text = bigOutput(200, 'linked');
    fs.symlinkSync(outside, path.join(stateDir, 'chisle-spill'));
    const dirOutput = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.doesNotMatch(dirOutput, /Full output:/);
    assert.deepEqual(fs.readdirSync(outside), []);

    fs.unlinkSync(path.join(stateDir, 'chisle-spill'));
    fs.mkdirSync(path.join(stateDir, 'chisle-spill'));
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
    const victim = path.join(outside, 'victim');
    fs.writeFileSync(victim, 'unchanged');
    fs.symlinkSync(victim, path.join(stateDir, 'chisle-spill', `bash-${hash}.txt`));
    const fileOutput = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.doesNotMatch(fileOutput, /Full output:/);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('a repeated spill reuses the existing file even when UTF-8 cannot round-trip it', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-spill-reuse-'));
  try {
    const text = bigOutput(200, 'lone \uD800');
    const first = compressForOpencode('bash', text, { mode: 'on', stateDir });
    const second = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.match(first, /Full output:/);
    assert.match(second, /Full output:/);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('spill and stats reject symlinked randomized temporary targets', { skip: process.platform === 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-tmp-link-'));
  const core = path.join(__dirname, '..', 'hooks', 'chisle-compress-output.js');
  try {
    const probe = `
      const fs=require('fs'),path=require('path'),crypto=require('crypto');
      crypto.randomBytes=()=>Buffer.from('010203040506','hex');
      const c=require(${JSON.stringify(core)}),root=process.argv[1],victim=path.join(root,'victim');
      fs.writeFileSync(victim,'unchanged');
      const text=Array.from({length:200},(_,i)=>'temporary '+i+' '+'x'.repeat(80)).join('\\n');
      const spillDir=path.join(root,'spill','chisle-spill');fs.mkdirSync(spillDir,{recursive:true});
      const hash=crypto.createHash('sha256').update(text).digest('hex').slice(0,12);
      fs.symlinkSync(victim,path.join(spillDir,'bash-'+hash+'.txt.'+process.pid+'.010203040506.tmp'));
      const out=c.compressForOpencode('bash',text,{mode:'on',stateDir:path.join(root,'spill')});
      const statsDir=path.join(root,'stats');fs.mkdirSync(statsDir);
      fs.symlinkSync(victim,path.join(statsDir,'.chisle-compress-stats.json.'+process.pid+'.010203040506.tmp'));
      c.recordSavings(10,statsDir);
      process.stdout.write(JSON.stringify({recovery:/Full output:/.test(out),ledger:fs.existsSync(path.join(statsDir,'.chisle-compress-stats.json')),victim:fs.readFileSync(victim,'utf8')}));
    `;
    const result = spawnSync(process.execPath, ['-e', probe, root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { recovery: false, ledger: false, victim: 'unchanged' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Symlinked state ROOT is a supported user layout (dotfiles via GNU stow), so
// recordSavings must still write there. The files Chisle writes into the root
// are kept symlink-free.
test('stats writes are private and reject a symlinked stats file', { skip: process.platform === 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-stats-safe-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-stats-outside-'));
  try {
    const normal = path.join(root, 'normal');
    recordSavings(12, normal);
    const ledger = path.join(normal, '.chisle-compress-stats.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(ledger, 'utf8')), { savedChars: 12, events: 1 });
    assert.equal(fs.statSync(ledger).mode & 0o777, 0o600);

    const linkedFileDir = path.join(root, 'linked-file');
    fs.mkdirSync(linkedFileDir);
    const victim = path.join(outside, 'victim');
    fs.writeFileSync(victim, 'unchanged');
    fs.symlinkSync(victim, path.join(linkedFileDir, '.chisle-compress-stats.json'));
    recordSavings(30, linkedFileDir);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

// A user-owned state ROOT that is itself a symlink (dotfiles via GNU stow)
// must still record — only the files/subdirs Chisle creates beneath it are
// kept symlink-free. Regression guard for PR #33 review. Symlink support is
// probed up front so an environment that can't create links skips cleanly.
test('recordSavings, spill, and dedup accept a symlinked state root', (t) => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-symprobe-'));
  let linkOk = true;
  try {
    fs.symlinkSync(path.join(probe, 'no-target'), path.join(probe, 'link'), 'dir');
  } catch (e) { linkOk = false; }
  finally { fs.rmSync(probe, { recursive: true, force: true }); }
  if (!linkOk) { t.skip('host cannot create symlinks'); return; }

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-symroot-'));
  const victimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-symroot-victim-'));
  const root = path.join(path.dirname(outside), path.basename(outside) + '-link');
  try {
    fs.symlinkSync(outside, root, 'dir');

    // Stats ledger records through the symlinked root.
    recordSavings(100, root);
    const ledger = path.join(outside, '.chisle-compress-stats.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(ledger, 'utf8')), { savedChars: 100, events: 1 });

    // Spill and per-session dedup state under the symlinked root still write.
    const text = bigOutput(200, 'rooted');
    const output = compressForOpencode('bash', text, { mode: 'on', stateDir: root, sessionId: 's1', callId: 'c1' });
    const recovery = recoveryPath(output);
    // The hook returns the path as given (the symlink); the file must exist
    // inside the REAL directory the root points at.
    assert.equal(path.dirname(recovery), path.join(root, 'chisle-spill'));
    assert.equal(fs.realpathSync(path.dirname(recovery)), path.join(outside, 'chisle-spill'));
    assert.deepEqual(fs.readFileSync(recovery), Buffer.from(text));
    assert.equal(fs.existsSync(path.join(outside, 'chisle-dedup')), true);

    // ...but a symlink planted by Chisle INSIDE the root is still rejected.
    const victim = path.join(victimDir, 'victim');
    fs.writeFileSync(victim, 'unchanged');
    fs.rmSync(ledger); // symlinkSync cannot replace an existing file
    fs.symlinkSync(victim, ledger);
    recordSavings(100, root);
    assert.equal(fs.readFileSync(victim, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(victimDir, { recursive: true, force: true });
  }
});

test('OpenCode truncation is Unicode-safe', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-unicode-'));
  try {
    const text = `${'😀'.repeat(3000)}\n${'😀'.repeat(400)} FATAL EMOJI_ERROR ${'😀'.repeat(400)}\n${'😀'.repeat(3000)}`;
    const out = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.equal(hasUnpairedSurrogate(out), false);
    assert.match(out, /FATAL EMOJI_ERROR/);
    assert.equal(hasUnpairedSurrogate(boundForOpencode(text, '/tmp/emoji.txt', 1001)), false);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

// ── plugin hook wiring ───────────────────────────────────────────────────────

async function v2Hooks(sessions = new Map(), storage = new Map()) {
  const hooks = { tool: {}, session: {} };
  const register = domain => async (name, callback) => {
    const names = domain === 'tool' ? ['execute.after'] : ['prompt', 'context', 'compaction', 'generate', 'title'];
    assert.ok(names.includes(name), `unexpected ${domain} hook: ${name}`);
    hooks[domain][name] = callback;
    return { dispose: async () => { delete hooks[domain][name]; } };
  };
  const context = {
    tool: { hook: register('tool') },
    storage: {
      get: async key => structuredClone(storage.get(key)),
      set: async (key, value) => { storage.set(key, structuredClone(value)); },
    },
    session: {
      hook: register('session'),
      get: async ({ sessionID }) => {
        if (!sessions.has(sessionID)) sessions.set(sessionID, { id: sessionID, metadata: {} });
        return structuredClone(sessions.get(sessionID));
      },
      update: async () => { assert.fail('Chisle must not write shared session metadata'); },
    },
  };
  hooks.context = context;
  hooks.cleanup = await require('../.opencode/plugins-v2/chisle/setup.cjs')(context);
  return hooks;
}

async function loadV2Plugin() {
  const hooks = await v2Hooks();
  assert.equal(typeof hooks.tool['execute.after'], 'function');
  return hooks.tool['execute.after'];
}

function v2ToolEvent(sessionID, id, text = bigOutput(500, 'v2-mode')) {
  return {
    tool: 'shell', sessionID, id, status: 'completed', input: {},
    result: { content: text, metadata: { exit: 0 } },
  };
}

test('OpenCode v2 plugin uses Plugin.define and registers execute.after', async () => {
  const entry = fs.readFileSync(path.join(__dirname, '..', '.opencode', 'plugins-v2', 'chisle', 'index.mjs'), 'utf8');
  assert.match(entry, /import \{ Plugin \} from '@opencode\/plugin'/);
  assert.match(entry, /Plugin\.define\(\{ id: 'chisle', setup \}\)/);
  assert.equal(typeof await loadV2Plugin(), 'function');
});

test('OpenCode v2 mode persists per conversation without changing prompt delivery', async () => {
  const sessions = new Map([['a', { id: 'a', metadata: { other: { keep: true } } }]]);
  const storage = new Map([['foreign-plugin-state', { keep: true }]]);
  const hooks = await v2Hooks(sessions, storage);
  assert.equal(typeof hooks.session.prompt, 'function');
  const prompt = {
    sessionID: 'a', messageID: 'prompt-a',
    prompt: Object.freeze({ text: 'stop chisle', files: Object.freeze([]) }),
    metadata: Object.freeze({ source: 'user' }), delivery: 'queue',
  };
  const original = structuredClone(prompt);
  await hooks.session.prompt(prompt);
  assert.deepEqual(prompt, original);
  assert.deepEqual(sessions.get('a').metadata, { other: { keep: true } });
  assert.equal(storage.get('mode/a'), 'off');
  assert.deepEqual(storage.get('foreign-plugin-state'), { keep: true });

  const off = v2ToolEvent('a', 'off');
  const text = off.result.content;
  await hooks.tool['execute.after'](off);
  assert.equal(off.result.content, text);
  const other = v2ToolEvent('b', 'other');
  await hooks.tool['execute.after'](other);
  assert.ok(other.result.content.length < text.length);
  assert.equal(process.env.CHISLE_DEFAULT_MODE, undefined);
  const shortened = other.result.content;
  await hooks.session.prompt({ sessionID: 'b', prompt: { text: 'stop chisle' } });
  await hooks.tool['execute.after'](other);
  assert.equal(other.result.content, shortened);

  const reloaded = await v2Hooks(sessions, storage);
  await reloaded.session.prompt({ sessionID: 'a', prompt: { text: 'continue the task' }, delivery: 'steer' });
  const stillOff = v2ToolEvent('a', 'reloaded');
  await reloaded.tool['execute.after'](stillOff);
  assert.equal(stillOff.result.content, text);
  await reloaded.session.prompt({ sessionID: 'a', prompt: { text: '/chisle on' } });
  const on = v2ToolEvent('a', 'on');
  await reloaded.tool['execute.after'](on);
  assert.ok(on.result.content.length < text.length);
  assert.deepEqual(sessions.get('a').metadata, { other: { keep: true } });
  assert.equal(storage.get('mode/a'), 'on');
});

test('OpenCode v2 untoggled roots follow runtime defaults while explicit modes persist', async () => {
  const previous = process.env.CHISLE_DEFAULT_MODE;
  process.env.CHISLE_DEFAULT_MODE = 'off';
  const sessions = new Map();
  const storage = new Map();
  try {
    const hooks = await v2Hooks(sessions, storage);
    const off = v2ToolEvent('default', 'first');
    const original = off.result.content;
    await hooks.tool['execute.after'](off);
    assert.equal(off.result.content, original);
    assert.equal(storage.has('mode/default'), false);
    process.env.CHISLE_DEFAULT_MODE = 'on';
    const dynamic = v2ToolEvent('default', 'second');
    await hooks.tool['execute.after'](dynamic);
    assert.ok(dynamic.result.content.length < original.length);
    await hooks.session.prompt({ sessionID: 'default', prompt: { text: 'stop chisle' } });
    assert.equal(storage.get('mode/default'), 'off');
    const reloaded = await v2Hooks(sessions, storage);
    const retained = v2ToolEvent('default', 'third');
    await reloaded.tool['execute.after'](retained);
    assert.equal(retained.result.content, original);
    const fresh = v2ToolEvent('unrelated', 'first');
    await reloaded.tool['execute.after'](fresh);
    assert.ok(fresh.result.content.length < original.length);
    await reloaded.session.prompt({ sessionID: 'default', prompt: { text: 'activate chisle' } });
    assert.equal(storage.get('mode/default'), 'on');
    process.env.CHISLE_DEFAULT_MODE = 'off';
    const explicit = v2ToolEvent('default', 'fourth');
    await reloaded.tool['execute.after'](explicit);
    assert.ok(explicit.result.content.length < original.length);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_DEFAULT_MODE;
    else process.env.CHISLE_DEFAULT_MODE = previous;
  }
});

test('OpenCode v2 children and forks snapshot parent mode at first use and survive reload', async () => {
  const sessions = new Map([
    ['parent', { id: 'parent', metadata: { other: 7 } }],
    ['child', { id: 'child', parentID: 'parent', metadata: { source: 'subagent' } }],
    ['fork', { id: 'fork', fork: { sessionID: 'parent', boundary: { type: 'through', messageID: 'old' } }, metadata: { other: 8 } }],
  ]);
  const storage = new Map([['mode/parent', 'on']]);
  const hooks = await v2Hooks(sessions, storage);
  await hooks.session.prompt({ sessionID: 'parent', prompt: { text: 'stop chisle' } });
  for (const sessionID of ['child', 'fork']) {
    const event = v2ToolEvent(sessionID, 'first');
    const text = event.result.content;
    await hooks.tool['execute.after'](event);
    assert.equal(event.result.content, text);
    assert.equal(storage.get(`mode/${sessionID}`), 'off');
  }
  assert.deepEqual(sessions.get('child').metadata, { source: 'subagent' });
  assert.deepEqual(sessions.get('fork').metadata, { other: 8 });
  await hooks.session.prompt({ sessionID: 'parent', prompt: { text: 'turn on chisle' } });
  const reloaded = await v2Hooks(sessions, storage);
  for (const sessionID of ['child', 'fork']) {
    const event = v2ToolEvent(sessionID, 'later');
    const text = event.result.content;
    await reloaded.tool['execute.after'](event);
    assert.equal(event.result.content, text);
  }
  await reloaded.session.prompt({ sessionID: 'fork', prompt: { text: '/chisle on' } });
  const fork = v2ToolEvent('fork', 'on');
  await reloaded.tool['execute.after'](fork);
  assert.ok(fork.result.content.length < bigOutput(500, 'v2-mode').length);
  sessions.set('middle', { id: 'middle', parentID: 'fork', metadata: {} });
  sessions.set('grandchild', { id: 'grandchild', parentID: 'middle', metadata: {} });
  const grandchild = v2ToolEvent('grandchild', 'first');
  await reloaded.tool['execute.after'](grandchild);
  assert.ok(grandchild.result.content.length < bigOutput(500, 'v2-mode').length);
  assert.equal(storage.get('mode/middle'), 'on');
  assert.equal(storage.get('mode/grandchild'), 'on');
  assert.equal(storage.get('mode/parent'), 'on');
});

for (const kind of ['context', 'compaction', 'generate', 'title']) {
  test(`OpenCode v2 ${kind} removes only current Chisle system rules when off`, async () => {
    const hooks = await v2Hooks(new Map(), new Map([['mode/off', 'off']]));
    assert.equal(typeof hooks.session[kind], 'function');
    const skillPath = path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md');
    const skill = fs.readFileSync(skillPath, 'utf8').trim();
    const skillBody = skill.replace(/^---[\s\S]*?---\s*/, '');
    const block = '<!-- chisle-begin -->\n# Chisle\nOnly Chisle rules.\n<!-- chisle-end -->';
    const before = '# User instructions\r\n\r\nKeep  spacing.\r\n';
    const after = '\r\n\r\nProject policy stays.\n';
    const foreign = Object.freeze({ key: 'core/environment', text: 'Unrelated  rules.\n\nKeep blanks.' });
    const instructions = Object.freeze([
      foreign,
      Object.freeze({ key: 'core/instructions', text: before + block + after, owner: 'user' }),
      Object.freeze({ key: skillPath, text: skillBody }),
    ]);
    const metadata = Object.freeze({
      provider: Object.freeze({ keep: 'exact' }),
      experimental: Object.freeze({ instructions, extra: 42 }),
    });
    const mixed = Object.freeze({ type: 'text', text: before + block + after, cache: '1h', metadata });
    const loaded = Object.freeze({ type: 'text', text: `Instructions from: ${skillPath}\n${skill}`, cache: '5m' });
    const bodyOnly = Object.freeze({ type: 'text', text: skillBody, metadata: Object.freeze({
      experimental: Object.freeze({ instructions: Object.freeze([Object.freeze({ key: skillPath, text: skillBody })]) }),
    }) });
    const unrelated = Object.freeze({ type: 'text', text: '# Chisle\nMy unrelated project policy.\n\n', metadata: { keep: true } });
    const unowned = Object.freeze({ type: 'text', text: skillBody, metadata: Object.freeze({
      experimental: Object.freeze({ instructions: Object.freeze([Object.freeze({ key: '/project/policy.md', text: skillBody })]) }),
    }) });
    const incomplete = Object.freeze({ type: 'text', text: 'User policy\n<!-- chisle-begin -->\nUnclosed marker stays intact.' });
    const messages = Object.freeze([
      Object.freeze({ role: 'tool', metadata: Object.freeze({ stored: true }), content: Object.freeze([
        Object.freeze({ type: 'tool-result', name: 'shell', result: Object.freeze({ type: 'text', value: bigOutput(500) }) }),
        Object.freeze({ type: 'tool-result', name: 'shell', result: Object.freeze({ type: 'text', value: 'already shortened [chisle: elided]' }) }),
      ]) }),
    ]);
    const event = { sessionID: 'off', system: Object.freeze([mixed, loaded, bodyOnly, unrelated, unowned, incomplete]), messages, options: { temperature: 0 } };
    const history = structuredClone(messages);
    await hooks.session[kind](event);
    assert.equal(event.system.length, 4);
    assert.equal(event.system[0].text, before + after);
    assert.equal(event.system[0].cache, '1h');
    assert.deepEqual(event.system[0].metadata, {
      provider: { keep: 'exact' }, experimental: { instructions: [foreign, { key: 'core/instructions', text: before + after, owner: 'user' }], extra: 42 },
    });
    assert.equal(event.system[0].metadata.experimental.instructions[0], foreign);
    assert.equal(event.system[1], unrelated);
    assert.equal(event.system[2], unowned);
    assert.equal(event.system[3], incomplete);
    assert.equal(mixed.text, before + block + after);
    assert.equal(mixed.metadata, metadata);
    assert.equal(event.messages, messages);
    assert.deepEqual(event.messages, history);
    assert.deepEqual(event.options, { temperature: 0 });

    await hooks.session.prompt({ sessionID: 'off', prompt: { text: '/chisle' } });
    const assembled = Object.freeze([mixed, loaded, bodyOnly, unrelated]);
    const on = { sessionID: 'off', system: assembled, messages };
    await hooks.session[kind](on);
    assert.equal(on.system, assembled);
    assert.equal(on.messages, messages);
  });
}

test('OpenCode v2 filters current aggregated instructions without restoring stale source text', async () => {
  const hooks = await v2Hooks(new Map(), new Map([['mode/off', 'off']]));
  assert.equal(typeof hooks.session.context, 'function');
  const root = require('../hooks/chisle-config').getOpencodeDir();
  const fence = '<!-- chisle-begin -->\n# Chisle\nRules.\n<!-- chisle-end -->';
  const old = `Instructions from: ${path.join(root, 'AGENTS.md')}\nGlobal policy.\n${fence}\n\nInstructions from: /project/AGENTS.md\nProject  policy.\n\n`;
  const current = old.replace('Global policy.', 'Global policy edited by another hook.');
  const foreign = Object.freeze({ key: 'core/date', text: 'Date stays exact.\n\n' });
  const part = Object.freeze({ type: 'text', text: current, metadata: Object.freeze({
    experimental: Object.freeze({ instructions: Object.freeze([
      Object.freeze({ key: 'core/instructions', text: old }), foreign,
    ]) }),
  }) });
  const event = { sessionID: 'off', system: Object.freeze([part]), messages: [] };
  await hooks.session.context(event);
  assert.equal(event.system[0].text, current.replace(fence, ''));
  assert.equal(event.system[0].metadata.experimental.instructions[0].text, old.replace(fence, ''));
  assert.equal(event.system[0].metadata.experimental.instructions[1], foreign);
  assert.equal(part.text, current);
});

test('OpenCode v2 unmatched earlier fences preserve intervening policies and later complete blocks', async () => {
  const hooks = await v2Hooks(new Map(), new Map([['mode/off', 'off']]));
  const prefix = 'Instructions from: /project/AGENTS.md\r\n<!-- chisle-begin -->\r\nSECURITY_POLICY_KEEP\r\n\r\n';
  const fence = '<!-- chisle-begin -->\n# Chisle\nOwned rules.\n<!-- chisle-end -->';
  const suffix = '\n\nUSER_POLICY_AFTER\n<!-- chisle-end -->\n';
  const original = prefix + fence + suffix;
  const metadata = Object.freeze({ experimental: Object.freeze({ instructions: Object.freeze([
    Object.freeze({ key: 'core/instructions', text: original }),
  ]) }) });
  const part = Object.freeze({ type: 'text', text: original, metadata });
  for (const kind of ['context', 'compaction', 'generate', 'title']) {
    const event = { sessionID: 'off', system: Object.freeze([part]), messages: [] };
    await hooks.session[kind](event);
    assert.equal(event.system[0].text, prefix + suffix);
    assert.equal(event.system[0].metadata.experimental.instructions[0].text, prefix + suffix);
    assert.equal(part.text, original);
    assert.equal(part.metadata, metadata);
  }
});

test('OpenCode v2 JSON uses shared minification without altering strings or big integers', async () => {
  const after = await loadV2Plugin();
  const padding = ' '.repeat(1600);
  const original = `{\n${padding}"id": 900719925474099312345,\n${padding}"text": "keep  spaces, \\\"quotes\\\" and \\\\slashes",\n${padding}"items": [ true, null, 1e+30 ]\n}`;
  const expected = '{"id":900719925474099312345,"text":"keep  spaces, \\\"quotes\\\" and \\\\slashes","items":[true,null,1e+30]}';
  const output = Object.freeze({ id: '900719925474099312345', text: 'structured value' });
  const metadata = Object.freeze({ keep: { exact: true } });
  const files = Object.freeze([{ uri: 'file:///tool/output.json' }]);
  const image = Object.freeze({ type: 'image', data: 'unchanged', mime: 'image/png' });
  const file = Object.freeze({ type: 'file', url: 'file:///tool/source.js', mime: 'text/javascript', filename: 'source.js' });
  const event = {
    tool: 'shell', sessionID: 'json', id: 'pretty', status: 'completed', input: {},
    result: { output, metadata, files, content: [{ type: 'text', text: original, extra: 7 }, image, file] },
  };
  await after(event);
  assert.equal(event.result.content[0].text, expected);
  assert.equal(event.result.content[0].extra, 7);
  assert.equal(event.result.content[1], image);
  assert.equal(event.result.content[2], file);
  assert.equal(event.result.output, output);
  assert.equal(event.result.metadata, metadata);
  assert.equal(event.result.files, files);
});

test('OpenCode v2 oversized JSON retains byte-identical recovery and structured result', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-v2-json-'));
  const previous = process.env.CHISLE_STATE_DIR;
  process.env.CHISLE_STATE_DIR = stateDir;
  try {
    const after = await loadV2Plugin();
    const original = JSON.stringify({ payload: 'x'.repeat(16000) }, null, 2);
    const output = Object.freeze({ payload: 'structured result stays full' });
    const event = v2ToolEvent('large-json', 'first', original);
    event.result.output = output;
    await after(event);
    assert.ok(event.result.content.length <= THRESHOLDS.maxChars);
    assert.deepEqual(fs.readFileSync(recoveryPath(event.result.content)), Buffer.from(original));
    assert.equal(event.result.output, output);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_STATE_DIR;
    else process.env.CHISLE_STATE_DIR = previous;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('OpenCode v2 ignores malformed events without writing missing session keys', async () => {
  const storage = new Map();
  const hooks = await v2Hooks(new Map(), storage);
  assert.equal(typeof hooks.session.prompt, 'function');
  for (const event of [undefined, null, {}, { prompt: { text: 'stop chisle' } }, { sessionID: 'odd', prompt: null }, { sessionID: 'odd', prompt: { text: [] } }]) {
    await assert.doesNotReject(hooks.session.prompt(event));
  }
  for (const event of [undefined, null, {}, { status: 'completed', result: null }, { tool: 'shell', status: 'completed', result: { content: null } }, v2ToolEvent(undefined, 'missing')]) {
    await assert.doesNotReject(hooks.tool['execute.after'](event));
  }
  for (const kind of ['context', 'compaction', 'generate', 'title']) {
    for (const event of [undefined, null, {}, { sessionID: 'odd', system: null }]) {
      await assert.doesNotReject(hooks.session[kind](event));
    }
  }
  assert.deepEqual([...storage], []);
});

test('OpenCode v2 session or storage failures fall back to the runtime default', async () => {
  const previous = process.env.CHISLE_DEFAULT_MODE;
  try {
    for (const failure of ['get', 'storage', 'write']) {
      const hooks = await v2Hooks();
      assert.equal(typeof hooks.session.prompt, 'function');
      if (failure === 'get') hooks.context.session.get = async () => { throw new Error('session unavailable'); };
      if (failure === 'storage') hooks.context.storage.get = async () => { throw new Error('storage unavailable'); };
      if (failure === 'write') hooks.context.storage.set = async () => { throw new Error('storage unavailable'); };
      if (failure !== 'get') await assert.doesNotReject(hooks.session.prompt({ sessionID: failure, prompt: { text: 'stop chisle' } }));
      for (const mode of ['off', 'on']) {
        process.env.CHISLE_DEFAULT_MODE = mode;
        const event = v2ToolEvent(failure, mode);
        const original = event.result.content;
        await assert.doesNotReject(hooks.tool['execute.after'](event));
        if (mode === 'off') assert.equal(event.result.content, original);
        else assert.ok(event.result.content.length < original.length);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.CHISLE_DEFAULT_MODE;
    else process.env.CHISLE_DEFAULT_MODE = previous;
  }
});

test('OpenCode v2 serializes initialization and toggles without stale inherited writes', async () => {
  const sessions = new Map([['child', { id: 'child', parentID: 'parent' }]]);
  const storage = new Map([['mode/parent', 'on']]);
  const hooks = await v2Hooks(sessions, storage);
  assert.equal(typeof hooks.session.prompt, 'function');
  const get = hooks.context.storage.get;
  let reached;
  let release;
  const entered = new Promise(resolve => { reached = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  let first = true;
  hooks.context.storage.get = async key => {
    const value = await get(key);
    if (key === 'mode/child' && first) {
      first = false;
      reached();
      await blocked;
    }
    return value;
  };
  const initializing = hooks.tool['execute.after'](v2ToolEvent('child', 'first'));
  await entered;
  const off = hooks.session.prompt({ sessionID: 'child', prompt: { text: 'stop chisle' } });
  release();
  await Promise.all([initializing, off]);
  assert.equal(storage.get('mode/child'), 'off');
  await Promise.all([
    hooks.session.prompt({ sessionID: 'child', prompt: { text: '/chisle on' } }),
    hooks.session.prompt({ sessionID: 'child', prompt: { text: '/chisle off' } }),
  ]);
  const event = v2ToolEvent('child', 'after');
  const original = event.result.content;
  await hooks.tool['execute.after'](event);
  assert.equal(event.result.content, original);
});

test('OpenCode v2 corrupted ancestry and mode values fall back without persisting guesses', async () => {
  const sessions = new Map([
    ['a', { id: 'a', parentID: 'b' }], ['b', { id: 'b', parentID: 'a' }],
    ['self', { id: 'self', parentID: 'self' }],
  ]);
  for (let i = 0; i < 80; i++) sessions.set(`deep-${i}`, { id: `deep-${i}`, parentID: `deep-${i + 1}` });
  const storage = new Map([['mode/corrupt', { mode: 'off' }]]);
  const hooks = await v2Hooks(sessions, storage);
  assert.equal(typeof hooks.session.prompt, 'function');
  const previous = process.env.CHISLE_DEFAULT_MODE;
  process.env.CHISLE_DEFAULT_MODE = 'off';
  try {
    for (const sessionID of ['a', 'b', 'self', 'deep-0', 'corrupt']) {
      const event = v2ToolEvent(sessionID, 'first');
      const original = event.result.content;
      await assert.doesNotReject(hooks.tool['execute.after'](event));
      assert.equal(event.result.content, original);
    }
    assert.deepEqual([...storage], [['mode/corrupt', { mode: 'off' }]]);
    await hooks.session.prompt({ sessionID: 'corrupt', prompt: { text: '/chisle on' } });
    assert.equal(storage.get('mode/corrupt'), 'on');
  } finally {
    if (previous === undefined) delete process.env.CHISLE_DEFAULT_MODE;
    else process.env.CHISLE_DEFAULT_MODE = previous;
  }
});

test('OpenCode v2 kill switch disables compression without changing explicit mode', async () => {
  const storage = new Map([['mode/enabled', 'on']]);
  const hooks = await v2Hooks(new Map(), storage);
  const previous = process.env.CHISLE_COMPRESS;
  process.env.CHISLE_COMPRESS = '0';
  try {
    const event = v2ToolEvent('enabled', 'first');
    const original = event.result.content;
    await hooks.tool['execute.after'](event);
    assert.equal(event.result.content, original);
    assert.equal(storage.get('mode/enabled'), 'on');
    const system = Object.freeze([{ type: 'text', text: '<!-- chisle-begin -->rules<!-- chisle-end -->' }]);
    const request = { sessionID: 'enabled', system, messages: [] };
    assert.equal(typeof hooks.session.context, 'function');
    await hooks.session.context(request);
    assert.equal(request.system, system);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_COMPRESS;
    else process.env.CHISLE_COMPRESS = previous;
  }
});

test('OpenCode v2 unload disposes every hook and preserves persisted mode', async () => {
  const storage = new Map([['mode/a', 'off']]);
  const hooks = await v2Hooks(new Map(), storage);
  assert.equal(typeof hooks.cleanup, 'function');
  await Promise.all([hooks.cleanup(), hooks.cleanup()]);
  assert.deepEqual(hooks.tool, {});
  assert.deepEqual(hooks.session, {});
  assert.equal(storage.get('mode/a'), 'off');
});

for (const operation of ['toggle', 'inheritance']) {
  test(`OpenCode v2 unload drains blocked ${operation} before a replacement plugin writes`, async () => {
    const sessions = new Map([['child', { id: 'child', parentID: 'parent' }]]);
    const storage = new Map([['mode/parent', 'off']]);
    const hooks = await v2Hooks(sessions, storage);
    let reached;
    let release;
    const entered = new Promise(resolve => { reached = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    if (operation === 'toggle') {
      const set = hooks.context.storage.set;
      hooks.context.storage.set = async (key, value) => {
        reached();
        await blocked;
        await set(key, value);
      };
    } else {
      const get = hooks.context.storage.get;
      hooks.context.storage.get = async key => {
        if (key === 'mode/child') {
          reached();
          await blocked;
        }
        return get(key);
      };
    }
    const active = operation === 'toggle'
      ? hooks.session.prompt({ sessionID: 'child', prompt: { text: 'stop chisle' } })
      : hooks.session.context({ sessionID: 'child', system: [], messages: [] });
    await entered;
    const stalePrompt = hooks.session.prompt;
    let unloaded = false;
    const unloading = hooks.cleanup().then(() => { unloaded = true; });
    const concurrentCleanup = hooks.cleanup();
    // Let disposal complete without a timer; cleanup must still await the hook.
    await new Promise(resolve => setImmediate(resolve));
    const returnedBeforeDrain = unloaded;
    release();
    await Promise.all([active, unloading, concurrentCleanup]);
    assert.equal(returnedBeforeDrain, false);
    assert.deepEqual(hooks.session, {});
    assert.deepEqual(hooks.tool, {});
    const reloaded = await v2Hooks(sessions, storage);
    await reloaded.session.prompt({ sessionID: 'child', prompt: { text: 'activate chisle' } });
    await stalePrompt({ sessionID: 'child', prompt: { text: 'stop chisle' } });
    assert.equal(storage.get('mode/child'), 'on');
    await reloaded.cleanup();
  });
}

test('OpenCode v2 failed registration disposes hooks already registered', async () => {
  const registered = new Set();
  const hook = async name => {
    if (name === 'generate') throw new Error('registration failed');
    registered.add(name);
    return { dispose: async () => { registered.delete(name); } };
  };
  const setup = require('../.opencode/plugins-v2/chisle/setup.cjs');
  await assert.rejects(setup({ session: { hook }, tool: { hook } }), /registration failed/);
  assert.deepEqual([...registered], []);
});

test('OpenCode v2 shell compression preserves spill, metadata, safety, stats, and idempotency', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-v2-'));
  const previous = process.env.CHISLE_STATE_DIR;
  const previousTools = process.env.CHISLE_COMPRESS_TOOLS;
  process.env.CHISLE_STATE_DIR = stateDir;
  process.env.CHISLE_COMPRESS_TOOLS = 'shell';
  try {
    const after = await loadV2Plugin();
    const original = bigOutput(500, 'shell');
    const event = {
      tool: 'shell', sessionID: 'v2', id: 'one', status: 'completed', input: {},
      result: { output: { output: original, exit: 0 }, content: [{ type: 'text', text: original }], metadata: { exit: 0 } },
    };
    await after(event);
    const compressed = event.result.content[0].text;
    assert.ok(compressed.length < original.length);
    assert.match(compressed, /chisle: elided/);
    assert.deepEqual(event.result.output, { output: original, exit: 0 });
    assert.deepEqual(event.result.metadata, { exit: 0 });
    assert.deepEqual(fs.readFileSync(recoveryPath(compressed)), Buffer.from(original));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stateDir, '.chisle-compress-stats.json'), 'utf8')), {
      savedChars: original.length - compressed.length, events: 1,
    });

    await after(event);
    assert.equal(event.result.content[0].text, compressed);

    for (const tool of ['read', 'edit', 'write']) {
      const protectedEvent = {
        tool, sessionID: 'v2', id: tool, status: 'completed', input: {},
        result: { content: original, metadata: {} },
      };
      await after(protectedEvent);
      assert.equal(protectedEvent.result.content, original);
    }
  } finally {
    if (previous === undefined) delete process.env.CHISLE_STATE_DIR;
    else process.env.CHISLE_STATE_DIR = previous;
    if (previousTools === undefined) delete process.env.CHISLE_COMPRESS_TOOLS;
    else process.env.CHISLE_COMPRESS_TOOLS = previousTools;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('OpenCode v2 filters small shell output using input.command', async () => {
  const original = [
    'On branch main',
    'Changes not staged for commit:',
    '  (use "git add <file>..." to update what will be committed)',
    '  (use "git restore <file>..." to discard changes in working directory)',
    '\tmodified:   src/example.js',
    'no changes added to commit',
  ].join('\n');
  const after = await loadV2Plugin();
  const event = {
    tool: 'shell', sessionID: 'v2-command', id: 'status', status: 'completed',
    input: { command: 'git status' }, result: { content: original, metadata: { exit: 0 } },
  };
  await after(event);
  assert.equal(event.result.content, '* main\n M src/example.js');
  assert.deepEqual(event.result.metadata, { exit: 0 });
});

test('OpenCode v2 plugin fails open when compression throws', async () => {
  const originalCompress = opencodeCore.compressForOpencode;
  opencodeCore.compressForOpencode = () => { throw new Error('compressor failed'); };
  try {
    const after = await loadV2Plugin();
    const original = bigOutput(500, 'error');
    const event = {
      tool: 'shell', sessionID: 'v2', id: 'error', status: 'completed', input: {},
      result: { content: original, metadata: {} },
    };
    await assert.doesNotReject(after(event));
    assert.equal(event.result.content, original);
  } finally {
    opencodeCore.compressForOpencode = originalCompress;
  }
});

test('plugin tool.execute.after compresses output.output in place', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const after = hooks['tool.execute.after'];
  assert.equal(typeof after, 'function');

  const big = bigOutput(500);
  const output = { title: 't', output: big, metadata: {} };
  await after({ tool: 'bash', sessionID: 's', callID: 'c', args: {} }, output);
  assert.ok(output.output.length < big.length);
  assert.match(output.output, /chisle: elided/);

  // read is never compressed
  const readOut = { title: 't', output: big, metadata: {} };
  await after({ tool: 'read', sessionID: 's', callID: 'c2', args: {} }, readOut);
  assert.equal(readOut.output, big);
});

test('failed Bash results are compressed once without changing exit metadata', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-failed-'));
  const previous = process.env.CHISLE_STATE_DIR;
  process.env.CHISLE_STATE_DIR = stateDir;
  try {
    const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
    const hooks = await plugin({});
    const original = `${bigOutput(220, 'failed')}\nFATAL_FAILED_SMOKE exit=23`;
    const output = { output: original, metadata: { exit: 23, truncated: false } };
    await hooks['tool.execute.after']({ tool: 'bash', sessionID: 'failed', callID: 'failed-1' }, output);

    assert.ok(output.output.length <= THRESHOLDS.maxChars);
    assert.match(output.output, /FATAL_FAILED_SMOKE exit=23/);
    assert.deepEqual(output.metadata, { exit: 23, truncated: false });
    assert.deepEqual(fs.readFileSync(recoveryPath(output.output)), Buffer.from(original));

    const statsPath = path.join(stateDir, '.chisle-compress-stats.json');
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    assert.deepEqual(stats, { savedChars: original.length - output.output.length, events: 1 });

    const messages = [{ parts: [{ type: 'tool', tool: 'bash', state: { status: 'completed', output: output.output } }] }];
    await hooks['experimental.chat.messages.transform']({}, { messages });
    assert.deepEqual(JSON.parse(fs.readFileSync(statsPath, 'utf8')), stats);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_STATE_DIR;
    else process.env.CHISLE_STATE_DIR = previous;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('plugin hook never throws on odd output shapes', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const after = hooks['tool.execute.after'];
  await after({ tool: 'bash' }, { output: null });
  await after({ tool: 'bash' }, {});
  await after({}, { output: 'x' });
  // MCP tools can deliver content[] arrays instead of a string — skip, never throw.
  await after({ tool: 'github-tools_x' }, { output: [{ type: 'text', text: 'hi' }] });
  // no throw = pass
});

// ── experimental.chat.messages.transform (request-time / retroactive) ────────

test('messages.transform compresses a big completed tool part in place', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const transform = hooks['experimental.chat.messages.transform'];
  assert.equal(typeof transform, 'function');

  const big = bigOutput(500);
  const messages = [{
    info: { role: 'assistant' },
    parts: [
      { type: 'text', text: 'thinking' },
      { type: 'tool', tool: 'bash', callID: 'c1', state: { status: 'completed', output: big, input: {} } },
    ],
  }];
  await transform({}, { messages });
  const toolPart = messages[0].parts[1];
  assert.ok(toolPart.state.output.length < big.length);
  assert.match(toolPart.state.output, /chisle: elided/);
});

test('messages.transform preserves errors and leaves protected/small parts alone', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const transform = hooks['experimental.chat.messages.transform'];

  const lines = [];
  for (let i = 0; i < 60; i++) lines.push(`head ${i}`);
  lines.push('ERROR: keep me');
  for (let i = 0; i < 400; i++) lines.push(`noise ${i} ${'y'.repeat(60)}`);
  for (let i = 0; i < 40; i++) lines.push(`tail ${i}`);
  const bashBig = lines.join('\n');
  const readBig = bigOutput(500);
  const small = 'short';
  const messages = [{
    info: { role: 'assistant' },
    parts: [
      { type: 'tool', tool: 'bash', callID: 'a', state: { status: 'completed', output: bashBig, input: {} } },
      { type: 'tool', tool: 'read', callID: 'b', state: { status: 'completed', output: readBig, input: {} } },
      { type: 'tool', tool: 'bash', callID: 'c', state: { status: 'completed', output: small, input: {} } },
      { type: 'tool', tool: 'bash', callID: 'd', state: { status: 'running', input: {} } },
    ],
  }];
  await transform({}, { messages });
  const [p0, p1, p2, p3] = messages[0].parts;
  assert.match(p0.state.output, /ERROR: keep me/);      // error salvaged
  assert.ok(p0.state.output.length < bashBig.length);   // bash compressed
  assert.equal(p1.state.output, readBig);               // read untouched
  assert.equal(p2.state.output, small);                 // small untouched
  assert.equal(p3.state.output, undefined);             // non-completed untouched
});

test('messages.transform honors mode off / kill switch and never throws', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const transform = hooks['experimental.chat.messages.transform'];

  const big = bigOutput(500);
  process.env.CHISLE_COMPRESS = '0';
  try {
    const messages = [{ info: {}, parts: [{ type: 'tool', tool: 'bash', state: { status: 'completed', output: big, input: {} } }] }];
    await transform({}, { messages });
    assert.equal(messages[0].parts[0].state.output, big); // kill switch: untouched
  } finally {
    delete process.env.CHISLE_COMPRESS;
  }
  // odd shapes: no throw
  await transform({}, {});
  await transform({}, { messages: null });
  await transform({}, { messages: [null, { parts: null }, { parts: [null, { type: 'text' }] }] });
});

test('messages.transform is idempotent: already-compressed parts are skipped', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const transform = hooks['experimental.chat.messages.transform'];

  const big = bigOutput(500);
  const messages = [{ info: {}, parts: [{ type: 'tool', tool: 'bash', state: { status: 'completed', output: big, input: {} } }] }];
  await transform({}, { messages });
  const once = messages[0].parts[0].state.output;
  assert.match(once, /chisle: elided/);
  await transform({}, { messages });            // second pass
  assert.equal(messages[0].parts[0].state.output, once); // unchanged, no nested marker
});

test('tool.execute.after preserves bounded Chisle output but bounds source markers', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const after = hooks['tool.execute.after'];
  const already = 'kept\n... [chisle: elided 100 lines] ...';
  const first = { title: 't', output: already, metadata: {} };
  await after({ tool: 'bash', callID: 'c1' }, first);
  assert.equal(first.output, already);

  const source = bigOutput(500) + '\n... [chisle: source marker] ...';
  const second = { title: 't', output: source, metadata: {} };
  await after({ tool: 'bash', sessionID: 'marker-session', callID: 'c2' }, second);
  assert.ok(second.output.length <= THRESHOLDS.maxChars);
  assert.notEqual(second.output, source);
});

test('OpenCode-native tool_output truncation remains recoverable before the hook', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const nativePath = '/tmp/opencode/tool_original';
  const native = `${bigOutput(300)}\n\n...250000 bytes truncated...\n\nThe tool call succeeded but the output was truncated. Full output saved to: ${nativePath}\nUse Grep to search the full content or Read with offset/limit to view specific sections.`;
  const output = { output: native };
  await hooks['tool.execute.after']({ tool: 'bash', sessionID: 'ordered', callID: 'ordered-1' }, output);
  assert.ok(output.output.length <= THRESHOLDS.maxChars);
  assert.match(output.output, new RegExp(nativePath));
});

test('OpenCode dedup is isolated across interleaved sessions and calls', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-dedup-'));
  try {
    const text = `same\n${'x'.repeat(3000)}`;
    assert.equal(compressForOpencode('bash', text, { mode: 'on', stateDir, sessionId: 'a', callId: 'a1' }), null);
    assert.equal(compressForOpencode('bash', text, { mode: 'on', stateDir, sessionId: 'b', callId: 'b1' }), null);
    assert.equal(compressForOpencode('bash', text, { mode: 'on', stateDir, sessionId: 'a', callId: 'a1' }), null);
    assert.match(compressForOpencode('bash', text, { mode: 'on', stateDir, sessionId: 'a', callId: 'a2' }), /byte-identical/);
    assert.equal(fs.existsSync(sessionStateFile(stateDir, 'a')), true);
    assert.equal(fs.existsSync(sessionStateFile(stateDir, 'b')), true);
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('OpenCode dedup state is bounded and does not follow symlinks', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-dedup-safe-'));
  try {
    for (let i = 0; i < 25; i++) {
      compressForOpencode('bash', `session ${i}\n${'x'.repeat(3000)}`, {
        mode: 'on', stateDir, sessionId: `s${i}`, callId: `c${i}`,
      });
    }
    const dir = path.join(stateDir, 'chisle-dedup');
    assert.equal(fs.readdirSync(dir).filter((name) => name.endsWith('.json')).length, 20);
    if (symlinkSkip) return; // the bound above holds everywhere; the symlink half needs symlinks
    const target = path.join(stateDir, 'target');
    fs.writeFileSync(target, 'unchanged');
    fs.symlinkSync(target, sessionStateFile(stateDir, 'linked'));
    compressForOpencode('bash', `linked\n${'x'.repeat(3000)}`, {
      mode: 'on', stateDir, sessionId: 'linked', callId: 'linked-1',
    });
    assert.equal(fs.readFileSync(target, 'utf8'), 'unchanged');
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('concurrent OpenCode sessions retain independent dedup state', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-concurrent-'));
  const core = path.join(__dirname, '..', 'hooks', 'chisle-compress-output.js');
  try {
    const sessions = Array.from({ length: 8 }, (_, i) => `concurrent-${i}`);
    await Promise.all(sessions.map((session) => new Promise((resolve, reject) => {
      const script = `const c=require(${JSON.stringify(core)});c.compressForOpencode('bash','${'x'.repeat(2100)}',{mode:'on',stateDir:process.argv[1],sessionId:process.argv[2],callId:'first'})`;
      const child = spawn(process.execPath, ['-e', script, stateDir, session], { stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`child exited ${code}`)));
    })));
    for (const session of sessions) {
      const duplicate = compressForOpencode('bash', 'x'.repeat(2100), {
        mode: 'on', stateDir, sessionId: session, callId: 'second',
      });
      assert.match(duplicate, /byte-identical/);
    }
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

test('only the persisted after-hook replacement records savings', async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-stats-'));
  const previous = process.env.CHISLE_STATE_DIR;
  process.env.CHISLE_STATE_DIR = stateDir;
  try {
    const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
    const hooks = await plugin({});
    const big = bigOutput(500, 'stats');
    const output = { output: big };
    await hooks['tool.execute.after']({ tool: 'bash', sessionID: 'stats', callID: 'one' }, output);
    const statsPath = path.join(stateDir, '.chisle-compress-stats.json');
    const first = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const messages = [{ parts: [{ type: 'tool', tool: 'bash', state: { status: 'completed', output: big } }] }];
    await hooks['experimental.chat.messages.transform']({}, { messages });
    assert.deepEqual(JSON.parse(fs.readFileSync(statsPath, 'utf8')), first);
  } finally {
    if (previous === undefined) delete process.env.CHISLE_STATE_DIR;
    else process.env.CHISLE_STATE_DIR = previous;
    fs.rmSync(stateDir, { recursive: true, force: true });
  }
});

// ── installed layout: CJS core under a type:module config dir ───────────────
// OpenCode's config dir declares "type": "module". Node applies that to every
// .js file beneath it, so without an explicit pin the CommonJS compressor core
// is parsed as ESM and throws ReferenceError on its first `require` — which
// loadFrom rethrows, taking the whole plugin down. Bun tolerates it; Node does
// not. This asserts the installed layout survives the strict runtime.
test('plugin runtime keeps spill, dedup, and stats under OPENCODE_CONFIG_DIR', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-runtime-root-'));
  try {
    const pluginPath = path.join(__dirname, '..', '.opencode', 'plugins', 'chisle.mjs');
    const probe = `
      const big = Array.from({length:220},(_,i)=>'line '+i+' '+'x'.repeat(80)).join('\\n');
      import(${JSON.stringify('file://' + pluginPath)}).then(async (m) => {
        const hooks = await m.default({});
        const out = { output: big, metadata: { exit: 23 } };
        await hooks['tool.execute.after']({ tool: 'bash', sessionID: 'root', callID: 'one' }, out);
        process.stdout.write(out.output.length < big.length ? 'COMPRESSED' : 'NOOP');
      });
    `;
    const env = { ...process.env, OPENCODE_CONFIG_DIR: root, XDG_CONFIG_HOME: '', CHISLE_STATE_DIR: '' };
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8', env });
    assert.equal(result.stdout, 'COMPRESSED', result.stderr);
    assert.ok(fs.readdirSync(path.join(root, 'chisle-spill')).some(name => name.endsWith('.txt')));
    assert.ok(fs.readdirSync(path.join(root, 'chisle-dedup')).some(name => name.endsWith('.json')));
    assert.ok(fs.existsSync(path.join(root, '.chisle-compress-stats.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('installed plugin still compresses when the config dir is type:module', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-mod-'));
  try {
    const { spawnSync } = require('child_process');
    const cli = path.join(__dirname, '..', 'bin', 'install.js');
    const r = spawnSync(process.execPath, [cli, '--only', 'opencode'], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, {
        HOME: home, USERPROFILE: home, CHISLE_HOME: home,
        XDG_CONFIG_HOME: '', OPENCODE_CONFIG_DIR: '',
      }),
    });
    assert.equal(r.status, 0, r.stderr);

    const oc = path.join(home, '.config', 'opencode');
    fs.writeFileSync(path.join(oc, 'package.json'), '{ "type": "module" }\n');

    const probe = `
      const big = Array.from({length:500},(_,i)=>'line '+i+' '+'x'.repeat(80)).join('\\n');
      import(${JSON.stringify('file://' + path.join(oc, 'plugins', 'chisle.js'))})
        .then(async (m) => {
          const hooks = await m.default({});
          const out = { output: big };
          await hooks['tool.execute.after']({ tool: 'bash' }, out);
          process.stdout.write(out.output.length < big.length ? 'COMPRESSED' : 'NOOP');
        });
    `;
    const p = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
    assert.equal(p.stdout, 'COMPRESSED', 'core failed to load under type:module: ' + p.stderr);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
