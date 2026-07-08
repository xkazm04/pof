#!/usr/bin/env bash
# Quality-hardening loop helper: generate ONE 1024² image with Leonardo **Lucid Origin**
# (the model the catalog pipeline uses — NOT gpt-image-2). Loads LEONARDO_API_KEY from .env
# (the raw shell doesn't have it). Gen+poll+download is ~3-4 min — call with a >= 300s timeout.
# Prints POF_LUCID_DONE=<path> on success.
#   bash scripts/gen-image.sh "<prompt (<=1500 chars)>" "<output.png>"
set -euo pipefail
PROMPT="${1:?need prompt}"; OUT="${2:?need output path}"
export LEONARDO_API_KEY="$(grep -h '^LEONARDO_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r')"
[ -n "${LEONARDO_API_KEY:-}" ] || { echo "POF_LEO_ERROR=no LEONARDO_API_KEY in .env"; exit 3; }
npx tsx scripts/gen-lucid.ts --prompt "$PROMPT" --output "$OUT" --width 1024 --height 1024
