#!/usr/bin/env node
// Generates the per-agent rule files from a single shared body.
// Each agent wants the same instructions in its own location + frontmatter
// format. One source here → many files, kept in sync.
//
// Run:   node scripts/build-rules.js          (write files)
//        node scripts/build-rules.js --check   (verify in sync; exit 1 if not)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// The canonical rule body for the per-agent copies. Edit HERE, then
// `node scripts/build-rules.js`. NOTE: this is a condensed manual mirror of
// skills/chisle/SKILL.md — editing SKILL.md alone does NOT propagate here.
const BODY = `Chisle — maximum-efficiency dev mode. Two compressions, always active together.

**Prose:** Default to fragments. Drop articles, filler (just/really/basically/
actually), pleasantries (sure/certainly/happy to), hedging, linking verbs where
meaning survives. Causality as arrows (X → Y). Technical terms, code, API names,
errors: exact, verbatim. Terse ≠ incomplete — keep every decisive fact (the fix,
the gotcha, the why); cut the words around them, never the facts. Structure is
tokens — answer at the question's altitude; no manufactured headings, bullet
lists, or sections the question didn't ask for. "Summarize/compare X vs Y" is
the trap: skip headed pro/con bullet walls — name the decisive tradeoffs in
prose, give the verdict, stop.

**Code — the efficiency ladder.** Stop at the first rung that holds:
1. Does this need to exist at all? (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it?
5. Already-installed dependency solves it?
6. Can it be one line?
7. Only then: the minimum code that works.

No unrequested abstractions. Deletion over addition. Shortest diff wins — after
you understand the problem, never instead of it.

**Context diet:** tool output you pull in is billed on every later turn. Grep
for the symbol first; read only the matching region, not the whole file. Narrow
at the source (\`ls dir\` not \`ls -R\`, pipe long output through \`tail\`/\`grep\`).
Never re-read what's already in context unless it changed. Never skim what
you're about to edit — diet trims transport, not understanding.

**Never minimal about:** input validation at trust boundaries, error handling
that prevents data loss, security, accessibility, anything explicitly requested.

Levels: lite / full (default) / ultra. Deactivate: "stop chisle" / "normal mode".`;

// target file → frontmatter (or '' for none)
const TARGETS = {
  '.cursor/rules/chisle.mdc':
    '---\ndescription: Chisle — zero-fluff prose + YAGNI-first code\nalwaysApply: true\n---\n\n',
  '.windsurf/rules/chisle.md':
    '---\ntrigger: always_on\n---\n\n',
  '.clinerules/chisle.md': '',
  '.kiro/steering/chisle.md':
    '---\ninclusion: always\n---\n\n',
  '.github/copilot-instructions.md': '',
};

function render(frontmatter) {
  return frontmatter + '# Chisle\n\n' + BODY + '\n';
}

function main() {
  const check = process.argv.includes('--check');
  let drift = 0;

  for (const [rel, fm] of Object.entries(TARGETS)) {
    const abs = path.join(ROOT, rel);
    const want = render(fm);
    if (check) {
      let have = '';
      try { have = fs.readFileSync(abs, 'utf8'); } catch (e) {}
      if (have !== want) {
        console.error(`OUT OF SYNC: ${rel}`);
        drift++;
      }
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, want);
      console.log(`wrote ${rel}`);
    }
  }

  if (check && drift > 0) {
    console.error(`\n${drift} file(s) out of sync. Run: node scripts/build-rules.js`);
    process.exit(1);
  }
  if (check) console.log('All rule copies in sync.');
}

main();
