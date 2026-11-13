'use strict';

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
const CHISLE_MARK = '[chisle:';

module.exports = async function setup(ctx) {
  await ctx.tool.hook('execute.after', async (event) => {
    try {
      if (!event || event.status !== 'completed' || !event.result) return;
      const content = event.result.content;
      const compress = (text) => {
        if (typeof text !== 'string') return text;
        if (text.includes(CHISLE_MARK) && text.length <= core.limitsFor().maxChars) return text;
        const updated = core.compressForOpencode(event.tool, text, {
          mode: config.getDefaultMode(),
          sessionId: event.sessionID,
          callId: event.id,
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
  });
};
