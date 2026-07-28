#!/usr/bin/env node
// chisle — UserPromptSubmit hook
// Handles /chisle commands, natural language activation/deactivation, and
// per-turn reinforcement.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, safeWriteFlag, readFlag } = require('./chisle-config');

const claudeDir = getClaudeDir();
const flagPath = path.join(claudeDir, '.chisle-active');

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim();
    const promptLower = prompt.toLowerCase();

    // Natural language activation
    if (/\b(activate|enable|turn on|start|use)\b.*\bchisle\b/i.test(promptLower) ||
        /\bchisle\b.*\b(mode|activate|enable|on)\b/i.test(promptLower) ||
        /\bchislif(y|ier)\b/i.test(promptLower)) {
      if (!/\b(stop|disable|turn off|deactivate|off)\b/i.test(promptLower)) {
        const mode = getDefaultMode();
        if (mode !== 'off') safeWriteFlag(flagPath, mode);
      }
    }

    // /chisle slash commands. No level argument any more: /chisle on,
    // /chisle off, nothing else.
    if (/^\/chisle(\b|:chisle\b)/.test(promptLower)) {
      const parts = promptLower.split(/\s+/);
      const arg = parts[1] || '';
      if (arg === 'off' || arg === 'stop' || arg === 'disable') {
        try { fs.unlinkSync(flagPath); } catch (e) {}
      } else {
        const mode = getDefaultMode();
        if (mode !== 'off') safeWriteFlag(flagPath, mode);
      }
    }

    // Natural language deactivation.
    // Only fire when the off-verb actually targets chisle — NOT when chisle merely
    // appears in a sentence that also mentions turning something else off.
    // ("use chisle to turn off the logger" must NOT deactivate.)
    if (/\b(turn off|disable|deactivate|stop|kill|exit)\s+chisle\b/i.test(promptLower) ||
        /\bchisle\s+(mode\s+)?(off|stop|disable|deactivate)\b/i.test(promptLower) ||
        /\bnormal mode\b/i.test(promptLower)) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
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
