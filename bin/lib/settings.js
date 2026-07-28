// chisle — JSONC-tolerant settings.json read/write + defensive hook validation.
//
// Claude Code applies strict Zod to settings.json: one malformed hook silently
// discards the WHOLE file. So every mutation validates before write, and reads
// tolerate the // and /* */ comments users sometimes add.
//
// Public API:
//   readSettings(path)                  → object, {}, or null on hard parse failure
//   writeSettings(path, obj)            → atomic write, mode 0600
//   stripJsonComments(src)              → comment + trailing-comma stripped
//   validateHookFields(settings)        → mutates: drops malformed hook entries
//   hasHook(settings, ev, marker)       → idempotency probe
//   addCommandHook(settings, ev, opts)  → no-op if marker already present
//   removeHooks(settings, marker)       → uninstall helper
//
// Pure stdlib, CommonJS, Node ≥18.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── stripJsonComments ──────────────────────────────────────────────────────
// State machine tracking string + escape state so a comment-looking sequence
// inside a quoted string survives. Trailing commas swept in a final pass.
function stripJsonComments(src) {
  if (typeof src !== 'string') return src;
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false, stringChar = '', inLine = false, inBlock = false;
  while (i < n) {
    const c = src[i];
    const next = i + 1 < n ? src[i + 1] : '';
    if (inLine) { if (c === '\n') { inLine = false; out += c; } i++; continue; }
    if (inBlock) { if (c === '*' && next === '/') { inBlock = false; i += 2; continue; } i++; continue; }
    if (inString) {
      out += c;
      if (c === '\\') { if (i + 1 < n) { out += src[i + 1]; i += 2; continue; } }
      if (c === stringChar) inString = false;
      i++; continue;
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; out += c; i++; continue; }
    if (c === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && next === '*') { inBlock = true; i += 2; continue; }
    out += c; i++;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

// ── readSettings ───────────────────────────────────────────────────────────
// Strict JSON fast path → JSONC fallback → null (never silently clobber a
// recoverable file with {}).
function readSettings(p) {
  if (!fs.existsSync(p)) return {};
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (e) { process.stderr.write(`chisle: cannot read ${p}: ${e.message}\n`); return null; }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw.replace(/^﻿/, '')); } catch (_) {}
  try { return JSON.parse(stripJsonComments(raw.replace(/^﻿/, ''))); }
  catch (e) {
    process.stderr.write(`chisle: warning — ${p} is not valid JSON/JSONC: ${e.message}\n`);
    return null;
  }
}

// ── writeSettings ──────────────────────────────────────────────────────────
// Atomic: temp + rename. mode 0600 (settings often holds tokens).
function writeSettings(p, obj) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(p)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, p);
}

// ── validateHookFields ─────────────────────────────────────────────────────
// Mutate-to-valid before write. Drops any entry Claude Code's Zod would reject.
function validateHookFields(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  if (!settings.hooks || typeof settings.hooks !== 'object') return settings;
  for (const ev of Object.keys(settings.hooks)) {
    const arr = settings.hooks[ev];
    if (!Array.isArray(arr)) { delete settings.hooks[ev]; continue; }
    settings.hooks[ev] = arr.filter(entry => {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.hooks)) return false;
      entry.hooks = entry.hooks.filter(h => {
        if (!h || typeof h !== 'object') return false;
        if (h.type === 'command') return typeof h.command === 'string' && h.command.length > 0;
        return false;
      });
      return entry.hooks.length > 0;
    });
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return settings;
}

// ── idempotency probe ──────────────────────────────────────────────────────
function hasHook(settings, event, marker) {
  const arr = settings && settings.hooks && settings.hooks[event];
  if (!Array.isArray(arr)) return false;
  return arr.some(e => e && Array.isArray(e.hooks) &&
    e.hooks.some(h => h && typeof h.command === 'string' && h.command.includes(marker)));
}

// ── addCommandHook ─────────────────────────────────────────────────────────
function addCommandHook(settings, event, opts) {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
  const marker = opts.marker || opts.command;
  if (hasHook(settings, event, marker)) return false;
  const hook = { type: 'command', command: opts.command };
  if (typeof opts.timeout === 'number') hook.timeout = opts.timeout;
  if (typeof opts.statusMessage === 'string') hook.statusMessage = opts.statusMessage;
  const entry = { hooks: [hook] };
  if (typeof opts.matcher === 'string') entry.matcher = opts.matcher;
  settings.hooks[event].push(entry);
  return true;
}

// ── removeHooks (uninstall) ────────────────────────────────────────────────
function removeHooks(settings, marker) {
  if (!settings || !settings.hooks) return 0;
  validateHookFields(settings);
  if (!settings.hooks) return 0;
  let removed = 0;
  for (const ev of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[ev])) { delete settings.hooks[ev]; continue; }
    const before = settings.hooks[ev].length;
    settings.hooks[ev] = settings.hooks[ev].filter(entry => {
      if (!entry || !Array.isArray(entry.hooks)) return true;
      return !entry.hooks.some(h => h && typeof h.command === 'string' && h.command.includes(marker));
    });
    removed += before - settings.hooks[ev].length;
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return removed;
}

module.exports = {
  stripJsonComments, readSettings, writeSettings,
  validateHookFields, hasHook, addCommandHook, removeHooks,
};
