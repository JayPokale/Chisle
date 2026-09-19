#!/usr/bin/env node
// chisle — UserPromptSubmit hook
// Handles /chisle commands, natural language activation/deactivation, and
// per-turn reinforcement.

const fs = require('fs');
const path = require('path');
const { getClaudeDir, safeWriteFlag, readFlag, getSections } = require('./chisle-config');
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
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: reinforcementLine(getSections())
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
