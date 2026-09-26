#!/usr/bin/env bash
# Terminal-Bench 4.0 with the Chisle plugin loaded, on a Claude subscription.
#
# Runs the whole dataset through Harbor with chisle_agent:ChisleClaudeCode and
# survives plan usage limits: when a trial dies on the limit, the job is stopped,
# the plan is probed until it answers again, and only the limit-hit trials are
# re-run (harbor jobs resume -f ApiUsageLimitError). Nothing is scored on an
# attempt the limit cut short.
#
# Needs: harbor, Docker with the compose plugin, and a subscription token from
# `claude setup-token` in CLAUDE_CODE_OAUTH_TOKEN or in $TOKEN_FILE.
#
#   bash benchmarks/terminal-bench/run.sh                 # start or resume
#   EXTRA="-x '*gpu*'" bash benchmarks/terminal-bench/run.sh
#
# Env: JOB (job name), MODEL, EFFORT, CONCURRENCY, HARBOR, EXTRA (more harbor
# run args, word-split), PROBE_EVERY (seconds between limit probes).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
JOBS="$HERE/jobs"
JOB="${JOB:-tb4-opus55-low-chisle}"
MODEL="${MODEL:-claude-opus-5-5}"
EFFORT="${EFFORT:-low}"
CONCURRENCY="${CONCURRENCY:-2}"
HARBOR="${HARBOR:-harbor}"
PROBE_EVERY="${PROBE_EVERY:-1200}"
TOKEN_FILE="${TOKEN_FILE:-$HOME/.config/chisle-bench/oauth-token}"
LOG="$JOBS/$JOB.driver.log"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  [ -r "$TOKEN_FILE" ] && CLAUDE_CODE_OAUTH_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
fi
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || { echo "empty CLAUDE_CODE_OAUTH_TOKEN and $TOKEN_FILE (run: claude setup-token)" >&2; exit 1; }
# Read from the environment by Harbor, so the token never lands in the job's config.json.
export CLAUDE_CODE_OAUTH_TOKEN CLAUDE_FORCE_OAUTH=1 PYTHONPATH="$HERE${PYTHONPATH:+:$PYTHONPATH}"
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing" >&2; exit 1; }
mkdir -p "$JOBS"

log() { echo "$(date '+%F %T') $*" | tee -a "$LOG"; }

limit_hits() {  # trials that died on the plan limit
  grep -l '"exception_type": *"ApiUsageLimitError"' "$JOBS/$JOB"/*/result.json 2>/dev/null | wc -l
}

prune_images() {  # only this benchmark's images; in-use ones are refused by docker
  docker images --filter 'reference=harborframework/terminal-bench' -q | sort -u |
    xargs -r docker rmi >/dev/null 2>&1 || true
}

plan_available() {  # one tiny call on the same model; a limited plan answers instantly
  local cfg out
  cfg="$(mktemp -d)"
  out="$(CLAUDE_CONFIG_DIR="$cfg" claude -p 'Reply with OK.' --model "$MODEL" --effort low \
    --output-format json < /dev/null 2>&1 || true)"
  rm -rf "$cfg"
  grep -q '"is_error":false' <<<"$out" && ! grep -qiE "hit your limit|limit reached" <<<"$out"
}

start() {
  if [ -f "$JOBS/$JOB/config.json" ]; then
    # shellcheck disable=SC2086
    "$HARBOR" jobs resume -p "$JOBS/$JOB" -f ApiUsageLimitError -f CancelledError &
  else
    # shellcheck disable=SC2086
    eval "\"$HARBOR\" run -d terminal-bench/terminal-bench@4.0.0 \
      -a chisle_agent:ChisleClaudeCode -m anthropic/$MODEL \
      --ak reasoning_effort=$EFFORT -n $CONCURRENCY \
      -o \"$JOBS\" --job-name \"$JOB\" --yes ${EXTRA:-}" &
  fi
  PID=$!
}

while :; do
  log "starting ($(limit_hits) limit-hit trials to re-run)"
  start
  while kill -0 "$PID" 2>/dev/null; do
    sleep 60
    prune_images
    if [ "$(limit_hits)" -gt 0 ]; then
      log "plan limit hit; stopping job"
      kill -INT "$PID" 2>/dev/null || true
      for _ in $(seq 60); do kill -0 "$PID" 2>/dev/null || break; sleep 5; done
      kill -KILL "$PID" 2>/dev/null || true
      break
    fi
  done
  wait "$PID" 2>/dev/null || true
  prune_images
  if [ "$(limit_hits)" -eq 0 ] && [ -f "$JOBS/$JOB/result.json" ]; then
    log "done: $JOBS/$JOB"
    break
  fi
  until plan_available; do log "plan still limited; next probe in ${PROBE_EVERY}s"; sleep "$PROBE_EVERY"; done
done
