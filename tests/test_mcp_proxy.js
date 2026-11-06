#!/usr/bin/env node
// MCP proxy (hooks/chisle-mcp-proxy.js) end to end against a fake stdio
// server, plus `npx chisle mcp wrap|unwrap|status` and Copilot CLI install,
// all inside temp dirs. Run: node --test tests/test_mcp_proxy.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PROXY = path.join(ROOT, 'hooks', 'chisle-mcp-proxy.js');
const SERVER = path.join(__dirname, 'fixtures', 'fake-mcp-server.js');
const CLI = path.join(ROOT, 'bin', 'install.js');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const rpc = (id, method, params) => JSON.stringify({ jsonrpc: '2.0', id, method, params });

function proxy(lines, env) {
  const r = spawnSync(process.execPath, [PROXY, '--', process.execPath, SERVER], {
    input: lines.join('\n') + '\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, CHISLE_DEFAULT_MODE: 'on', CHISLE_COMPRESS: '', ...env },
  });
  const byId = {};
  const raw = {};
  for (const l of r.stdout.split('\n').filter(Boolean)) { const m = JSON.parse(l); byId[m.id] = m; raw[m.id] = l; }
  return { status: r.status, byId, raw };
}

function direct(lines) {
  const r = spawnSync(process.execPath, [SERVER], { input: lines.join('\n') + '\n', encoding: 'utf8' });
  const raw = {};
  for (const l of r.stdout.split('\n').filter(Boolean)) raw[JSON.parse(l).id] = l;
  return raw;
}

const LINES = [
  rpc(1, 'initialize', {}),
  rpc(2, 'tools/list'),
  rpc('a', 'tools/call', { name: 'run_logs', arguments: {} }),
  rpc(4, 'tools/call', { name: 'read_file', arguments: {} }),
  rpc(5, 'tools/call', { name: 'run_logs_fail', arguments: {} }),
];

test('proxy compresses tools/call text, salvages the mid-log error, spills the original', () => {
  const state = tmp('chisle-mcp-state-');
  const { status, byId } = proxy(LINES, { CHISLE_STATE_DIR: state });
  assert.equal(status, 0);
  const text = byId.a.result.content[0].text;
  assert.ok(text.length < 5000, 'compressed: ' + text.length);
  assert.match(text, /\[chisle:/);
  assert.match(text, /ERROR: run_logs exploded/);
  assert.equal(byId[5].result.isError, true, 'isError flag kept');
  const stats = JSON.parse(fs.readFileSync(path.join(state, '.chisle-compress-stats.json'), 'utf8'));
  assert.equal(stats.events, 2);
  const spilled = fs.readdirSync(path.join(state, 'chisle-spill'));
  assert.ok(spilled.some(f => f.startsWith('mcp-run_logs-')), spilled.join(','));
  fs.rmSync(state, { recursive: true, force: true });
});

test('proxy forwards everything that is not an allowed tool result byte-identical', () => {
  const state = tmp('chisle-mcp-state-');
  const { raw } = proxy(LINES, { CHISLE_STATE_DIR: state });
  const orig = direct(LINES);
  assert.equal(raw[1], orig[1], 'initialize');
  assert.equal(raw[2], orig[2], 'tools/list is not a tool result');
  assert.equal(raw[4], orig[4], 'read_file feeds edits: never compressed');
  fs.rmSync(state, { recursive: true, force: true });
});

test('proxy is a pure pass-through when compression is off', () => {
  const state = tmp('chisle-mcp-state-');
  for (const env of [{ CHISLE_COMPRESS: '0' }, { CHISLE_DEFAULT_MODE: 'off' }]) {
    const { raw } = proxy(LINES, { CHISLE_STATE_DIR: state, ...env });
    assert.deepEqual(raw, direct(LINES), JSON.stringify(env));
  }
  assert.ok(!fs.existsSync(path.join(state, '.chisle-compress-stats.json')));
  fs.rmSync(state, { recursive: true, force: true });
});

test('proxy exits with the server exit code; missing server exits 127', () => {
  const state = tmp('chisle-mcp-state-');
  assert.equal(proxy([rpc(1, 'initialize', {})], { CHISLE_STATE_DIR: state, FAKE_MCP_EXIT: '7' }).status, 7);
  const r = spawnSync(process.execPath, [PROXY, '--', 'chisle-no-such-binary-xyz'], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 127);
  assert.match(r.stderr, /cannot start/);
  fs.rmSync(state, { recursive: true, force: true });
});

test('unit: responses to unknown ids and cancelled calls stay untouched', () => {
  const { rewriteLine, observeRequest } = require(PROXY);
  const pending = new Map();
  const big = JSON.stringify({ jsonrpc: '2.0', id: 9, result: { content: [{ type: 'text', text: 'x\n'.repeat(9000) }] } });
  assert.equal(rewriteLine(big, pending), big, 'no pending call');
  observeRequest(rpc(9, 'tools/call', { name: 'logs' }), pending);
  observeRequest(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 9 } }), pending);
  assert.equal(rewriteLine(big, pending), big, 'cancelled call');
  assert.equal(rewriteLine('not json "result"', pending), 'not json "result"');
});

// ── npx chisle mcp ──────────────────────────────────────────────────────────

function cli(args, env) {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }) };
  } catch (e) { return { status: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

function isolated() {
  const home = tmp('chisle-home-');
  const xdg = tmp('chisle-xdg-');
  return { home, xdg, env: { CHISLE_HOME: home, XDG_CONFIG_HOME: xdg, COPILOT_HOME: '', CODEX_HOME: '', CLAUDE_CONFIG_DIR: path.join(home, '.claude') } };
}

test('mcp wrap routes stdio servers through the proxy; unwrap restores them exactly', () => {
  const { home, xdg, env } = isolated();
  const file = path.join(home, '.cursor', 'mcp.json');
  const original = {
    mcpServers: {
      gh: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { TOKEN: 'x' } },
      bare: { command: 'my-server' },
      remote: { url: 'https://example.com/mcp' },
    },
    other: true,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(original, null, 2));

  const dry = cli(['mcp', 'wrap', '--dry-run'], env);
  assert.match(dry.out, /would wrap gh, bare/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original, 'dry run wrote');

  cli(['mcp', 'wrap'], env);
  const wrapped = JSON.parse(fs.readFileSync(file, 'utf8')).mcpServers;
  const proxyPath = path.join(xdg, 'chisle', 'mcp-proxy', 'chisle-mcp-proxy.js');
  assert.deepEqual(wrapped.gh, { command: 'node', args: [proxyPath, '--', 'npx', '-y', '@modelcontextprotocol/server-github'], env: { TOKEN: 'x' } });
  assert.deepEqual(wrapped.bare.args, [proxyPath, '--', 'my-server']);
  assert.deepEqual(wrapped.remote, original.mcpServers.remote, 'url server untouched');
  assert.ok(fs.existsSync(proxyPath) && fs.existsSync(path.join(path.dirname(proxyPath), 'chisle-compress-output.js')));
  assert.ok(fs.existsSync(file + '.chisle-bak'));

  assert.match(cli(['mcp', 'wrap'], env).out, /nothing to wrap/, 'idempotent');
  assert.match(cli(['mcp', 'status'], env).out, /Cursor: 2\/2 stdio server\(s\) wrapped/);

  cli(['mcp', 'unwrap'], env);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});

test('mcp wrap leaves JSONC files alone and never touches Claude config', () => {
  const { home, xdg, env } = isolated();
  const gemini = path.join(home, '.gemini', 'settings.json');
  const jsonc = '{\n  // mine\n  "mcpServers": { "a": { "command": "x" } }\n}\n';
  fs.mkdirSync(path.dirname(gemini), { recursive: true });
  fs.writeFileSync(gemini, jsonc);
  const claude = path.join(home, '.claude.json');
  const claudeTxt = JSON.stringify({ mcpServers: { a: { command: 'x' } } });
  fs.writeFileSync(claude, claudeTxt);

  assert.match(cli(['mcp', 'wrap'], env).out, /not strict JSON/);
  assert.equal(fs.readFileSync(gemini, 'utf8'), jsonc);
  assert.equal(fs.readFileSync(claude, 'utf8'), claudeTxt);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});

test('uninstall dry-run reports restoring wrapped MCP servers', () => {
  const { home, xdg, env } = isolated();
  const file = path.join(home, '.kiro', 'settings', 'mcp.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { a: { command: 'x' } } }));
  cli(['mcp', 'wrap'], env);
  const before = fs.readFileSync(file, 'utf8');
  const r = cli(['--uninstall', '--dry-run', '--no-color'], { ...env, PATH: path.dirname(process.execPath) });
  assert.match(r.out, /restored 1 MCP server command/);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'dry run wrote');
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});

// ── Copilot CLI ─────────────────────────────────────────────────────────────

test('copilot-cli install writes ruleset + postToolUse hook; uninstall removes only ours', () => {
  const { home, xdg, env } = isolated();
  const root = path.join(home, '.copilot');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'copilot-instructions.md'), 'my rules\n');

  const r = cli(['--only', 'copilot-cli', '--no-color'], env);
  assert.match(r.out, /Copilot CLI detected/);
  const md = fs.readFileSync(path.join(root, 'copilot-instructions.md'), 'utf8');
  assert.ok(md.startsWith('my rules\n') && md.includes('<!-- chisle-begin -->'));
  const hook = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'chisle.json'), 'utf8'));
  const cmd = hook.hooks.postToolUse[0].bash;
  assert.equal(hook.version, 1);
  assert.match(cmd, /chisle-hooks[\\/]chisle-compress-output\.js"$/);

  // The installed hook answers a real Copilot payload with modifiedResult.
  const text = Array.from({ length: 3000 }, (_, i) => 'line ' + i).join('\n') + '\n<shellId: 0 completed with exit code 3>';
  const out = execFileSync(process.execPath, [path.join(root, 'chisle-hooks', 'chisle-compress-output.js')], {
    input: JSON.stringify({ sessionId: 's', toolName: 'bash', toolArgs: {}, toolResult: { resultType: 'success', textResultForLlm: text } }),
    encoding: 'utf8', env: { ...process.env, ...env, COPILOT_HOME: root, CHISLE_DEFAULT_MODE: '' },
  });
  const res = JSON.parse(out).modifiedResult;
  assert.ok(res.textResultForLlm.length < text.length / 3);
  assert.match(res.textResultForLlm, /exit code 3>$/);

  assert.match(cli(['--only', 'copilot-cli'], env).out, /already/, 'idempotent');

  cli(['--uninstall', '--only', 'copilot-cli'], env);
  assert.equal(fs.readFileSync(path.join(root, 'copilot-instructions.md'), 'utf8'), 'my rules\n');
  assert.ok(!fs.existsSync(path.join(root, 'hooks', 'chisle.json')));
  assert.ok(!fs.existsSync(path.join(root, 'chisle-hooks')));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});

test('copilot hook follows CHISLE_DEFAULT_MODE=off', () => {
  const text = 'x\n'.repeat(9000);
  const out = execFileSync(process.execPath, [path.join(ROOT, 'hooks', 'chisle-compress-output.js')], {
    input: JSON.stringify({ sessionId: 's', toolName: 'bash', toolResult: { resultType: 'success', textResultForLlm: text } }),
    encoding: 'utf8', env: { ...process.env, CHISLE_DEFAULT_MODE: 'off', COPILOT_HOME: tmp('chisle-cp-') },
  });
  assert.equal(out, '');
});

test('mcp wrap covers Codex TOML: only command/args lines change, unwrap restores the values', () => {
  const { home, xdg, env } = isolated();
  const file = path.join(home, '.codex', 'config.toml');
  const original = [
    'model = "gpt-5"  # keep me',
    '',
    '[mcp_servers.context7]',
    'command = "npx"',
    'args = [',
    '  "-y",',
    '  "@upstash/context7-mcp", # pinned',
    ']',
    'env = { KEY = "x" }',
    '',
    '[mcp_servers."my server"]',
    "command = 'my-server'",
    '',
    '[mcp_servers.remote]',
    'url = "https://example.com/mcp"',
    '',
    '[profiles.fast]',
    'model = "gpt-5-mini"',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, original);

  assert.match(cli(['mcp', 'wrap', '--only', 'codex', '--dry-run'], env).out, /would wrap context7, my server/);
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'dry run wrote');

  cli(['mcp', 'wrap', '--only', 'codex'], env);
  const proxyPath = path.join(xdg, 'chisle', 'mcp-proxy', 'chisle-mcp-proxy.js');
  const wrapped = fs.readFileSync(file, 'utf8');
  assert.ok(wrapped.includes(`command = "node"\nargs = [${JSON.stringify(proxyPath)}, "--", "npx", "-y", "@upstash/context7-mcp"]\nenv = { KEY = "x" }`));
  assert.ok(wrapped.includes(`args = [${JSON.stringify(proxyPath)}, "--", "my-server"]`));
  assert.ok(wrapped.includes('url = "https://example.com/mcp"') && wrapped.includes('model = "gpt-5"  # keep me') && wrapped.includes('[profiles.fast]'));
  assert.match(cli(['mcp', 'status', '--only', 'codex'], env).out, /Codex: 2\/2 stdio server\(s\) wrapped/);

  cli(['mcp', 'unwrap', '--only', 'codex'], env);
  const restored = fs.readFileSync(file, 'utf8');
  assert.ok(restored.includes('[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]\nenv = { KEY = "x" }'));
  assert.ok(restored.includes('[mcp_servers."my server"]\ncommand = "my-server"\n\n[mcp_servers.remote]'));
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});

test('mcp wrap covers Antigravity mcp_config.json and VS Code Copilot mcp.json ("servers")', () => {
  const { home, xdg, env } = isolated();
  const ag = path.join(home, '.gemini', 'config', 'mcp_config.json');
  const vs = path.join(xdg, 'Code', 'User', 'mcp.json');
  const agOrig = { mcpServers: { fs: { command: 'npx', args: ['-y', 'server-fs'] } } };
  const vsOrig = { servers: { mem: { type: 'stdio', command: 'npx', args: ['-y', 'server-memory'] }, web: { type: 'http', url: 'https://x/mcp' } }, inputs: [] };
  for (const [f, o] of [[ag, agOrig], [vs, vsOrig]]) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); }

  const out = cli(['mcp', 'wrap'], env).out;
  assert.match(out, /Antigravity: wrapped fs/);
  assert.match(out, /GitHub Copilot: wrapped mem/);
  const proxyPath = path.join(xdg, 'chisle', 'mcp-proxy', 'chisle-mcp-proxy.js');
  assert.deepEqual(JSON.parse(fs.readFileSync(vs, 'utf8')).servers.mem.args, [proxyPath, '--', 'npx', '-y', 'server-memory']);
  assert.deepEqual(JSON.parse(fs.readFileSync(vs, 'utf8')).servers.web, vsOrig.servers.web, 'http server untouched');

  cli(['mcp', 'unwrap'], env);
  assert.deepEqual(JSON.parse(fs.readFileSync(ag, 'utf8')), agOrig);
  assert.deepEqual(JSON.parse(fs.readFileSync(vs, 'utf8')), vsOrig);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(xdg, { recursive: true, force: true });
});
