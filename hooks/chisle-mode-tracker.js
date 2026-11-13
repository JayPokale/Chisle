#!/usr/bin/env node
// chisle — UserPromptSubmit hook
// Handles /chisle commands, natural language activation/deactivation, and
// per-turn reinforcement.

const fs = require('fs');
const path = require('path');
const { getClaudeDir, safeWriteFlag, readFlag, resolveSections } = require('./chisle-config');
const { requestedMode } = require('./chisle-mode');

// Per-turn reinforcement clauses. `Code/commits/security: write normal.` is
// the Boundaries carve-out (always-on in SKILL.md) and ships regardless of
// `sections`; the prose/code clauses honor it the same way the SessionStart
// ruleset does.
const PROSE_CLAUSE = 'Prose: drop articles/filler/pleasantries/hedging. Fragments OK.';
const CODE_CLAUSE = 'Code: YAGNI ladder first (reuse → stdlib → native → dep → one line → min code).';
const BOUNDARIES_CLAUSE = 'Code/commits/security: write normal.';

function reinforcementLine(sections) {
  const prose = sections ? sections.prose !== false : true;
  const code = sections ? sections.code !== false : true;
  const parts = ['CHISLE ACTIVE.'];
  if (prose) parts.push(PROSE_CLAUSE);
  if (code) parts.push(CODE_CLAUSE);
  parts.push(BOUNDARIES_CLAUSE);
  return parts.join(' ');
}

// Resume nudge. The prompt cache lives about an hour; after a longer break the
// next request re-writes the whole context, and every later turn re-reads it.
// On the maintainer's sessions those re-writes were 14% of spend, and
// compacting at such breaks (never mid-task) simulated to roughly half the
// total. A hook cannot run /compact, so it tells the user, once, at the break.
const RESUME_IDLE_MS = 60 * 60 * 1000;
const RESUME_MIN_CONTEXT = 150000;
const TAIL_BYTES = 512 * 1024;

function resumeWarning(transcriptPath, now = Date.now()) {
  try {
    const size = fs.statSync(transcriptPath).size;
    const fd = fs.openSync(transcriptPath, 'r');
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= (len === size ? 0 : 1); i--) { // line 0 of a partial tail is cut
      let e; try { e = JSON.parse(lines[i]); } catch (_) { continue; }
      const u = e && e.type === 'assistant' && e.message && e.message.model !== '<synthetic>' && e.message.usage;
      if (!u) continue;
      const context = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      const idle = now - Date.parse(e.timestamp);
      if (!(idle > RESUME_IDLE_MS) || context < RESUME_MIN_CONTEXT) return null;
      const mins = Math.round(idle / 60000);
      const gap = mins < 120 ? `${mins} min` : mins < 2880 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
      return `chisle: ${gap} idle, so the prompt cache has expired. This turn re-sends the whole ` +
        `~${Math.round(context / 1000)}k-token context and every later turn re-reads it. ` +
        'Run /compact to continue from a summary, or /clear if this is a new task.';
    }
  } catch (e) {}
  return null;
}

const claudeDir = getClaudeDir();
const flagPath = path.join(claudeDir, '.chisle-active');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim();
    const request = requestedMode(prompt);

    if (request === 'off') {
      try { fs.unlinkSync(flagPath); } catch (e) {}
    } else if (request === 'on') {
      safeWriteFlag(flagPath, 'on');
    }

    // Per-turn reinforcement
    const activeMode = readFlag(flagPath);
    if (activeMode && activeMode !== 'off') {
      // Inject compact reminder — keeps chisle visible across context compression
      const out = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: reinforcementLine(resolveSections({ cwd: process.cwd(), claudeDir }))
        }
      };
      const warning = data.transcript_path ? resumeWarning(data.transcript_path) : null;
      if (warning) out.systemMessage = warning;
      process.stdout.write(JSON.stringify(out));
    }
  } catch (e) {
    // Silent fail
  }
});
