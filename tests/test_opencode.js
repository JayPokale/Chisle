#!/usr/bin/env node
// OpenCode tool-output compression tests — allowlist, compression decision,
// and the plugin's tool.execute.after hook mutating output in place.
// Run: node --test tests/test_opencode.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// State (spill/dedup) must not leak into ~/.claude during tests.
process.env.CHISLE_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-oc-'));

const {
  opencodeToolAllowed, compressForOpencode, THRESHOLDS,
} = require('../hooks/chisle-compress-output');

function bigOutput(lines, prefix) {
  return Array.from({ length: lines }, (_, i) => `${prefix || 'line'} ${i} ${'x'.repeat(80)}`).join('\n');
}

// ── allowlist ────────────────────────────────────────────────────────────────

test('opencodeToolAllowed allows lowercase read-heavy builtins', () => {
  for (const t of ['bash', 'grep', 'glob', 'webfetch', 'websearch', 'task', 'list']) {
    assert.equal(opencodeToolAllowed(t), true, t);
  }
});

test('opencodeToolAllowed excludes read/edit/write (output feeds exact edits)', () => {
  for (const t of ['read', 'edit', 'write', 'patch', 'todowrite', 'todoread']) {
    assert.equal(opencodeToolAllowed(t), false, t);
  }
});

test('opencodeToolAllowed treats server_tool MCP names as compressible', () => {
  assert.equal(opencodeToolAllowed('github-tools_search_code'), true);
  assert.equal(opencodeToolAllowed('ugw-rag_rag_query'), true);
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

test('CHISLE_COMPRESS_TOOLS cannot re-enable read/edit/write', () => {
  process.env.CHISLE_COMPRESS_TOOLS = 'read,edit,write,bash';
  try {
    assert.equal(opencodeToolAllowed('read'), false);
    assert.equal(opencodeToolAllowed('edit'), false);
    assert.equal(opencodeToolAllowed('write'), false);
    assert.equal(opencodeToolAllowed('bash'), true);
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

test('tool.execute.after skips output that already carries a chisle marker', async () => {
  const { default: plugin } = await import('../.opencode/plugins/chisle.mjs');
  const hooks = await plugin({});
  const after = hooks['tool.execute.after'];
  const already = bigOutput(500) + '\n... [chisle: elided 100 lines] ...';
  const out = { title: 't', output: already, metadata: {} };
  await after({ tool: 'bash', callID: 'c' }, out);
  assert.equal(out.output, already);
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
