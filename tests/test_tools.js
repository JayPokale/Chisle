'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const TOOLS = require('../bin/lib/tools');

// A fake Claude config dir: one transcript with a prompt snapshot and some calls.
function fixture(settings) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chisle-tools-'));
  const proj = path.join(dir, 'projects', 'p');
  fs.mkdirSync(proj, { recursive: true });
  const schema = (name, n) => ({ name, description: 'x'.repeat(n), schema: {} });
  const lines = [
    { type: 'attachment', attachment: { type: 'prompt_snapshot', tools: [schema('Bash', 9000), schema('Artifact', 50000), schema('Workflow', 9000), schema('Tiny', 100), schema('mcp__srv__big', 9000)] } },
    { type: 'assistant', message: { id: 'm1', usage: { input_tokens: 1 }, content: [{ type: 'tool_use', name: 'Bash', input: {} }] } },
    { type: 'assistant', message: { id: 'm2', usage: { input_tokens: 1 }, content: [{ type: 'tool_use', name: 'Artifact', input: {} }] } },
  ];
  fs.writeFileSync(path.join(proj, 's.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  if (settings) fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings));
  return dir;
}
const deny = (dir) => (JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).permissions || {}).deny;

test('tools plan: only heavy, unused, non-core, non-MCP tools are trim candidates', () => {
  const dir = fixture();
  const { rows, requests } = TOOLS.plan(dir, 30);
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(requests, 2);
  assert.equal(byName.Workflow.trim, true);
  assert.equal(byName.Artifact.trim, false);   // used once
  assert.equal(byName.Bash.trim, false);       // core
  assert.equal(byName.Tiny, undefined);        // below size floor
  assert.equal(byName.mcp__srv__big, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('tools trim then restore leaves the user\'s own deny rules intact', () => {
  const dir = fixture({ permissions: { deny: ['Bash(rm -rf:*)'], allow: ['Read'] }, model: 'opus' });
  const out = [];
  TOOLS.main(['trim', '--also', 'Artifact'], dir, (s) => out.push(s));
  assert.deepEqual(deny(dir), ['Bash(rm -rf:*)', 'Artifact', 'Workflow']);
  TOOLS.main(['trim'], dir, () => {});         // idempotent
  assert.deepEqual(deny(dir), ['Bash(rm -rf:*)', 'Artifact', 'Workflow']);
  TOOLS.main(['restore'], dir, () => {});
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  assert.deepEqual(s.permissions, { deny: ['Bash(rm -rf:*)'], allow: ['Read'] });
  assert.equal(s.model, 'opus');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('tools refuses to deny core tools and changes nothing on --dry-run', () => {
  const dir = fixture({});
  assert.throws(() => TOOLS.main(['trim', '--also', 'Bash'], dir, () => {}), /core/);
  TOOLS.main(['trim', '--dry-run'], dir, () => {});
  assert.equal(deny(dir), undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});
