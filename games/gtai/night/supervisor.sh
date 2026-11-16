#!/usr/bin/env bash
# Keeps `night.mjs run` alive until --until: restarts it if it exits early, with a growing sleep (30 s doubling,
# capped at 10 min; reset after a run that lasted 30+ min). Exit 0 (all lanes finished), 2 (config error) and
# 130 (interrupted) are final. Every argument is passed through to `night.mjs run`.
#
#   bash games/gtai/night/supervisor.sh --root C:/Users/kazda/kiro/gtai-night --until 09:00 --freeze 07:30 --report-at 08:15
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="C:/Users/kazda/kiro/gtai-night"
UNTIL="09:00"
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --root) ROOT="${args[$((i + 1))]}" ;;
    --until) UNTIL="${args[$((i + 1))]}" ;;
  esac
done
mkdir -p "$ROOT/logs"
LOG="$ROOT/logs/supervisor.log"
say() { echo "[$(date -Iseconds)] $*" | tee -a "$LOG"; }

deadline=$(date -d "$UNTIL" +%s) || { say "bad --until $UNTIL"; exit 2; }
[ "$deadline" -le "$(date +%s)" ] && deadline=$((deadline + 86400))
backoff=30
say "supervisor $$: night.mjs run until $(date -d "@$deadline" '+%F %H:%M') (root $ROOT)"
while [ "$(date +%s)" -lt $((deadline - 180)) ]; do
  started=$(date +%s)
  node "$HERE/night.mjs" run "$@"
  code=$?
  ran=$(($(date +%s) - started))
  case "$code" in
    0) say "night.mjs finished (exit 0) after ${ran}s - done"; exit 0 ;;
    2) say "night.mjs refused to start (exit 2: config error, see above) - not retrying"; exit 2 ;;
    130) say "night.mjs was interrupted (exit 130) - stopping"; exit 130 ;;
  esac
  [ "$ran" -ge 1800 ] && backoff=30
  say "night.mjs exited $code after ${ran}s before the deadline - restarting in ${backoff}s"
  sleep "$backoff"
  backoff=$((backoff * 2 > 600 ? 600 : backoff * 2))
done
say "deadline reached - supervisor exits"
