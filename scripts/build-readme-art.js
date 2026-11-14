#!/usr/bin/env node
// Builds the animated README art in assets/readme/: a -dark and a -light SVG per
// piece (the README picks one with <picture>). Plain SVG + SMIL, so it animates
// inside GitHub's <img> sandbox with no scripts and no web fonts. Every static
// attribute holds the final frame, so a renderer without SMIL shows the result.
//
// The figures mirror the README's benchmark sections; change them together.
// Race tokens: benchmarks/results/raw-nov-sidebyside/large-s2/statemachine__*.json
// (usage.output_tokens minus thinking_tokens).
//
// Run: node scripts/build-readme-art.js

'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'readme');
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
const ADV = 0.6; // monospace advance per px of font size; the mono layouts assume it

const THEMES = {
  dark: {
    bg: '#0d1117', card: '#161b22', border: '#30363d', text: '#e6edf3', soft: '#c9d1d9', muted: '#8b949e',
    faint: '#6e7681', accent: '#f0a85a', fill: '#d78a3c', track: '#21262d', dot: '#1f2630', bar: '#484f58',
    green: '#3fb950', red: '#f85149', glow: 0.18,
  },
  light: {
    bg: '#ffffff', card: '#f6f8fa', border: '#d0d7de', text: '#1f2328', soft: '#31363c', muted: '#59636e',
    faint: '#818b98', accent: '#b35a14', fill: '#d78a3c', track: '#eaeef2', dot: '#e4e8ec', bar: '#afb8c1',
    green: '#1a7f37', red: '#cf222e', glow: 0.12,
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;
const mono = (size) => ` font-family="${MONO}" font-size="${size}"`;

// One looping timeline. pts: [[seconds, value], ...] in time order; the first and
// last values are held to the loop's ends.
function anim(attr, pts, dur, { ease = false, discrete = false, type } = {}) {
  const p = pts.slice();
  if (p[0][0] > 0) p.unshift([0, p[0][1]]);
  if (p[p.length - 1][0] < dur) p.push([dur, p[p.length - 1][1]]);
  const tag = type ? 'animateTransform' : 'animate';
  let a = `<${tag} attributeName="${attr}"${type ? ` type="${type}"` : ''} values="${p.map((x) => x[1]).join(';')}"` +
    ` keyTimes="${p.map((x) => (x[0] / dur).toFixed(4)).join(';')}" dur="${dur}s" repeatCount="indefinite"`;
  if (discrete) a += ' calcMode="discrete"';
  else if (ease) a += ` calcMode="spline" keySplines="${Array(p.length - 1).fill('0.4 0 0.2 1').join(';')}"`;
  return a + '/>';
}
// Visible from t0 to t1 of each loop.
const shown = (t0, t1, dur, f = 0.25) => anim('opacity', [[t0, 0], [t0 + f, 1], [t1 - f, 1], [t1, 0]], dur);
// Fade and rise in once, `delay` seconds after load.
const enter = (delay) =>
  `<animate attributeName="opacity" values="0;0;1" keyTimes="0;${(delay / (delay + 0.6)).toFixed(3)};1" dur="${delay + 0.6}s" fill="freeze"/>` +
  `<animateTransform attributeName="transform" type="translate" values="0 10;0 10;0 0" keyTimes="0;${(delay / (delay + 0.6)).toFixed(3)};1" dur="${delay + 0.6}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.2 0.7 0.2 1"/>`;

function svg(t, w, h, label, body, defs = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${SANS}" xml:space="preserve" role="img" aria-label="${esc(label)}">
${defs ? `<defs>${defs}</defs>\n` : ''}<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="14" fill="${t.bg}" stroke="${t.border}"/>
${body.join('\n')}
</svg>
`;
}

// A terminal window: card, title bar, traffic lights, centred title.
function win(t, x, y, w, h, title) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${t.card}" stroke="${t.border}"/>` +
    `<path d="M${x} ${y + 32}H${x + w}" stroke="${t.border}"/>` +
    ['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<circle cx="${x + 18 + i * 16}" cy="${y + 16}" r="5" fill="${c}"/>`).join('') +
    `<text x="${x + w / 2}" y="${y + 20.5}"${mono(12)} fill="${t.muted}" text-anchor="middle">${esc(title)}</text>`;
}

// ── Banner: a wordy answer is chiselled down to the line that matters ─────────
const VERBOSE = "Great question! Deep-copying objects in JavaScript can be surprisingly tricky. You could write a recursive helper, or install lodash and use cloneDeep, but honestly the simplest modern approach is structuredClone(config), which is built in, so there's no dependency to install. Hope this helps! Let me know if you have any other questions.";
const KEEP = ['structuredClone(config),', 'built', 'in,', 'no', 'dependency'];

function banner(t) {
  const W = 1200, H = 420, D = 11;
  const defs =
    `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="${t.dot}"/></pattern>` +
    `<radialGradient id="glow" cx="0.8" cy="0.25" r="0.65"><stop offset="0" stop-color="${t.fill}" stop-opacity="${t.glow}"/><stop offset="1" stop-color="${t.fill}" stop-opacity="0"/></radialGradient>` +
    `<filter id="soft" x="-3" y="-1" width="7" height="3"><feGaussianBlur stdDeviation="3"/></filter>`;
  const o = [
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="url(#dots)"/>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="url(#glow)"/>`,
  ];

  // Left: the pitch.
  const pill = 'Claude Code plugin · 13 agents · 0 deps';
  o.push(`<rect x="64" y="58" width="${r1(pill.length * 13 * ADV + 44)}" height="30" rx="15" fill="${t.card}" stroke="${t.border}"/>`,
    `<circle cx="81" cy="73" r="4" fill="${t.green}">${anim('opacity', [[0, 1], [1, 0.3], [2, 1]], 2)}</circle>`,
    `<text x="93" y="77.5"${mono(13)} fill="${t.muted}">${esc(pill)}</text>`,
    `<text x="58" y="196"${mono(96)} font-weight="800" letter-spacing="-2" fill="${t.text}">chisle</text>`,
    `<rect x="408" y="126" width="30" height="80" rx="3" fill="${t.fill}">${anim('opacity', [[0, 1], [0.55, 0]], 1.1, { discrete: true })}</rect>`,
    `<text x="64" y="262" font-size="26" font-weight="600" fill="${t.text}">Fewer tokens in. Fewer tokens out.</text>`,
    `<text x="64" y="300" font-size="26" font-weight="700" fill="${t.accent}">Same answers.</text>`,
    `<rect x="64" y="330" width="176" height="44" rx="10" fill="${t.card}" stroke="${t.border}"/>`,
    `<text x="84" y="358.5"${mono(18)}><tspan fill="${t.faint}">$</tspan><tspan fill="${t.text}"> npx chisle</tspan></text>`);

  // Right: the terminal.
  const X0 = 616, Y0 = 140, FS = 15, CW = FS * ADV, LH = 23, WRAP = 56;
  o.push(win(t, 596, 40, 564, 340, 'claude  ~/app'),
    `<text x="${X0}" y="104"${mono(FS)}><tspan fill="${t.accent}">&gt;</tspan><tspan fill="${t.soft}"> deep-copy this config object</tspan></text>`,
    `<rect x="612" y="314" width="532" height="46" rx="8" fill="none" stroke="${t.border}"/>`,
    `<text x="628" y="342"${mono(FS)} fill="${t.faint}">&gt;</text>`,
    `<rect x="${r1(628 + 2 * CW)}" y="327" width="${r1(CW)}" height="20" fill="${t.soft}">${anim('opacity', [[0, 0.8], [0.55, 0]], 1.1, { discrete: true })}</rect>`);

  const words = VERBOSE.split(' ');
  const pos = [];
  let line = 0, col = 2;
  for (const w of words) {
    if (col > 2 && col + 1 + w.length > WRAP) { line++; col = 2; } else if (col > 2) col++;
    pos.push({ w, line, col });
    col += w.length;
  }
  const keepAt = new Set(KEEP.map((k) => words.lastIndexOf(k)));
  const nLines = line + 1;
  const tStream = (i) => 0.35 + i * 0.03;
  const tLine = (L) => 3.1 + L * 0.3;
  const tHit = (p) => tLine(p.line) + (p.col / WRAP) * 0.3;
  const tSlide = tLine(nLines) + 0.3, tChip = tSlide + 0.95, tOut = D - 1.15;

  o.push(`<text x="${X0}" y="${Y0}"${mono(FS)} fill="${t.text}">●${shown(0.2, tOut + 0.35, D, 0.15)}</text>`);
  let fcol = 2;
  pos.forEach((p, i) => {
    const x = r1(X0 + p.col * CW), y = Y0 + p.line * LH, ts = tStream(i), th = tHit(p);
    if (keepAt.has(i)) {
      const fx = r1(X0 + fcol * CW);
      fcol += p.w.length + 1;
      o.push(`<text x="${fx}" y="${Y0}"${mono(FS)} fill="${t.accent}">${esc(p.w)}` +
        anim('opacity', [[ts, 0], [ts + 0.12, 1], [tOut, 1], [tOut + 0.35, 0]], D) +
        anim('fill', [[th, t.soft], [th + 0.15, t.accent]], D) +
        anim('x', [[tSlide, x], [tSlide + 0.75, fx]], D, { ease: true }) +
        anim('y', [[tSlide, y], [tSlide + 0.75, Y0]], D, { ease: true }) + '</text>');
    } else {
      o.push(`<text x="${x}" y="${y}"${mono(FS)} fill="${t.soft}" opacity="0">${esc(p.w)}` +
        anim('opacity', [[ts, 0], [ts + 0.12, 1], [th, 1], [th + 0.35, 0]], D) +
        anim('transform', [[th, '0 0'], [th + 0.35, '0 16']], D, { type: 'translate', ease: true }) + '</text>');
    }
  });

  // The chisel: a glowing blade that sweeps each line as its filler falls away.
  const sweep = [];
  for (let L = 0; L < nLines; L++) {
    const end = Math.max(...pos.filter((p) => p.line === L).map((p) => p.col + p.w.length));
    sweep.push([tLine(L), `${r1(X0 + 2 * CW)} ${Y0 + L * LH - 16}`], [tLine(L) + 0.3, `${r1(X0 + end * CW)} ${Y0 + L * LH - 16}`]);
  }
  o.push(`<g opacity="0"><rect x="-6" y="0" width="12" height="21" rx="6" fill="${t.fill}" opacity="0.55" filter="url(#soft)"/>` +
    `<rect x="-1.5" y="0" width="3" height="21" rx="1.5" fill="${t.accent}"/>` +
    anim('transform', sweep, D, { type: 'translate' }) +
    anim('opacity', [[tLine(0) - 0.01, 0], [tLine(0), 1], [tLine(nLines) - 0.01, 1], [tLine(nLines), 0]], D) + '</g>');

  // The receipt.
  const stat = `${words.length} words → ${KEEP.length} words`;
  const pct = `−${Math.round(100 * (1 - KEEP.length / words.length))}%`;
  const cw = (stat.length + pct.length + 1) * 13 * ADV + 28;
  o.push(`<g>${shown(tChip, tOut + 0.35, D)}` +
    `<rect x="${X0}" y="162" width="${r1(cw)}" height="28" rx="14" fill="${t.fill}" fill-opacity="0.12" stroke="${t.fill}" stroke-opacity="0.45"/>` +
    `<text x="${X0 + 14}" y="180.5"${mono(13)}><tspan fill="${t.muted}">${esc(stat)} </tspan><tspan fill="${t.accent}" font-weight="700">${pct}</tspan></text>` +
    `<text x="${r1(X0 + cw + 14)}" y="180.5"${mono(13)} fill="${t.green}">✓ same answer</text></g>`);

  return svg(t, W, H, `Chisle: fewer tokens in, fewer tokens out, same answers. Animated: a ${words.length}-word AI answer is chiselled down to "structuredClone(config), built in, no dependency".`, o, defs);
}

// ── Stats: the four headline numbers ──────────────────────────────────────────
function stats(t) {
  const W = 880, H = 248;
  const tiles = [
    ['−29%', 'billed output tokens', '71% of the bare model', 0.71],
    ['−45%', 'answer length', '55% of the bare model', 0.55],
    ['−48%', 'oversized tool output', 'per trimmed tool output', 0.52],
    ['156/156', 'accuracy', 'bare model: 154/156', 1],
  ];
  const o = [`<text x="${W / 2}" y="34" font-size="14" fill="${t.muted}" text-anchor="middle">Chisle vs the same model with no ruleset</text>`];
  const tw = 196, gap = 16, x0 = (W - 4 * tw - 3 * gap) / 2, y0 = 52, bw = tw - 36;
  tiles.forEach(([v, label, sub, p], i) => {
    const x = x0 + i * (tw + gap), c = p === 1 ? t.green : t.accent, fc = p === 1 ? t.green : t.fill, fw = r1(bw * p);
    o.push(`<g>${enter(0.15 * i)}` +
      `<rect x="${x}" y="${y0}" width="${tw}" height="172" rx="10" fill="${t.card}" stroke="${t.border}"/>` +
      `<text x="${x + 18}" y="${y0 + 60}" font-size="42" font-weight="800" letter-spacing="-1" fill="${c}">${v}</text>` +
      `<text x="${x + 18}" y="${y0 + 92}" font-size="15" font-weight="600" fill="${t.text}">${esc(label)}</text>` +
      `<text x="${x + 18}" y="${y0 + 114}" font-size="12.5" fill="${t.muted}">${esc(sub)}</text>` +
      `<rect x="${x + 18}" y="${y0 + 138}" width="${bw}" height="8" rx="4" fill="${t.track}"/>` +
      `<rect x="${x + 18}" y="${y0 + 138}" width="${fw}" height="8" rx="4" fill="${fc}">` +
      (p === 1 ? '' : anim('width', [[0, bw], [1, bw], [2.5, fw]], 5, { ease: true })) + '</rect></g>');
  });
  return svg(t, W, H, 'Chisle versus the same model with no ruleset: 29% fewer billed output tokens, answers 45% shorter, oversized tool output 48% smaller, accuracy 156 of 156 versus 154 of 156.', o);
}

// ── Race: one prompt, four rulesets, tokens streamed at the same speed ────────
function race(t) {
  const W = 880, H = 304, D = 9, X = 150, MAXW = 560, T0 = 0.6, RUN = 4.4;
  const arms = [['Chisle', 530], ['caveman', 604], ['ponytail', 747], ['no ruleset', 1186]];
  const max = Math.max(...arms.map((a) => a[1]));
  const o = [
    `<text x="28" y="42" font-size="19" font-weight="700" fill="${t.text}">Same prompt. Four answers.</text>`,
    `<text x="${W - 28}" y="42" font-size="13" fill="${t.muted}" text-anchor="end">visible answer tokens · lower is leaner</text>`,
    `<text x="28" y="70"${mono(12.5)} fill="${t.muted}">${esc('> Implement an order state machine: created, paid, shipped, delivered, cancelled, refunded…')}</text>`,
  ];
  const tEnd = (n) => T0 + (n / max) * RUN;
  arms.forEach(([name, n], i) => {
    const y = 98 + i * 44, w = r1((n / max) * MAXW), me = i === 0, te = tEnd(n);
    o.push(`<text x="${X - 16}" y="${y + 15}" font-size="14" font-weight="${me ? 700 : 500}" fill="${me ? t.accent : t.soft}" text-anchor="end">${esc(name)}</text>`,
      `<rect x="${X}" y="${y}" width="${w}" height="20" rx="5" fill="${me ? t.fill : t.bar}">` +
        anim('width', [[T0, 0], [te, w], [D - 0.5, w], [D - 0.15, 0]], D) + '</rect>',
      `<rect x="${X}" y="${y - 2}" width="2.5" height="24" rx="1" fill="${t.text}" opacity="0">` +
        anim('x', [[T0, X], [te, r1(X + w)]], D) + anim('opacity', [[T0 - 0.01, 0], [T0, 1], [te, 1], [te + 0.01, 0]], D) + '</rect>',
      `<text x="${r1(X + w + 12)}" y="${y + 15}" font-size="14">${shown(te, D - 0.3, D, 0.2)}` +
        `<tspan font-weight="700" fill="${me ? t.accent : t.text}">${n.toLocaleString('en-US')}</tspan><tspan fill="${t.muted}"> tokens</tspan></text>`);
  });
  const cut = `−${Math.round(100 * (1 - arms[0][1] / max))}% vs no ruleset`;
  const px = r1(X + (arms[0][1] / max) * MAXW + 106);
  o.push(`<g>${shown(tEnd(max) + 0.2, D - 0.3, D)}<rect x="${px}" y="97" width="${r1(cut.length * 7.1 + 24)}" height="22" rx="11" fill="${t.fill}" fill-opacity="0.12" stroke="${t.fill}" stroke-opacity="0.45"/>` +
    `<text x="${px + 12}" y="112.5" font-size="12.5" font-weight="700" fill="${t.accent}">${esc(cut)}</text></g>`,
    `<text x="28" y="${H - 22}"${mono(11.5)} fill="${t.faint}">Claude Code + Haiku 4.5 · all four in one run · the verbatim answers are below</text>`);
  return svg(t, W, H, 'Same prompt, four rulesets, visible answer tokens: Chisle 530, caveman 604, ponytail 747, no ruleset 1,186. Chisle is 55% shorter than no ruleset.', o);
}

// ── Trim: what the tool-output compressor does to one oversized output ───────
function trim(t) {
  const W = 880, H = 396, D = 9, Y0 = 76, STEP = 19.5;
  const ts = (i) => 0.7 + i * (5 / 12);
  const kt = (pts) => anim('fill-opacity', pts, D);
  const ansi = (s) => [s, t.accent, 1];
  const left = [
    [ansi('\\e[1m'), ['> chisle@3.12.1 test', t.soft, 0], ansi('\\e[0m')],
    [ansi('\\e[32m'), ['✓', t.green, 0], ansi('\\e[0m'), [' retry backs off', t.soft, 0]],
    ...Array.from({ length: 5 }, () => [ansi('\\e[32m'), ['✓', t.green, 2], ansi('\\e[0m'), [' retry backs off', t.soft, 2]]),
    [['✓', t.green, 0], [' strips colour codes', t.soft, 0]],
    [['✓', t.green, 0], [' collapses repeats', t.soft, 0]],
    [['  … 172 more passing lines …', t.faint, 2]],
    [['✗ spill file is owner-only', t.red, 0]],
    [['  AssertionError: 0o644 !== 0o600', t.red, 0]],
    [['ℹ tests 246  pass 245  fail 1', t.soft, 0]],
  ];
  const right = [
    [0, [['> chisle@3.12.1 test', t.soft]]],
    [1, [['✓', t.green], [' retry backs off', t.soft]]],
    [6, [['... [chisle: line repeated 6×] ...', t.accent]]],
    [7, [['✓', t.green], [' strips colour codes', t.soft]]],
    [8, [['✓', t.green], [' collapses repeats', t.soft]]],
    [9, [['... [chisle: elided 172 lines,', t.accent]]],
    [9, [['     full output saved to a file] ...', t.accent]]],
    [10, [['✗ spill file is owner-only', t.red], ['  ← error kept', t.green]]],
    [11, [['  AssertionError: 0o644 !== 0o600', t.red]]],
    [12, [['ℹ tests 246  pass 245  fail 1', t.soft]]],
  ];
  const o = [win(t, 16, 16, 416, 330, 'bash · npm test'), win(t, 448, 16, 416, 330, 'what Claude reads'),
    `<rect x="17" y="${Y0 - 14}" width="414" height="20" fill="${t.fill}" fill-opacity="0.13" opacity="0">` +
      anim('y', [[0.7, Y0 - 14], [5.7, Y0 - 14 + 12 * STEP]], D) +
      anim('opacity', [[0.69, 0], [0.7, 1], [5.7, 1], [5.71, 0]], D) + '</rect>',
    `<g${mono(12.5)}>`];
  left.forEach((segs, i) => {
    const y = r1(Y0 + i * STEP), at = ts(i);
    o.push(`<text x="28" y="${y}">` + segs.map(([s, c, rm]) => {
      const end = rm === 1 ? 0.12 : rm === 2 ? 0.35 : 1;
      return `<tspan fill="${c}" fill-opacity="${end}">${esc(s)}${rm ? kt([[at, 1], [at + 0.3, end]]) : ''}</tspan>`;
    }).join('') + '</text>');
  });
  right.forEach(([li, segs], row) => {
    const at = ts(li) + 0.15;
    o.push(`<text x="462" y="${r1(Y0 + row * STEP)}">` + segs.map(([s, c]) => `<tspan fill="${c}">${esc(s)}</tspan>`).join('') +
      anim('opacity', [[at, 0], [at + 0.3, 1], [D - 0.5, 1], [D - 0.2, 0]], D) + '</text>');
  });
  o.push('</g>',
    `<text x="${W / 2}" y="376" font-size="15.5" fill="${t.muted}" text-anchor="middle" opacity="0">Raw output is billed again on every later turn` +
      anim('opacity', [[0, 1], [6, 1], [6.2, 0], [D - 0.3, 0], [D - 0.1, 1]], D) + '</text>',
    `<text x="${W / 2}" y="376" font-size="15.5" font-weight="700" fill="${t.accent}" text-anchor="middle">Oversized tool output: ~48% smaller on average` +
      anim('opacity', [[6.1, 0], [6.4, 1], [D - 0.5, 1], [D - 0.2, 0]], D) + '</text>');
  return svg(t, W, H, 'Animated illustration of the Chisle tool-output compressor: raw npm test output with colour codes, six identical lines and 172 passing lines becomes a short version with the codes stripped, the repeats collapsed, the middle elided with the full output saved to a file, and the failing test and its error kept. On real sessions, oversized output shrinks by about 48 percent on average.', o);
}

// ── Ladder: the efficiency ladder, walked for three requests ──────────────────
function ladder(t) {
  const rungs = [
    ['Does this need to exist at all?', 'skip it, say so in one line'],
    ['Already in this codebase?', 'reuse it'],
    ['Does the stdlib do it?', 'use the stdlib'],
    ['Native platform feature?', 'CSS over JS, DB constraint over code'],
    ['Already-installed dependency?', 'use it, never add a new one'],
    ['Can it be one line?', 'one line'],
    ['Only then', 'the minimum code that works'],
  ];
  const scen = [['deep-copy a config object', 2, 'structuredClone(config)'], ['add a date picker', 3, '<input type="date">'], ['format a date for the UI', 1, 'reuse utils/formatDate()']];
  const SL = 4.5, D = SL * scen.length, W = 880, H = 396, Y0 = 84, RH = 36;
  const o = [`<text x="28" y="40" font-size="16" font-weight="700" fill="${t.text}">Before writing code, stop at the first rung that holds</text>`,
    `<path d="M46 ${Y0 - 6}V${Y0 - 6 + 6 * RH}" stroke="${t.border}" stroke-width="2"/>`];
  const rowY = (r) => Y0 - 24 + r * RH;
  const hl = [];
  scen.forEach(([, tgt], i) => {
    const s = i * SL;
    hl.push([s + 0.02, rowY(0)]);
    for (let r = 1; r <= tgt; r++) hl.push([s + 0.15 + r * 0.45, rowY(r - 1)], [s + 0.45 + r * 0.45, rowY(r)]);
    hl.push([s + SL - 0.05, rowY(tgt)]);
  });
  const rest = rowY(scen[scen.length - 1][1]); // static frame: the last request's rung
  o.push(`<rect x="20" y="${rest}" width="${W - 40}" height="${RH - 4}" rx="8" fill="${t.fill}" fill-opacity="0.13" stroke="${t.fill}" stroke-opacity="0.55">${anim('y', hl, D, { ease: true })}</rect>`,
    `<circle cx="46" cy="${rest + 16}" r="15" fill="none" stroke="${t.fill}" stroke-width="2">${anim('cy', hl.map(([s, y]) => [s, y + 16]), D, { ease: true })}</circle>`);
  rungs.forEach(([q, a], r) => {
    const y = Y0 + r * RH;
    o.push(`<circle cx="46" cy="${y - 6}" r="12" fill="${t.card}" stroke="${t.border}"/><text x="46" y="${y - 1.5}" font-size="12.5" font-weight="700" fill="${t.accent}" text-anchor="middle">${r + 1}</text>`,
      `<text x="72" y="${y}" font-size="14.5" font-weight="600" fill="${t.text}">${esc(q)}</text>`,
      `<text x="420" y="${y}" font-size="13.5" fill="${t.muted}">→ ${esc(a)}</text>`);
  });
  const yb = Y0 + 7 * RH + 8;
  o.push(`<path d="M20 ${yb - 18}H${W - 20}" stroke="${t.border}"/>`);
  scen.forEach(([req, tgt, ans], i) => {
    const s = i * SL, hit = s + 0.45 + tgt * 0.45 + 0.25, last = i === scen.length - 1;
    o.push(`<text x="28" y="${yb + 12}" font-size="14" fill="${t.muted}" opacity="${last ? 1 : 0}">Request: <tspan fill="${t.text}" font-weight="600">${esc(req)}</tspan>${shown(s + 0.01, s + SL, D, 0.2)}</text>`,
      `<text x="${W - 28}" y="${yb + 12}"${mono(14)} text-anchor="end" fill="${t.green}" opacity="${last ? 1 : 0}">✓ rung ${tgt + 1}: ${esc(ans)}${shown(hit, s + SL, D, 0.2)}</text>`);
  });
  return svg(t, W, H, 'The Chisle efficiency ladder. Before writing code, stop at the first rung that holds: 1 does this need to exist at all, 2 already in this codebase, 3 does the stdlib do it, 4 a native platform feature, 5 an already-installed dependency, 6 can it be one line, 7 only then the minimum code that works. Animated examples: deep-copying a config object stops at the stdlib with structuredClone; a date picker stops at the platform with input type date; formatting a date stops at reuse.', o);
}

// ── Agents: every agent the installer wires ───────────────────────────────────
function agents(t) {
  const rows = [['Claude Code', 'Codex', 'Cursor', 'Gemini CLI', 'Copilot', 'Copilot CLI'], ['OpenCode', 'Pi', 'Windsurf', 'Cline', 'Kiro', 'Antigravity', 'Hermes']];
  const W = 880, H = 156, FS = 13.5, GAP = 10, D = 5.2;
  const o = [`<text x="${W / 2}" y="34" font-size="12" font-weight="700" letter-spacing="2" fill="${t.muted}" text-anchor="middle">ONE COMMAND · 13 AGENTS</text>`];
  let k = 0;
  rows.forEach((names, r) => {
    const ws = names.map((n) => n.length * FS * ADV + 30);
    let x = (W - ws.reduce((a, b) => a + b, 0) - GAP * (names.length - 1)) / 2;
    const y = 52 + r * 46;
    names.forEach((n, i) => {
      const at = 0.3 + k++ * 0.28;
      o.push(`<g><rect x="${r1(x)}" y="${y}" width="${r1(ws[i])}" height="34" rx="17" fill="${t.card}" stroke="${t.border}"/>` +
        `<rect x="${r1(x)}" y="${y}" width="${r1(ws[i])}" height="34" rx="17" fill="${t.fill}" fill-opacity="0.12" stroke="${t.fill}" opacity="0">${anim('opacity', [[at, 0], [at + 0.2, 1], [at + 0.7, 1], [at + 1.1, 0]], D)}</rect>` +
        `<text x="${r1(x + ws[i] / 2)}" y="${y + 21.5}"${mono(FS)} fill="${t.soft}" text-anchor="middle">${esc(n)}</text></g>`);
      x += ws[i] + GAP;
    });
  });
  return svg(t, W, H, 'Works with 13 agents: Claude Code, Codex, Cursor, Gemini CLI, Copilot, Copilot CLI, OpenCode, Pi, Windsurf, Cline, Kiro, Antigravity and Hermes.', o);
}

// ── Line: the travelling divider (one file; it reads on both themes) ──────────
const LINE = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="4" viewBox="0 0 1200 4" preserveAspectRatio="none" role="img" aria-label="divider">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#d78a3c" stop-opacity="0"/><stop offset="0.7" stop-color="#f0a85a"/><stop offset="1" stop-color="#fff3e0"/></linearGradient></defs>
<rect width="1200" height="4" rx="2" fill="#d78a3c" opacity="0.18"/>
<rect width="260" height="4" rx="2" fill="url(#g)"><animate attributeName="x" from="-260" to="1200" dur="3.2s" repeatCount="indefinite"/></rect>
</svg>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'line.svg'), LINE);
for (const [name, build] of Object.entries({ banner, stats, race, trim, ladder, agents })) {
  for (const [theme, t] of Object.entries(THEMES)) fs.writeFileSync(path.join(OUT, `${name}-${theme}.svg`), build(t));
}
console.log(`wrote ${path.relative(process.cwd(), OUT)}: line + banner, stats, race, trim, ladder, agents (dark, light)`);
