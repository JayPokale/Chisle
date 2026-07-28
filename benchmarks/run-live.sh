#!/usr/bin/env bash
# Live 4-arm benchmark: vanilla vs caveman vs ponytail vs chisle (arm key stays "rdxmin" — matches historical raw filenames).
#
# Drives the authenticated `claude` CLI headlessly. Each arm differs ONLY in the
# system prompt appended (the respective SKILL.md body); vanilla appends nothing.
# Plugins/CLAUDE.md/tone hooks are neutralized via an isolated HOME + config dir
# holding only credentials, so the only variable is the arm.
#
# Measures real usage.output_tokens + visible answer size per (arm, task).
# Resumable: skips a cell whose raw JSON already exists.
#
# Usage: bash benchmarks/run-live.sh [model] [raw-dir]
#   raw-dir defaults to results/raw; pass a fresh dir to re-measure from scratch
#   instead of reusing cached cells.
#
#   SUITE=large selects prompts that genuinely want a long answer. The default
#   suite's baselines run 80-1506 tokens, which is small enough that the
#   headline average is dominated by prompts where every arm has little to cut.
#   Re-analysing the committed cells by baseline size suggests the gap widens
#   on longer answers; this suite exists to test that directly rather than
#   inferring it from tasks that were not designed for the question.
#   Example: SUITE=large bash benchmarks/run-live.sh <model> results/raw-large
set -uo pipefail

MODEL="${1:-claude-haiku-4-5-20251001}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW="${2:-$HERE/results/raw}"
mkdir -p "$RAW"

# Isolated config: credentials only, no settings/CLAUDE.md/plugins.
ISO="$(mktemp -d)"
cp "$HOME/.claude/.credentials.json" "$ISO/" 2>/dev/null || { echo "no credentials found"; exit 1; }
trap 'rm -rf "$ISO"' EXIT

# Arm system prompts (frontmatter stripped). vanilla = none.
# Competitor skills: local clone if present, else the installed plugin cache
# (any version dir) — `claude plugin install caveman@caveman ponytail@ponytail`.
find_skill() {  # $1 = tool name → path to its SKILL.md, or empty
  local clone="/home/jay/Desktop/$1/skills/$1/SKILL.md"
  [ -f "$clone" ] && { echo "$clone"; return; }
  ls "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/cache/$1/$1"/*/skills/"$1"/SKILL.md 2>/dev/null | head -1
}
CAVEMAN_SKILL="$(find_skill caveman)"
PONYTAIL_SKILL="$(find_skill ponytail)"
CHISLE_SKILL="$HERE/../skills/chisle/SKILL.md"

strip_fm() { awk 'BEGIN{n=0} /^---[[:space:]]*$/{n++; next} n>=2{print} n<2 && !/^---/ && n==1{print}' "$1" 2>/dev/null || cat "$1"; }
for f in "$CAVEMAN_SKILL" "$PONYTAIL_SKILL" "$CHISLE_SKILL"; do [ -f "$f" ] || { echo "missing skill: $f"; exit 1; }; done
strip_fm "$CAVEMAN_SKILL" > "$ISO/caveman.txt"
strip_fm "$PONYTAIL_SKILL" > "$ISO/ponytail.txt"
# Arm key stays "rdxmin": renaming it would orphan every committed raw/*__rdxmin.json.
strip_fm "$CHISLE_SKILL" > "$ISO/rdxmin.txt"

# Tasks: id<TAB>kind<TAB>prompt
TASKS_LARGE=$(cat <<'EOF'
migration	coding	Write a database migration script that moves a users table from a single full_name column to first_name/last_name, backfills existing rows, and is safely re-runnable. Show the code.
statemachine	coding	Implement an order state machine covering created, paid, shipped, delivered, cancelled and refunded, with the legal transitions enforced and invalid ones rejected. Show the code.
csvpipeline	coding	Write a script that reads a large CSV of transactions, validates each row, aggregates totals per customer, and writes a report, handling malformed rows without dying. Show the code.
authflow	coding	Implement email-and-password signup and login with password hashing, session issuing, and rate limiting on failed attempts. Show the code.
apidesign	noncoding	Design the REST API for a multi-tenant document store: resources, auth model, pagination, versioning and error format. Explain the decisions.
postmortem	noncoding	Write an incident postmortem for a four-hour outage caused by a connection pool exhausted by a slow downstream dependency, including timeline, root cause and remediations.
architecture	noncoding	Explain how you would migrate a monolith to services without a big-bang rewrite, covering ordering, data ownership, and how to keep it shippable throughout.
EOF
)

TASKS=$(cat <<'EOF'
debounce	coding	Add debounce to a search input that currently fires an API call on every keystroke. Show the code.
cache	coding	Add a cache layer for our user profile API responses. Show the code.
auth-bug	coding	Our auth middleware rejects valid tokens at the exact expiry boundary (it uses currentTime > expiry). Find and fix the root cause.
pooling	noncoding	Explain how database connection pooling works and why it helps.
rest-graphql	noncoding	Summarize the main tradeoffs between REST and GraphQL for a new API.
regex-concept	noncoding	Explain what a regular expression backreference is, with one short example.
EOF
)

# Pick the suite. Default stays byte-identical so previously committed cells
# remain comparable; SUITE=large swaps in the long-answer prompts above.
if [ "${SUITE:-default}" = "large" ]; then
  TASKS="$TASKS_LARGE"
  echo "suite: large (long-answer prompts)"
fi

run_cell() {
  local arm="$1" task_id="$2" prompt="$3"
  local out="$RAW/${task_id}__${arm}.json"
  [ -f "$out" ] && { echo "  skip $task_id/$arm (cached)"; return; }
  local args=(-p "$prompt" --model "$MODEL" --output-format json)
  [ "$arm" != "vanilla" ] && args+=(--append-system-prompt-file "$ISO/${arm}.txt")
  echo "  run  $task_id/$arm"
  # </dev/null is critical: without it `claude -p` consumes the while-read
  # loop's stdin (the task heredoc) and the loop exits after one iteration.
  ( cd /tmp && timeout 120 env HOME=/tmp CLAUDE_CONFIG_DIR="$ISO" claude "${args[@]}" </dev/null ) > "$out" 2>/dev/null \
    || echo "    (call failed for $task_id/$arm)"
}

echo "model: $MODEL"
echo "raw:   $RAW"
while IFS=$'\t' read -r id kind prompt; do
  [ -z "$id" ] && continue
  echo "task: $id ($kind)"
  # Arms are independent → run the 4 concurrently; wait per task keeps
  # rate-limit pressure bounded and output readable.
  for arm in vanilla caveman ponytail rdxmin; do
    run_cell "$arm" "$id" "$prompt" &
  done
  wait
done <<< "$TASKS"

echo "done. raw JSON in $RAW/"
