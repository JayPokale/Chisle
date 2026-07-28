#!/usr/bin/env node
// chisle — UserPromptSubmit hook
// Handles /chisle commands, natural language activation/deactivation, and
// per-turn reinforcement.

const fs = require('fs');
const path = require('path');
const { getDefaultMode, getClaudeDir, VALID_MODES, safeWriteFlag, readFlag } = require('./chisle-config');

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

    // /chisle slash commands
    if (/^\/chisle(\b|:chisle\b)/.test(promptLower)) {
      const parts = promptLower.split(/\s+/);
      const cmd = parts[0];
      const arg = parts[1] || '';

      let mode = null;

      if (cmd === '/chisle' || cmd === '/chisle:chisle') {
        if (!arg) {
          mode = getDefaultMode();
        } else if (arg === 'off' || arg === 'stop' || arg === 'disable') {
          mode = 'off';
        } else if (VALID_MODES.includes(arg)) {
          mode = arg;
        }
      }

      if (mode && mode !== 'off') {
        safeWriteFlag(flagPath, mode);
      } else if (mode === 'off') {
        try { fs.unlinkSync(flagPath); } catch (e) {}
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
      const ladderHint = activeMode === 'ultra'
        ? 'YAGNI extremist: delete before add, challenge req in same breath.'
        : 'Code: YAGNI ladder first (stdlib → native → dep → one line → min code).';

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            'CHISLE MODE ACTIVE (' + activeMode + '). ' +
            'Prose: drop articles/filler/pleasantries/hedging. Fragments OK. ' +
            ladderHint + ' ' +
            'Code/commits/security: write normal.'
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
});
