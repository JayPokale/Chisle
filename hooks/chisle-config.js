#!/usr/bin/env node
// chisle — shared configuration resolver
//
// Resolution order for default mode:
//   1. CHISLE_DEFAULT_MODE environment variable
//   2. User config: $XDG_CONFIG_HOME/chisle/config.json, ~/.config/chisle/config.json
//   3. 'on'

const fs = require('fs');
const path = require('path');
const os = require('os');

// One mode. The intensity levels are gone: three dials on a tool whose whole
// argument is "fewer knobs" was the joke writing itself, and the middle setting
// was the only one ever benchmarked. 'on' or 'off'.
const VALID_MODES = ['off', 'on'];

// Values that meant something before 3.0.0. Kept only so the upgrade can say
// "your setting no longer does anything" instead of ignoring it in silence.
const LEGACY_MODES = ['lite', 'full', 'ultra'];

// Returns the stale value and where it came from, or null. Never throws.
function legacySetting() {
  const env = process.env.CHISLE_DEFAULT_MODE;
  if (env && LEGACY_MODES.includes(String(env).toLowerCase())) {
    return { value: String(env).toLowerCase(), source: 'CHISLE_DEFAULT_MODE' };
  }
  try {
    const p = path.join(getConfigDir(), 'config.json');
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    const v = c && c.defaultMode ? String(c.defaultMode).toLowerCase() : null;
    if (v && LEGACY_MODES.includes(v)) return { value: v, source: p };
  } catch (e) {}
  return null;
}

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

// OpenCode's global config dir. The compressor plugin keeps its spill/dedup/
// stats here (as Copilot uses getCopilotDir), so recovery files sit beside
// OpenCode's own config instead of leaking into ~/.claude.
function getOpencodeDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'opencode');
  }
  return path.join(os.homedir(), '.config', 'opencode');
}

// GitHub Copilot CLI's own user-level state directory (mirrors the
// CLAUDE_CONFIG_DIR precedent above). Copilot CLI already reads/writes hook
// config under this same directory (~/.copilot/hooks/), so chisle's
// dedup/spill/stats state lives alongside it rather than under ~/.claude,
// which would be misleading for a machine that never runs Claude Code.
function getCopilotDir() {
  return process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot');
}

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'chisle');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'chisle'
    );
  }
  return path.join(os.homedir(), '.config', 'chisle');
}

function readModeFromConfigFile(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    if (config && config.defaultMode &&
        VALID_MODES.includes(String(config.defaultMode).toLowerCase())) {
      return String(config.defaultMode).toLowerCase();
    }
  } catch (e) {}
  return null;
}

function getDefaultMode() {
  const envMode = process.env.CHISLE_DEFAULT_MODE;
  if (envMode && VALID_MODES.includes(envMode.toLowerCase())) {
    return envMode.toLowerCase();
  }
  const userMode = readModeFromConfigFile(path.join(getConfigDir(), 'config.json'));
  if (userMode) return userMode;
  return 'on';
}

// ── Section suppression ─────────────────────────────────────────────────────
// Optional config key letting a user drop Chisle's prose rules or code rules
// independently, while keeping the other. Config file only — no env override,
// unlike defaultMode. Absent, malformed, or non-boolean always falls back to
// enabled (true); never throws.
//   { "sections": { "prose": false } }   // suppress prose rules, keep code

// Headings from skills/chisle/SKILL.md, grouped by section.
const PROSE_HEADINGS = [
  'Prose: Maximum Signal Per Token',
  'Output Format',
  'What it sounds like',
];
const CODE_HEADINGS = [
  'Code: The Efficiency Ladder',
  'Code Rules',
  'Context Diet: Read Less Into the Window',
];

function readSectionsFromConfigFile(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const s = config && typeof config === 'object' ? config.sections : null;
    return {
      prose: !!(s && typeof s === 'object' && typeof s.prose === 'boolean' ? s.prose : true),
      code: !!(s && typeof s === 'object' && typeof s.code === 'boolean' ? s.code : true),
    };
  } catch (e) {
    return { prose: true, code: true };
  }
}

function getSections() {
  return readSectionsFromConfigFile(path.join(getConfigDir(), 'config.json'));
}

// Drops whole `## Heading` sections (heading line through the line before the
// next `## ` heading) whose heading is in an excluded group. Byte-identical
// to `content` when nothing is excluded. Never throws — falls back to the
// unfiltered content. Assumes no `## ` line appears inside a fenced code
// block (true for SKILL.md and the fallback ruleset at 07c603b).
function filterSections(content, sections, proseHeadings, codeHeadings) {
  try {
    if (typeof content !== 'string' || !content) return content;
    const prose = sections ? sections.prose !== false : true;
    const code = sections ? sections.code !== false : true;
    if (prose && code) return content;

    const dropProse = proseHeadings || PROSE_HEADINGS;
    const dropCode = codeHeadings || CODE_HEADINGS;

    const chunks = content.split(/(?=^## .+$)/m);
    const kept = chunks.filter((chunk) => {
      const m = /^## (.+)$/m.exec(chunk);
      if (!m) return true; // preamble chunk (no heading)
      const heading = m[1].trim();
      if (!prose && dropProse.includes(heading)) return false;
      if (!code && dropCode.includes(heading)) return false;
      return true;
    });
    return kept.join('');
  } catch (e) {
    return content;
  }
}

// Symlink-safe, atomic flag write with 0600 perms.
// Defends against local attacker replacing predictable path with symlink to clobber other files.
function safeWriteFlag(flagPath, content) {
  const debug = process.env.CHISLE_DEBUG === '1';
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    let realFlagDir;
    try {
      const lstat = fs.lstatSync(flagDir);
      if (lstat.isSymbolicLink()) {
        realFlagDir = fs.realpathSync(flagDir);
        const realStat = fs.statSync(realFlagDir);
        if (!realStat.isDirectory()) {
          if (debug) process.stderr.write(`[chisle] safeWriteFlag: symlink target not a directory\n`);
          return;
        }
        if (typeof process.getuid === 'function') {
          if (realStat.uid !== process.getuid()) {
            if (debug) process.stderr.write(`[chisle] safeWriteFlag: symlink target owned by different uid\n`);
            return;
          }
        } else {
          const home = os.homedir();
          const normalizedReal = path.resolve(realFlagDir).toLowerCase();
          const normalizedHome = path.resolve(home).toLowerCase();
          if (!normalizedReal.startsWith(normalizedHome + path.sep) &&
              normalizedReal !== normalizedHome) {
            if (debug) process.stderr.write(`[chisle] safeWriteFlag: symlink target outside home dir\n`);
            return;
          }
        }
      } else {
        realFlagDir = flagDir;
      }
    } catch (e) {
      return;
    }

    const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
    try {
      if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(realFlagDir, `.chisle-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) {}
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realFlagPath);
  } catch (e) {}
}

// Symlink-safe, size-capped, whitelist-validated flag read.
// Refuses symlinks, caps at 64 bytes, rejects unknown modes.
const MAX_FLAG_BYTES = 64;

function readFlag(flagPath) {
  try {
    let st;
    try {
      st = fs.lstatSync(flagPath);
    } catch (e) {
      return null;
    }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }

    const raw = out.trim().toLowerCase();
    if (!VALID_MODES.includes(raw)) return null;
    return raw;
  } catch (e) {
    return null;
  }
}

module.exports = {
  LEGACY_MODES, legacySetting, getDefaultMode, getClaudeDir, getCopilotDir, getOpencodeDir,
  VALID_MODES, safeWriteFlag, readFlag,
  PROSE_HEADINGS, CODE_HEADINGS, getSections, filterSections,
};
