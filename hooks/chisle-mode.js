'use strict';

// Shared mode-directive parser. Harness adapters decide how to persist mode.
function requestedMode(prompt) {
  const text = String(prompt || '').trim().toLowerCase();

  if (/\b(turn off|disable|deactivate|stop|kill|exit)\s+chisle\b/i.test(text) ||
      /\bchisle\s+(mode\s+)?(off|stop|disable|deactivate)\b/i.test(text) ||
      /\bnormal mode\b/i.test(text)) return 'off';

  if (/^\/chisle(\b|:chisle\b)/.test(text) ||
      /\b(activate|enable|turn on|start|use)\b.*\bchisle\b/i.test(text) ||
      /\bchisle\b.*\b(mode|activate|enable|on)\b/i.test(text) ||
      /\bchislif(y|ier)\b/i.test(text)) return 'on';

  return null;
}

module.exports = { requestedMode };
