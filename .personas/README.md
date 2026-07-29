# Marks this repo as Personas-managed.
#
# Context-tracked skills (currently /perfect) gate their coverage reporting on
# this directory existing. When one finishes it appends progress nodes to
# memory-outbox.jsonl here; the app ingests them into the Memory Ledger and
# deletes the file. Nodes carry `"skill"` + `"context"` (an exact
# context-map.json name) — together those drive the per-skill context-coverage
# bar in Skills Management, over a 30-day rolling window.
#
# See .claude/skills/perfect/SKILL.md "App context coverage".
