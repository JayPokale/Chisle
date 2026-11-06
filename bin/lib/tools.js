'use strict';
// `npx chisle tools [trim|restore] [--days N] [--dry-run] [--config-dir <dir>]`
//
// Every Claude Code request carries the full schema of every loaded tool, used
// or not. A few are large: on the maintainer's machine `Artifact` alone was
// ~54k chars, with SendFeedback, Workflow and ScheduleWakeup another ~26k,
// none of them called in 38 sessions. A whole-tool `permissions.deny` entry
// drops a tool from the request (measured: 24.2k -> 20.5k tokens for five).
//
//   tools          report schema size vs. your own usage; changes nothing
//   tools trim     deny the heavy tools you have not used in --days (default 30);
//                  --also A,B adds rarely used ones you choose (never core tools)
//   tools restore  remove exactly the deny entries `trim` added
//
// Sizes come from the prompt snapshots Claude Code writes into transcripts;
// usage from the tool calls in the same transcripts. Core tools are never
// trimmed, and neither are MCP tools (Claude Code already defers those).

const fs = require('fs');
const path = require('path');
const SETTINGS = require('./settings');

const CORE = new Set(['Bash', 'Read', 'Edit', 'MultiEdit', 'Write', 'Glob', 'Grep', 'NotebookEdit',
  'Agent', 'Task', 'TodoWrite', 'ToolSearch', 'Skill', 'WebFetch', 'WebSearch', 'AskUserQuestion',
  'EnterPlanMode', 'ExitPlanMode', 'Monitor', 'TaskStop', 'TaskCreate', 'TaskGet', 'TaskList',
  'TaskUpdate', 'SendMessage', 'ListAgents', 'LSP']);
const MIN_CHARS = 2000;        // smaller schemas are not worth a deny entry
const CHARS_PER_TOKEN = 5.5;   // measured on tool schemas: 5 denied tools, -3,707 tokens
const RECORD = '.chisle-trimmed-tools.json';

function transcripts(dir, since) {
  const out = [];
  const walk = (d) => {
    let entries; try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) { try { if (fs.statSync(p).mtimeMs >= since) out.push(p); } catch (_) {} }
    }
  };
  walk(path.join(dir, 'projects'));
  return out;
}

// Largest schema seen per tool, calls per tool, and request count, over the window.
function scan(files) {
  const size = {}, calls = {}; let requests = 0;
  for (const f of files) {
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    const seen = new Set();
    for (const line of text.split('\n')) {
      if (line.includes('"prompt_snapshot"')) {
        let e; try { e = JSON.parse(line); } catch (_) { continue; }
        const tools = e.attachment && Array.isArray(e.attachment.tools) ? e.attachment.tools : [];
        for (const t of tools) if (t && t.name) size[t.name] = Math.max(size[t.name] || 0, JSON.stringify(t).length);
      } else if (line.includes('"tool_use"') || line.includes('"usage"')) {
        let e; try { e = JSON.parse(line); } catch (_) { continue; }
        const m = e.message;
        if (!m || e.type !== 'assistant') continue;
        if (m.usage && m.id && !seen.has(m.id)) { seen.add(m.id); requests++; }
        for (const b of Array.isArray(m.content) ? m.content : []) if (b.type === 'tool_use') calls[b.name] = (calls[b.name] || 0) + 1;
      }
    }
  }
  return { size, calls, requests };
}

function plan(claudeDir, days) {
  const files = transcripts(claudeDir, Date.now() - days * 864e5);
  const { size, calls, requests } = scan(files);
  const rows = Object.entries(size)
    .filter(([name, chars]) => chars >= MIN_CHARS && !name.startsWith('mcp__'))
    .map(([name, chars]) => ({ name, chars, tokens: Math.round(chars / CHARS_PER_TOKEN), calls: calls[name] || 0,
      trim: !CORE.has(name) && !calls[name] }))
    .sort((a, b) => b.chars - a.chars);
  return { rows, sessions: files.length, requests };
}

function readRecord(claudeDir) {
  try { return JSON.parse(fs.readFileSync(path.join(claudeDir, RECORD), 'utf8')).added || []; } catch (_) { return []; }
}

// Remove the entries `trim` added; leaves the user's own deny rules alone.
function restore(claudeDir, { dryRun = false } = {}) {
  const added = readRecord(claudeDir);
  if (!added.length) return [];
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = SETTINGS.readSettings(settingsPath);
  if (!settings) throw new Error(`${settingsPath} is not valid JSON; not touching it`);
  const deny = (settings.permissions && settings.permissions.deny) || [];
  const removed = added.filter((n) => deny.includes(n));
  if (!dryRun) {
    if (settings.permissions) {
      settings.permissions.deny = deny.filter((n) => !added.includes(n));
      if (!settings.permissions.deny.length) delete settings.permissions.deny;
      if (!Object.keys(settings.permissions).length) delete settings.permissions;
    }
    SETTINGS.writeSettings(settingsPath, settings);
    fs.rmSync(path.join(claudeDir, RECORD), { force: true });
  }
  return removed;
}

function trim(claudeDir, names, { dryRun = false } = {}) {
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = SETTINGS.readSettings(settingsPath);
  if (!settings) throw new Error(`${settingsPath} is not valid JSON; not touching it`);
  const deny = (settings.permissions && settings.permissions.deny) || [];
  const fresh = names.filter((n) => !deny.includes(n));
  if (!dryRun && fresh.length) {
    settings.permissions = settings.permissions || {};
    settings.permissions.deny = deny.concat(fresh);
    SETTINGS.writeSettings(settingsPath, settings);
    const added = [...new Set(readRecord(claudeDir).concat(fresh))];
    fs.writeFileSync(path.join(claudeDir, RECORD), JSON.stringify({ added }, null, 2) + '\n', { mode: 0o600 });
  }
  return fresh;
}

function main(argv, claudeDir, out = (s) => process.stdout.write(s + '\n')) {
  const o = { action: 'report', days: 30, dryRun: false, also: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'trim' || a === 'restore') o.action = a;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--days') o.days = Number(argv[++i]);
    else if (a === '--also') o.also = String(argv[++i] || '').split(',').map((x) => x.trim()).filter(Boolean);
    else throw new Error('usage: npx chisle tools [trim|restore] [--days N] [--also A,B] [--dry-run] [--config-dir <dir>]');
  }
  const core = o.also.filter((n) => CORE.has(n));
  if (core.length) throw new Error(`refusing to deny core tool(s): ${core.join(', ')}`);
  if (!(o.days > 0)) throw new Error('--days needs a positive number');

  if (o.action === 'restore') {
    const removed = restore(claudeDir, o);
    out(removed.length ? `  ${o.dryRun ? 'would remove' : 'removed'} deny entries: ${removed.join(', ')}` : '  nothing to restore');
    return;
  }

  const { rows, sessions, requests } = plan(claudeDir, o.days);
  if (!rows.length) {
    out(`  no tool schemas found in ${sessions} session(s) from the last ${o.days} days (needs a recent Claude Code).`);
    return;
  }
  out(`  tool schemas sent on every request vs. your calls, last ${o.days} days (${sessions} sessions, ${requests} requests):\n`);
  for (const r of rows) out(`  ${r.name.padEnd(22)} ~${String(r.tokens).padStart(6)} tok   ${String(r.calls).padStart(5)} calls   ${r.trim ? 'unused → trim' : CORE.has(r.name) ? 'core' : 'used'}`);
  for (const r of rows) if (o.also.includes(r.name)) r.trim = true;
  const pick = rows.filter((r) => r.trim);
  const perRequest = pick.reduce((s, r) => s + r.tokens, 0);
  out(`\n  trimming ${pick.length} tool(s) saves ~${perRequest.toLocaleString('en-US')} tokens on every request` +
    (requests ? ` (~${(perRequest * requests / 1e6).toFixed(1)}M over these ${requests} requests).` : '.'));

  if (o.action === 'trim') {
    const added = trim(claudeDir, pick.map((r) => r.name), o);
    out(added.length ? `  ${o.dryRun ? 'would deny' : 'denied'}: ${added.join(', ')}. Undo: npx chisle tools restore` : '  nothing new to deny.');
  } else if (pick.length) {
    out(`  apply with: npx chisle tools trim${o.also.length ? ' --also ' + o.also.join(',') : ''}   (undo: npx chisle tools restore)`);
  }
}

module.exports = { main, plan, trim, restore, CORE };
