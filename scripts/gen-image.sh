#!/usr/bin/env bash
# Quality-hardening loop helper: generate ONE 1024² image from a prompt via Leonardo.
# Loads LEONARDO_API_KEY from .env (the raw shell doesn't have it). Leonardo gen+poll+
# download takes ~3-4 min — call with a >= 300s timeout. Prints POF_LEO_DONE=<path> on success.
#   bash scripts/gen-image.sh "<prompt>" "<output.png>"
set -euo pipefail
PROMPT="${1:?need prompt}"; OUT="${2:?need output path}"
export LEONARDO_API_KEY="$(grep -h '^LEONARDO_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')"
[ -n "${LEONARDO_API_KEY:-}" ] || { echo "POF_LEO_ERROR=no LEONARDO_API_KEY in .env"; exit 3; }
node scripts/visual-gen/pof_leonardo.mjs --prompt "$PROMPT" --output "$OUT" --quality HIGH --width 1024 --height 1024
