'use strict';
// `npx chisle tools [trim|restore] [--days N] [--also A,B] [--dry-run] [--config-dir <dir>]`
//
// Every Claude Code request carries fixed overhead the model may never use:
//   - the full schema of every loaded tool. On the maintainer's machine
//     `Artifact` alone was ~54k chars, with SendFeedback, Workflow and
//     ScheduleWakeup another ~26k, none called in 38 sessions. A whole-tool
//     `permissions.deny` entry drops a schema (measured: 24.2k -> 20.5k tokens
//     for five tools).
//   - the skill listing, a name plus a description per skill (~8-14k chars).
//     `skillOverrides: { name: "name-only" }` keeps a skill listed and
//     invocable by name but drops its description.
//
//   tools          report sizes vs. your own usage; changes nothing
//   tools trim     deny unused heavy tools and list unused skills name-only,
//                  judged over --days (default 30); --also A,B adds rarely used
//                  tools you choose (never core tools)
//   tools restore  undo exactly what `trim` changed
//
// Sizes come from the prompt snapshots and skill listings Claude Code writes
// into transcripts; usage from the tool and Skill calls in the same
// transcripts. Core tools are never trimmed, and neither are MCP tools (Claude
// Code already defers those).

const fs = require('fs');
const path = require('path');
const SETTINGS = require('./settings');

const CORE = new Set(['Bash', 'Read', 'Edit', 'MultiEdit', 'Write', 'Glob', 'Grep', 'NotebookEdit',
  'Agent', 'Task', 'TodoWrite', 'ToolSearch', 'Skill', 'WebFetch', 'WebSearch', 'AskUserQuestion',
  'EnterPlanMode', 'ExitPlanMode', 'Monitor', 'TaskStop', 'TaskCreate', 'TaskGet', 'TaskList',
  'TaskUpdate', 'SendMessage', 'ListAgents', 'LSP']);
const MIN_CHARS = 2000;        // smaller schemas are not worth a deny entry
const MIN_SKILL_CHARS = 150;   // shorter descriptions are not worth an override
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

// Largest schema / description seen per tool and skill, calls of each, and the
// request count, over the window.
function scan(files) {
  const size = {}, calls = {}, skillSize = {}, skillCalls = {}, listings = []; let requests = 0;
  for (const f of files) {
    let text; try { text = fs.readFileSync(f, 'utf8'); } catch (_) { continue; }
    const seen = new Set();
    for (const line of text.split('\n')) {
      if (line.includes('"prompt_snapshot"')) {
        let e; try { e = JSON.parse(line); } catch (_) { continue; }
        const tools = e.attachment && Array.isArray(e.attachment.tools) ? e.attachment.tools : [];
        for (const t of tools) if (t && t.name) size[t.name] = Math.max(size[t.name] || 0, JSON.stringify(t).length);
      } else if (line.includes('"skill_listing"')) {
        let e; try { e = JSON.parse(line); } catch (_) { continue; }
        const listing = e.attachment && typeof e.attachment.content === 'string' ? e.attachment.content : '';
        const entries = [];
        for (const item of listing.split(/\n(?=- )/)) {
          const k = item.indexOf(': ');           // names may contain ':' (plugin:skill)
          if (!item.startsWith('- ') || k < 0) continue;
          const name = item.slice(2, k);
          skillSize[name] = Math.max(skillSize[name] || 0, item.length - k - 2);
          entries.push([name, item.length - k - 2]);
        }
        if (entries.length) listings.push(entries);
      } else if (line.includes('"tool_use"') || line.includes('"usage"')) {
        let e; try { e = JSON.parse(line); } catch (_) { continue; }
        const m = e.message;
        if (!m || e.type !== 'assistant') continue;
        if (m.usage && m.id && !seen.has(m.id)) { seen.add(m.id); requests++; }
        for (const b of Array.isArray(m.content) ? m.content : []) {
          if (b.type !== 'tool_use') continue;
          calls[b.name] = (calls[b.name] || 0) + 1;
          const s = b.name === 'Skill' && b.input && b.input.skill;
          if (s) skillCalls[s] = (skillCalls[s] || 0) + 1;
        }
      }
    }
  }
  return { size, calls, skillSize, skillCalls, listings, requests };
}

function plan(claudeDir, days) {
  const files = transcripts(claudeDir, Date.now() - days * 864e5);
  const { size, calls, skillSize, skillCalls, listings, requests } = scan(files);
  const rows = Object.entries(size)
    .filter(([name, chars]) => chars >= MIN_CHARS && !name.startsWith('mcp__'))
    .map(([name, chars]) => ({ name, chars, tokens: Math.round(chars / CHARS_PER_TOKEN), calls: calls[name] || 0,
      trim: !CORE.has(name) && !calls[name] }))
    .sort((a, b) => b.chars - a.chars);
  const skills = Object.entries(skillSize)
    .filter(([, chars]) => chars >= MIN_SKILL_CHARS)
    .map(([name, chars]) => ({ name, chars, tokens: Math.round(chars / 4), calls: skillCalls[name] || 0, trim: !skillCalls[name] }))
    .sort((a, b) => b.chars - a.chars);
  // A session lists only its own project's skills, so the per-request saving
  // is the average over real listings, not the sum of every skill ever seen.
  const unused = new Set(skills.filter((x) => x.trim).map((x) => x.name));
  const skillSaving = listings.length ? Math.round(listings.reduce((t, l) => t + l.reduce((u, [n, c]) => u + (unused.has(n) ? c : 0), 0), 0) / listings.length / 4) : 0;
  return { rows, skills, skillSaving, sessions: files.length, requests };
}

function readRecord(claudeDir) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(claudeDir, RECORD), 'utf8'));
    return { added: r.added || [], skills: r.skills || [] };
  } catch (_) { return { added: [], skills: [] }; }
}

function load(claudeDir) {
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = SETTINGS.readSettings(settingsPath);
  if (!settings) throw new Error(`${settingsPath} is not valid JSON; not touching it`);
  return { settingsPath, settings };
}

// Undo exactly what `trim` changed; the user's own deny rules and skill
// overrides are left alone.
function restore(claudeDir, { dryRun = false } = {}) {
  const rec = readRecord(claudeDir);
  if (!rec.added.length && !rec.skills.length) return [];
  const { settingsPath, settings } = load(claudeDir);
  const deny = (settings.permissions && settings.permissions.deny) || [];
  const overrides = settings.skillOverrides || {};
  const removed = rec.added.filter((n) => deny.includes(n))
    .concat(rec.skills.filter((n) => overrides[n] === 'name-only').map((n) => `skill ${n}`));
  if (!dryRun) {
    if (settings.permissions) {
      settings.permissions.deny = deny.filter((n) => !rec.added.includes(n));
      if (!settings.permissions.deny.length) delete settings.permissions.deny;
      if (!Object.keys(settings.permissions).length) delete settings.permissions;
    }
    if (settings.skillOverrides) {
      for (const n of rec.skills) if (settings.skillOverrides[n] === 'name-only') delete settings.skillOverrides[n];
      if (!Object.keys(settings.skillOverrides).length) delete settings.skillOverrides;
    }
    SETTINGS.writeSettings(settingsPath, settings);
    fs.rmSync(path.join(claudeDir, RECORD), { force: true });
  }
  return removed;
}

function trim(claudeDir, names, skillNames = [], { dryRun = false } = {}) {
  const { settingsPath, settings } = load(claudeDir);
  const deny = (settings.permissions && settings.permissions.deny) || [];
  const overrides = settings.skillOverrides || {};
  const fresh = names.filter((n) => !deny.includes(n));
  const freshSkills = skillNames.filter((n) => !(n in overrides));   // never override the user's own choice
  if (!dryRun && (fresh.length || freshSkills.length)) {
    if (fresh.length) {
      settings.permissions = settings.permissions || {};
      settings.permissions.deny = deny.concat(fresh);
    }
    if (freshSkills.length) {
      settings.skillOverrides = overrides;
      for (const n of freshSkills) overrides[n] = 'name-only';
    }
    SETTINGS.writeSettings(settingsPath, settings);
    const rec = readRecord(claudeDir);
    const next = { added: [...new Set(rec.added.concat(fresh))], skills: [...new Set(rec.skills.concat(freshSkills))] };
    fs.writeFileSync(path.join(claudeDir, RECORD), JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  }
  return { tools: fresh, skills: freshSkills };
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
    out(removed.length ? `  ${o.dryRun ? 'would undo' : 'undid'}: ${removed.join(', ')}` : '  nothing to restore');
    return;
  }

  const { rows, skills, skillSaving, sessions, requests } = plan(claudeDir, o.days);
  if (!rows.length && !skills.length) {
    out(`  no tool schemas or skill listings found in ${sessions} session(s) from the last ${o.days} days (needs a recent Claude Code).`);
    return;
  }
  out(`  sent on every request vs. your calls, last ${o.days} days (${sessions} sessions, ${requests} requests):\n`);
  for (const r of rows) out(`  ${r.name.padEnd(30)} ~${String(r.tokens).padStart(6)} tok   ${String(r.calls).padStart(5)} calls   ${r.trim ? 'unused → deny' : CORE.has(r.name) ? 'core' : 'used'}`);
  if (skills.length) out('');
  for (const s of skills) out(`  skill ${s.name.padEnd(24)} ~${String(s.tokens).padStart(6)} tok   ${String(s.calls).padStart(5)} calls   ${s.trim ? 'unused → name-only' : 'used'}`);
  for (const r of rows) if (o.also.includes(r.name)) r.trim = true;
  const pick = rows.filter((r) => r.trim), pickSkills = skills.filter((s) => s.trim);
  const perRequest = pick.reduce((s, r) => s + r.tokens, 0) + skillSaving;
  out(`\n  trimming ${pick.length} tool(s) and ${pickSkills.length} skill description(s) saves ~${perRequest.toLocaleString('en-US')} tokens on every request` +
    (requests ? ` (~${(perRequest * requests / 1e6).toFixed(1)}M over these ${requests} requests).` : '.'));

  if (o.action === 'trim') {
    const done = trim(claudeDir, pick.map((r) => r.name), pickSkills.map((s) => s.name), o);
    const what = [];
    if (done.tools.length) what.push(`denied ${done.tools.join(', ')}`);
    if (done.skills.length) what.push(`listed ${done.skills.length} skill(s) name-only`);
    out(what.length ? `  ${o.dryRun ? 'would have ' : ''}${what.join('; ')}. Undo: npx chisle tools restore` : '  nothing new to trim.');
  } else if (pick.length || pickSkills.length) {
    out(`  apply with: npx chisle tools trim${o.also.length ? ' --also ' + o.also.join(',') : ''}   (undo: npx chisle tools restore)`);
  }
}

module.exports = { main, plan, trim, restore, CORE };
