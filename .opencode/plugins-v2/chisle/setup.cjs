'use strict';

const fs = require('fs');
const path = require('path');

function load(name) {
  try { return require(path.join(__dirname, 'chisle-hooks', name)); }
  catch (error) {
    if (error && error.code !== 'MODULE_NOT_FOUND') throw error;
    return require(path.join(__dirname, '..', '..', '..', 'hooks', name));
  }
}

const core = load('chisle-compress-output.js');
const config = load('chisle-config.js');
const { requestedMode } = load('chisle-mode.js');
const CHISLE_MARK = '[chisle:';

function loadRules() {
  for (const root of [config.getOpencodeDir(), path.join(__dirname, '..', '..', '..')]) {
    const skillPath = path.join(root, 'skills', 'chisle', 'SKILL.md');
    try {
      const skill = fs.readFileSync(skillPath, 'utf8').trim();
      return { skillPath, texts: [skill, skill.replace(/^---[\s\S]*?---\s*/, '').trim()].filter(Boolean) };
    } catch (_) {}
  }
  return { texts: [] };
}

function withoutRules(text, rules, sources) {
  let updated = text.replace(/<!-- chisle-begin -->(?:(?!<!-- chisle-begin -->)[\s\S])*?<!-- chisle-end -->/g, '');
  for (const rule of rules.texts) {
    for (const newline of ['\n', '\r\n']) {
      updated = updated.split(`Instructions from: ${rules.skillPath}${newline}${rule}`).join('');
    }
    // Raw rule text needs an owned source; equal user-authored text is not enough.
    if (updated === rule && Array.isArray(sources) && sources.length === 1 &&
        sources[0] && sources[0].key === rules.skillPath && sources[0].text === rule) updated = '';
  }
  return updated;
}

function withoutRuleMetadata(metadata, rules) {
  const original = metadata && metadata.experimental && metadata.experimental.instructions;
  if (!Array.isArray(original)) return metadata;
  const instructions = original.flatMap(entry => {
    if (!entry || typeof entry.text !== 'string') return [entry];
    if (entry.key === rules.skillPath && rules.texts.includes(entry.text)) return [];
    if (entry.key !== 'core/instructions') return [entry];
    const text = withoutRules(entry.text, rules);
    if (text === entry.text) return [entry];
    return text.trim() ? [{ ...entry, text }] : [];
  });
  if (instructions.length === original.length && instructions.every((entry, i) => entry === original[i])) return metadata;
  return { ...metadata, experimental: { ...metadata.experimental, instructions } };
}

function withoutSystemRules(system, rules) {
  const updated = system.flatMap(part => {
    if (!part || part.type !== 'text' || typeof part.text !== 'string') return [part];
    const sources = part.metadata && part.metadata.experimental && part.metadata.experimental.instructions;
    const text = withoutRules(part.text, rules, sources);
    const metadata = withoutRuleMetadata(part.metadata, rules);
    if (text !== part.text && !text.trim()) return [];
    if (text === part.text && metadata === part.metadata) return [part];
    return [{ ...part, text, ...(metadata === part.metadata ? {} : { metadata }) }];
  });
  return updated.length === system.length && updated.every((part, i) => part === system[i]) ? system : updated;
}

module.exports = async function setup(ctx) {
  const rules = loadRules();
  const pending = new Map();
  const registrations = [];
  const active = new Set();
  let unloading;
  const cleanup = () => {
    if (!unloading) unloading = (async () => {
      await Promise.allSettled(registrations.splice(0).map(registration => registration.dispose()));
      await Promise.allSettled([...active]);
    })();
    return unloading;
  };
  const track = callback => async event => {
    if (unloading) return;
    const operation = Promise.resolve().then(() => callback(event));
    active.add(operation);
    try { return await operation; }
    finally { active.delete(operation); }
  };
  const validID = id => typeof id === 'string' && id.trim().length > 0;
  const validMode = mode => mode === 'on' || mode === 'off';

  function serialize(sessionID, operation) {
    const next = (pending.get(sessionID) || Promise.resolve()).catch(() => {}).then(operation);
    pending.set(sessionID, next);
    return next.finally(() => {
      if (pending.get(sessionID) === next) pending.delete(sessionID);
    });
  }

  async function resolveMode(sessionID, ancestry = new Set()) {
    if (!validID(sessionID)) return config.getDefaultMode();
    if (ancestry.has(sessionID) || ancestry.size >= 64) throw new Error('Invalid Chisle ancestry');
    const key = `mode/${sessionID}`;
    const stored = await ctx.storage.get(key);
    if (validMode(stored)) return stored;
    const info = await ctx.session.get({ sessionID });
    if (!info || typeof info !== 'object') throw new Error('Missing Chisle session');
    const parentID = info.parentID ?? (info.fork && info.fork.sessionID);
    if (parentID == null) return config.getDefaultMode();
    if (!validID(parentID)) throw new Error('Invalid Chisle parent');
    const mode = await resolveMode(parentID, new Set([...ancestry, sessionID]));
    // Resolve ancestry outside the queue; recheck inside it so initialization
    // cannot overwrite a concurrent explicit toggle or deadlock cyclic parents.
    return serialize(sessionID, async () => {
      const current = await ctx.storage.get(key);
      if (validMode(current)) return current;
      await ctx.storage.set(key, mode);
      return mode;
    });
  }

  async function modeFor(sessionID) {
    try { return await resolveMode(sessionID); }
    catch (_) { return config.getDefaultMode(); }
  }

  try {
    registrations.push(await ctx.session.hook('prompt', track(async event => {
      try {
        if (!event || !validID(event.sessionID) || !event.prompt || typeof event.prompt.text !== 'string') return;
        const mode = requestedMode(event.prompt.text);
        if (mode) await serialize(event.sessionID, () => ctx.storage.set(`mode/${event.sessionID}`, mode));
      } catch (_) {}
    })));
    for (const kind of ['context', 'compaction', 'generate', 'title']) {
      registrations.push(await ctx.session.hook(kind, track(async event => {
        try {
          if (event && Array.isArray(event.system) && await modeFor(event.sessionID) === 'off') {
            event.system = withoutSystemRules(event.system, rules);
          }
        } catch (_) {}
      })));
    }
    registrations.push(await ctx.tool.hook('execute.after', track(async (event) => {
      try {
        if (!event || event.status !== 'completed' || !event.result || typeof event.result !== 'object' || typeof event.tool !== 'string') return;
        const mode = await modeFor(event.sessionID);
        if (mode === 'off') return;
        const content = event.result.content;
        const compress = (text) => {
          if (typeof text !== 'string') return text;
          if (text.includes(CHISLE_MARK) && text.length <= core.limitsFor().maxChars) return text;
          const updated = core.compressForOpencode(event.tool, text, {
            mode, sessionId: event.sessionID, callId: event.id, command: event.input && event.input.command,
          });
          if (updated == null || updated.length >= text.length) return text;
          core.recordSavings(text.length - updated.length, config.getOpencodeStateDir());
          return updated;
        };
        const updated = typeof content === 'string'
          ? compress(content)
          : Array.isArray(content)
            ? content.map((part) => part && part.type === 'text' ? { ...part, text: compress(part.text) } : part)
            : content;
        if (updated !== content) event.result = { ...event.result, content: updated };
      } catch (_) {}
    })));
  } catch (error) {
    await cleanup();
    throw error;
  }
  return cleanup;
};
