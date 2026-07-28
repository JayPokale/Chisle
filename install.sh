#!/usr/bin/env bash
# chisle — curl|bash shim. Delegates to the Node installer via npx.
#
#   curl -fsSL https://raw.githubusercontent.com/JayPokale/Chisle/main/install.sh | bash
#
# Or, from a local clone:  ./install.sh [flags]
# All flags are forwarded to bin/install.js (see: npx chisle --help).
set -euo pipefail

REPO="JayPokale/Chisle"

if ! command -v node >/dev/null 2>&1; then
  echo "chisle: Node.js ≥18 is required. Install from https://nodejs.org and re-run." >&2
  exit 1
fi

# Local clone? Run the in-repo script directly. Otherwise go through npx.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/bin/install.js" ]; then
  exec node "$SCRIPT_DIR/bin/install.js" "$@"
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "chisle: npx not found (ships with npm). Install Node.js ≥18 from https://nodejs.org." >&2
  exit 1
fi

exec npx -y "github:${REPO}" -- "$@"
