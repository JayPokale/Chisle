#!/usr/bin/env node
// chisle — UserPromptSubmit hook
// Handles /chisle commands, natural language activation/deactivation, and
// per-turn reinforcement.

const fs = require('fs');
const path = require('path');
const { getClaudeDir, safeWriteFlag, readFlag } = require('./chisle-config');
const { requestedMode } = require('./chisle-mode');

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
          additionalContext:
            'CHISLE ACTIVE. ' +
            'Prose: drop articles/filler/pleasantries/hedging. Fragments OK. ' +
            'Code: YAGNI ladder first (reuse → stdlib → native → dep → one line → min code). ' +
            'Code/commits/security: write normal.'
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
