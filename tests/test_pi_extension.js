#!/usr/bin/env node

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const chisleExtension = require('../pi-extension');

const ENV_KEYS = [
  'CHISLE_COMPRESS', 'CHISLE_COMPRESS_DEDUP', 'CHISLE_COMPRESS_SCRUB',
  'CHISLE_COMPRESS_TOOLS', 'CHISLE_DEFAULT_MODE',
];
const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function bigOutput(lines = 500) {
  return Array.from({ length: lines }, (_, i) => `line ${i} ${'x'.repeat(80)}`).join('\n');
}

function makeEventBus() {
  const listeners = new Map();
  return {
    on(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
      return () => listeners.set(name, handlers.filter(candidate => candidate !== handler));
    },
    emit(name, data) { for (const handler of listeners.get(name) || []) handler(data); },
  };
}

function makeHarness({ entries = [], contextEntries = entries, hasUI = true, tools = [], eventBus = makeEventBus() } = {}) {
  const handlers = new Map();
  const commands = new Map();
  const appended = [];
  const statuses = [];
  const notifications = [];
  const pi = {
    on(name, handler) { handlers.set(name, handler); },
    registerCommand(name, command) { commands.set(name, command); },
    appendEntry(customType, data) { appended.push({ type: 'custom', customType, data }); },
    getAllTools() { return tools; },
    events: eventBus,
  };
  chisleExtension(pi);
  const ctx = {
    hasUI,
    ui: {
      theme: { fg: (_color, text) => text },
      setStatus: (key, value) => statuses.push([key, value]),
      notify: (message, level) => notifications.push([message, level]),
    },
    sessionManager: {
      getBranch: () => entries,
      buildContextEntries: () => contextEntries,
    },
  };
  return { handlers, commands, appended, statuses, notifications, ctx };
}

async function start(harness) {
  await harness.handlers.get('session_start')({ type: 'session_start', reason: 'startup' }, harness.ctx);
}

function toolEvent(toolName, text, extra = {}) {
  return {
    type: 'tool_result', toolName, toolCallId: 'call-1', input: {},
    content: [{ type: 'text', text }], details: { keep: true }, isError: false,
    usage: { input: 1 }, ...extra,
  };
}

test('compresses safe Pi tool text and patches content only', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness();
  await start(h);
  const result = await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx);

  assert.deepEqual(Object.keys(result), ['content']);
  assert.match(result.content[0].text, /\[chisle: elided/);
  assert.equal(result.content[0].type, 'text');
  assert.match(h.statuses.at(-1)[1], /⇣/);
});

test('never compresses read, edit, or write, even when env-allowlisted', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  process.env.CHISLE_COMPRESS_TOOLS = 'read,edit,write';
  const h = makeHarness();
  await start(h);
  for (const name of ['read', 'edit', 'write']) {
    assert.equal(await h.handlers.get('tool_result')(toolEvent(name, bigOutput()), h.ctx), undefined);
  }
});

test('preserves non-text blocks and compresses explicitly allowlisted extension tools', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness({
    tools: [{ name: 'web_search', sourceInfo: { source: '/tmp/search-extension.js' } }],
  });
  await start(h);
  const image = { type: 'image', data: 'abc', mimeType: 'image/png' };
  const event = toolEvent('web_search', bigOutput(), { content: [image, { type: 'text', text: bigOutput() }] });
  assert.equal(await h.handlers.get('tool_result')(event, h.ctx), undefined);

  process.env.CHISLE_COMPRESS_TOOLS = 'web_search';
  const result = await h.handlers.get('tool_result')(event, h.ctx);
  assert.equal(result.content[0], image);
  assert.match(result.content[1].text, /\[chisle: elided/);
});

test('compression kill switches and explicit Pi allowlist work', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness();
  await start(h);

  process.env.CHISLE_COMPRESS = '0';
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);
  delete process.env.CHISLE_COMPRESS;

  process.env.CHISLE_COMPRESS_TOOLS = 'grep';
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);
  assert.match((await h.handlers.get('tool_result')(toolEvent('grep', bigOutput()), h.ctx)).content[0].text, /elided/);
});

test('injects rules once, skips an existing AGENTS.md ruleset, and reinjects after compaction', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness();
  await start(h);
  const before = h.handlers.get('before_agent_start');
  const event = { type: 'before_agent_start', systemPrompt: '', systemPromptOptions: { contextFiles: [] } };

  const first = await before(event, h.ctx);
  assert.equal(first.message.customType, 'chisle-rules');
  assert.match(first.message.content, /CHISLE ACTIVE/);
  assert.equal(await before(event, h.ctx), undefined);

  await h.handlers.get('session_compact')({ type: 'session_compact' }, h.ctx);
  assert.ok(await before(event, h.ctx), 'rules not restored after compaction removed them');

  const tagline = makeHarness();
  await start(tagline);
  assert.ok(await tagline.handlers.get('before_agent_start')({
    ...event,
    systemPromptOptions: { contextFiles: [{ content: '# Chisle\n\nChisle — maximum-efficiency dev mode.' }] },
  }, tagline.ctx), 'tagline without rules suppressed injection');

  const covered = makeHarness();
  await start(covered);
  assert.equal(await covered.handlers.get('before_agent_start')({
    ...event,
    systemPromptOptions: { contextFiles: [{ content: '# Chisle\n\n## Prose: zero fluff\n\n## Code: the efficiency ladder' }] },
  }, covered.ctx), undefined);
});

test('duplicate extension copies coordinate first-turn rules injection', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const eventBus = makeEventBus();
  const first = makeHarness({ eventBus });
  const second = makeHarness({ eventBus });
  await start(first);
  await start(second);
  const event = { systemPrompt: '', systemPromptOptions: { contextFiles: [] } };

  assert.ok(await first.handlers.get('before_agent_start')(event, first.ctx));
  assert.equal(await second.handlers.get('before_agent_start')(event, second.ctx), undefined);

  assert.deepEqual(await first.handlers.get('input')({ text: 'stop chisle', source: 'interactive' }, first.ctx),
    { action: 'handled' });
  assert.equal(await second.handlers.get('tool_result')(toolEvent('bash', bigOutput()), second.ctx), undefined,
    'second extension copy ignored shared mode change');
  const disabled = await first.handlers.get('before_agent_start')({ systemPrompt: 'base' }, first.ctx);
  assert.equal(await second.handlers.get('before_agent_start')({ systemPrompt: disabled.systemPrompt }, second.ctx), undefined);
});

test('resume sees persisted rules and mode state without duplicate injection', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const entries = [
    { type: 'custom', customType: 'chisle-mode', data: { mode: 'off' } },
    { type: 'custom_message', customType: 'chisle-rules', content: 'rules' },
  ];
  const h = makeHarness({ entries });
  await start(h);
  const before = await h.handlers.get('before_agent_start')({ systemPrompt: 'base', systemPromptOptions: {} }, h.ctx);
  assert.match(before.systemPrompt, /CHISLE DISABLED/);
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);
  assert.equal(h.statuses.at(-1)[1], undefined);
});

test('session tree navigation restores branch mode and clears dedup state', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const entries = [{ type: 'custom', customType: 'chisle-mode', data: { mode: 'off' } }];
  const h = makeHarness({ entries, contextEntries: [] });
  await start(h);
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);

  entries.length = 0;
  await h.handlers.get('session_tree')({ type: 'session_tree' }, h.ctx);
  assert.ok(await h.handlers.get('before_agent_start')({ systemPrompt: '', systemPromptOptions: {} }, h.ctx));

  const text = 'clean '.repeat(500);
  await h.handlers.get('turn_start')({ turnIndex: 0 }, h.ctx);
  await h.handlers.get('tool_result')(toolEvent('bash', text), h.ctx);
  await h.handlers.get('session_tree')({ type: 'session_tree' }, h.ctx);
  await h.handlers.get('turn_start')({ turnIndex: 1 }, h.ctx);
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', text), h.ctx), undefined,
    'dedup used output from the branch left by /tree');
});

test('default off starts dormant but explicit /chisle enables', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'off';
  const h = makeHarness();
  await start(h);
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);
  await h.commands.get('chisle').handler('', h.ctx);
  assert.match((await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx)).content[0].text, /elided/);
});

test('/chisle and natural stop toggle both axes', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness();
  await start(h);
  const input = h.handlers.get('input');

  assert.deepEqual(await input({ text: 'stop chisle', source: 'interactive' }, h.ctx), { action: 'handled' });
  assert.deepEqual(h.appended.at(-1).data, { mode: 'off' });
  assert.match((await h.handlers.get('before_agent_start')({ systemPrompt: 'base' }, h.ctx)).systemPrompt,
    /CHISLE DISABLED/);
  const filtered = await h.handlers.get('context')({ messages: [
    { role: 'custom', customType: 'chisle-rules' }, { role: 'user', content: 'keep' },
  ] }, h.ctx);
  assert.deepEqual(filtered.messages, [{ role: 'user', content: 'keep' }]);
  assert.equal(await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx), undefined);

  await h.commands.get('chisle').handler('on', h.ctx);
  assert.deepEqual(h.appended.at(-1).data, { mode: 'on' });
  assert.match((await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx)).content[0].text, /elided/);
});

test('dedup ignores parallel siblings but marks repeats from an earlier turn', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness();
  await start(h);
  const text = 'clean '.repeat(500);
  const turn = h.handlers.get('turn_start');
  const result = h.handlers.get('tool_result');

  await turn({ turnIndex: 0 }, h.ctx);
  assert.equal(await result(toolEvent('bash', text), h.ctx), undefined);
  assert.equal(await result(toolEvent('bash', text, { toolCallId: 'sibling' }), h.ctx), undefined);

  await turn({ turnIndex: 1 }, h.ctx);
  const duplicate = await result(toolEvent('bash', text, { toolCallId: 'later' }), h.ctx);
  assert.match(duplicate.content[0].text, /byte-identical to an earlier bash result/);
});

test('headless sessions never call UI status methods', async () => {
  process.env.CHISLE_DEFAULT_MODE = 'on';
  const h = makeHarness({ hasUI: false });
  await start(h);
  await h.handlers.get('tool_result')(toolEvent('bash', bigOutput()), h.ctx);
  await h.handlers.get('session_shutdown')({}, h.ctx);
  assert.deepEqual(h.statuses, []);
});
