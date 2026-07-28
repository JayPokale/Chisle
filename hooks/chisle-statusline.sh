#!/bin/bash
# chisle — statusline badge for Claude Code
#
# Usage in ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /path/to/chisle-statusline.sh" }

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.chisle-active"

# Drain Claude's statusline JSON from stdin (carries rate_limits.* — the same
# 5h/weekly figures /usage shows). Read before any early exit so the pipe closes.
INPUT=$(cat)

# Refuse symlinks — local attacker could point flag at ~/.ssh/id_rsa and have
# the statusline render its bytes to the terminal every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap at 64 bytes, strip non-alphanumeric-dash — blocks terminal-escape injection.
MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

# Whitelist — render nothing for unknown values rather than echo attacker bytes.
case "$MODE" in
  off|on) ;;
  *) exit 0 ;;
esac

# Plan rate-limit usage from Claude's stdin JSON (rate_limits.{five_hour,seven_day}).
# Present only for Pro/Max after the first API response — absent renders nothing.
# Pure grep scoping (no jq/node dep): each window object has no nested braces, and
# the final [0-9] extract guarantees a digits-only value — no escape injection.
scope() {   # $1 = window key, $2 = inner field → digits only, or empty
  printf '%s' "$INPUT" | grep -oE "\"$1\":\{[^}]*\}" \
    | grep -oE "\"$2\":[0-9.]+" | grep -oE '[0-9.]+' | head -1
}
bar() {     # $1 = integer pct → 10-char █/░ loading bar
  local p=$1 filled empty f e out=""
  filled=$(( p / 10 )); [ "$filled" -gt 10 ] && filled=10; [ "$filled" -lt 0 ] && filled=0
  empty=$(( 10 - filled ))
  [ "$filled" -gt 0 ] && { printf -v f "%${filled}s"; out="${f// /█}"; }
  [ "$empty"  -gt 0 ] && { printf -v e "%${empty}s";  out="${out}${e// /░}"; }
  printf '%s' "$out"
}
until_str() {  # $1 = reset epoch → "3d4h"/"2h14m"/"12m", empty if past/absent
  [ -z "$1" ] && return
  local s d h m now; now=$(date +%s)
  s=$(( ${1%.*} - now )); [ "$s" -le 0 ] && return
  d=$(( s/86400 )); h=$(( (s%86400)/3600 )); m=$(( (s%3600)/60 ))
  if   [ "$d" -gt 0 ]; then printf '%dd%dh' "$d" "$h"
  elif [ "$h" -gt 0 ]; then printf '%dh%dm' "$h" "$m"
  else printf '%dm' "$m"; fi
}
seg() {     # $1 = label, $2 = window key → " Label: <bar> NN% ⟳<until>"  (empty if no data)
  local pct u
  pct=$(scope "$2" used_percentage); pct=${pct%.*}
  [ -z "$pct" ] && return
  u=$(until_str "$(scope "$2" resets_at)")
  printf ' %s: %s %s%%%s' "$1" "$(bar "$pct")" "$pct" "${u:+ ⟳$u}"
}

S=$(seg Session five_hour)
W=$(seg Weekly seven_day)
LIMITS="$S"
[ -n "$W" ] && LIMITS="${LIMITS}${LIMITS:+ |}$W"

# API-key users get no rate_limits in stdin — fall back to session cost.
# Plan users pay no per-token cost, so show it only when no limits rendered.
# LC_NUMERIC=C forces '.' decimal so printf parses the JSON float in any locale.
if [ -z "$LIMITS" ]; then
  COST=$(scope cost total_cost_usd)
  [ -n "$COST" ] && LIMITS=$(LC_NUMERIC=C printf ' Session: $%.2f' "$COST")
fi

# Input-side savings from the tool-output compressor ledger. Measured (chars
# actually elided), not estimated — unlike an output-side counter, this one has
# a real baseline. Digits-only extract; symlink-refused like the mode flag.
STATS="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.chisle-compress-stats.json"
if [ -f "$STATS" ] && [ ! -L "$STATS" ]; then
  SAVED=$(head -c 256 "$STATS" 2>/dev/null | grep -oE '"savedChars":[0-9]+' | grep -oE '[0-9]+' | head -1)
  if [ -n "$SAVED" ] && [ "$SAVED" -gt 0 ] 2>/dev/null; then
    TOK=$(( SAVED / 4 ))
    if   [ "$TOK" -ge 1000000 ]; then LIMITS="$LIMITS ⇣$(( TOK / 1000000 ))M tok"
    elif [ "$TOK" -ge 1000 ];    then LIMITS="$LIMITS ⇣$(( TOK / 1000 ))k tok"
    elif [ "$TOK" -gt 0 ];       then LIMITS="$LIMITS ⇣${TOK} tok"; fi
  fi
fi

# Orange badge + loading bars trailing outside the bracket. One mode, one badge.
printf '\033[38;5;172m[CHISLE]\033[0m%s' "$LIMITS"
