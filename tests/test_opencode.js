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
const { spawn, spawnSync } = require('child_process');

// State (spill/dedup) must not leak into ~/.claude during tests.
process.env.CHISLE_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-'));

const {
  opencodeToolAllowed, compressForOpencode, boundForOpencode,
  SAFE_TOOLS_OPENCODE, THRESHOLDS,
} = require('../hooks/chisle-compress-output');

function bigOutput(lines, prefix) {
  return Array.from({ length: lines }, (_, i) => `${prefix || 'line'} ${i} ${'x'.repeat(80)}`).join('\n');
}

function recoveryPath(output) {
  const match = output.match(/Full output: (.+?) \(grep it, do not re-run\)/);
  assert.ok(match);
  return match[1];
}

function hasUnpairedSurrogate(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(i + 1);
      if (next < 0xDC00 || next > 0xDFFF) return true;
      i++;
    } else if (code >= 0xDC00 && code <= 0xDFFF) return true;
  }
  return false;
}

function sessionStateFile(stateDir, sessionId) {
  const name = crypto.createHash('sha256').update(sessionId).digest('hex') + '.json';
  return path.join(stateDir, 'chisle-dedup', name);
}

// ── allowlist ────────────────────────────────────────────────────────────────

test('opencodeToolAllowed allows only explicit read-heavy defaults', () => {
  assert.deepEqual(SAFE_TOOLS_OPENCODE, ['bash', 'grep', 'glob', 'webfetch', 'websearch', 'list']);
  for (const t of SAFE_TOOLS_OPENCODE) assert.equal(opencodeToolAllowed(t), true, t);
});

test('opencodeToolAllowed excludes source-bearing and mutating tools', () => {
  for (const t of [
    'read', 'edit', 'write', 'patch', 'apply_patch', 'multiedit',
    'notebookedit', 'notebookread', 'notebook_write', 'notebook_edit',
    'create', 'str_replace', 'insert', 'todowrite', 'todoread',
  ]) assert.equal(opencodeToolAllowed(t), false, t);
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

test('spill preserves the byte-identical pre-scrub output', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-spill-'));
  try {
    const text = `\u001b[31mBEGIN\u001b[0m   \n${bigOutput(200)}\n\n\nEND`;
    const out = compressForOpencode('bash', text, { mode: 'on', stateDir });
    assert.deepEqual(fs.readFileSync(recoveryPath(out)), Buffer.from(text));
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true });
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
test('installed plugin still compresses when the config dir is type:module', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-mod-'));
  try {
    const { spawnSync } = require('child_process');
    const cli = path.join(__dirname, '..', 'bin', 'install.js');
    const r = spawnSync(process.execPath, [cli, '--only', 'opencode'], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }),
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
