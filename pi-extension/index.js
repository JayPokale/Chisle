'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getDefaultMode } = require('../hooks/chisle-config');
const { duplicateMarker, limitsFor, transform } = require('../hooks/chisle-compress-output');
const { requestedMode } = require('../hooks/chisle-mode');

const RULES_TYPE = 'chisle-rules';
const MODE_TYPE = 'chisle-mode';
const SAFE_TOOLS = new Set(['bash', 'powershell', 'grep', 'find', 'ls']);
const NEVER_COMPRESS = new Set(['read', 'edit', 'write']);
const DEDUP_MIN = 2048;
const FALLBACK_RULES = `CHISLE ACTIVE

Chisle: maximum-efficiency dev mode. Zero-fluff prose. YAGNI-first code.

Drop articles, filler, pleasantries, and hedging. Fragments OK; technical terms exact.
Code ladder: YAGNI → reuse → stdlib → native → installed dependency → one line → minimum code.
Never simplify away input validation, data-loss prevention, security, accessibility, or explicit requirements.`;

function loadRules() {
  try {
    const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'chisle', 'SKILL.md'), 'utf8');
    return 'CHISLE ACTIVE\n\n' + skill.replace(/^---[\s\S]*?---\s*/, '');
  } catch (_) {
    return FALLBACK_RULES;
  }
}

function hasRulesEntry(entries) {
  return (entries || []).some(entry =>
    (entry.type === 'custom_message' && entry.customType === RULES_TYPE) ||
    (entry.type === 'message' && entry.message && entry.message.role === 'custom' &&
      entry.message.customType === RULES_TYPE));
}

function promptHasRules(event) {
  const containsRules = text => /^# Chisle\s*$/m.test(text || '') &&
    (text || '').includes('## Prose: zero fluff') &&
    (text || '').includes('## Code: the efficiency ladder');
  if (containsRules(event.systemPrompt)) return true;
  return (event.systemPromptOptions && event.systemPromptOptions.contextFiles || [])
    .some(file => containsRules(file.content));
}

function piToolAllowed(name) {
  if (!name || NEVER_COMPRESS.has(name.toLowerCase())) return false;
  if (process.env.CHISLE_COMPRESS_TOOLS) {
    return process.env.CHISLE_COMPRESS_TOOLS.split(',').map(s => s.trim()).filter(Boolean).includes(name);
  }
  return SAFE_TOOLS.has(name.toLowerCase()) || name.startsWith('mcp__');
}

function chisleExtension(pi) {
  const rules = loadRules();
  let active = getDefaultMode() !== 'off';
  let rulesInContext = false;
  let savedChars = 0;
  let lastByToolBlock = new Map();
  let dedupBaseline = new Map();
  const stopRulesSignal = pi.events.on('chisle:rules-injected', () => { rulesInContext = true; });
  const stopModeSignal = pi.events.on('chisle:mode', mode => { active = mode === 'on'; });

  function updateStatus(ctx) {
    if (!ctx.hasUI) return;
    if (!active) return ctx.ui.setStatus('chisle', undefined);
    const tokens = Math.floor(savedChars / 4);
    const saved = tokens >= 1000 ? ` ⇣${Math.floor(tokens / 1000)}k tok` : tokens ? ` ⇣${tokens} tok` : '';
    ctx.ui.setStatus('chisle', ctx.ui.theme.fg('accent', `[CHISLE]${saved}`));
  }

  function restoreBranch(ctx) {
    active = getDefaultMode() !== 'off';
    savedChars = 0;
    lastByToolBlock = new Map();
    dedupBaseline = new Map();

    const modeEntry = ctx.sessionManager.getBranch()
      .filter(entry => entry.type === 'custom' && entry.customType === MODE_TYPE).pop();
    if (modeEntry && modeEntry.data && ['on', 'off'].includes(modeEntry.data.mode)) {
      active = modeEntry.data.mode === 'on';
    }
    rulesInContext = hasRulesEntry(ctx.sessionManager.buildContextEntries());
    updateStatus(ctx);
  }

  function setMode(request, ctx) {
    active = request === 'on';
    pi.events.emit('chisle:mode', active ? 'on' : 'off');
    pi.appendEntry(MODE_TYPE, { mode: active ? 'on' : 'off' });
    updateStatus(ctx);
    if (ctx.hasUI) ctx.ui.notify(active ? 'Chisle enabled.' : 'Chisle disabled.', 'info');
  }

  pi.registerCommand('chisle', {
    description: 'Enable Chisle or set /chisle on|off',
    handler: async (args, ctx) => {
      const request = requestedMode(`/chisle ${args || ''}`) || 'on';
      setMode(request, ctx);
    },
  });

  pi.on('session_start', async (_event, ctx) => restoreBranch(ctx));
  pi.on('session_tree', async (_event, ctx) => restoreBranch(ctx));

  pi.on('session_shutdown', async (_event, ctx) => {
    lastByToolBlock.clear();
    dedupBaseline.clear();
    stopRulesSignal();
    stopModeSignal();
    if (ctx.hasUI) ctx.ui.setStatus('chisle', undefined);
  });

  pi.on('session_compact', async (_event, ctx) => {
    lastByToolBlock.clear();
    dedupBaseline.clear();
    rulesInContext = hasRulesEntry(ctx.sessionManager.buildContextEntries());
  });

  pi.on('input', async (event, ctx) => {
    if (event.source === 'extension') return { action: 'continue' };
    const request = requestedMode(event.text);
    if (!request) return { action: 'continue' };
    setMode(request, ctx);
    return request === 'off' ? { action: 'handled' } : { action: 'continue' };
  });

  pi.on('before_agent_start', async event => {
    if (!active) {
      if (event.systemPrompt.includes('CHISLE DISABLED.')) return;
      return { systemPrompt: event.systemPrompt + '\n\nCHISLE DISABLED. Ignore only Chisle style and efficiency-ladder instructions.' };
    }
    if (rulesInContext || promptHasRules(event)) return;
    rulesInContext = true;
    pi.events.emit('chisle:rules-injected');
    return { message: { customType: RULES_TYPE, content: rules, display: false } };
  });

  pi.on('context', async event => {
    if (active) return;
    return { messages: event.messages.filter(message =>
      !(message.role === 'custom' && message.customType === RULES_TYPE)) };
  });

  pi.on('turn_start', async () => {
    dedupBaseline = new Map(lastByToolBlock);
  });

  pi.on('tool_result', async (event, ctx) => {
    try {
      if (!active || process.env.CHISLE_COMPRESS === '0' || !piToolAllowed(event.toolName) ||
          !Array.isArray(event.content)) return;

      let changed = false;
      const content = event.content.map((block, index) => {
        if (!block || block.type !== 'text' || typeof block.text !== 'string') return block;
        const text = block.text;
        const key = `${event.toolName}:${index}`;
        let updated = null;

        if (process.env.CHISLE_COMPRESS_DEDUP !== '0' && text.length >= DEDUP_MIN) {
          const hash = crypto.createHash('sha256').update(text).digest('hex');
          const previous = dedupBaseline.get(key);
          lastByToolBlock.set(key, hash);
          if (previous === hash) updated = duplicateMarker(event.toolName, text, 'earlier');
        }
        if (updated == null) updated = transform(text, limitsFor());
        if (updated == null || updated.length >= text.length) return block;
        changed = true;
        savedChars += text.length - updated.length;
        return { ...block, text: updated };
      });

      if (!changed) return;
      updateStatus(ctx);
      return { content };
    } catch (_) {
      return;
    }
  });
}

module.exports = chisleExtension;
module.exports.loadRules = loadRules;
module.exports.hasRulesEntry = hasRulesEntry;
module.exports.piToolAllowed = piToolAllowed;
