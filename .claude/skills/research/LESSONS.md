# Lessons — research

## 1.0 — 2026-08-12 — pof
- New source class calibrated: **veteran-designer pure-design talk** (no tooling, no engine specifics — e.g. Timothy Cain's RT-vs-TB). Behaves like the knowledge/best-practice class but with a lower ceiling: findings are design-quality *criteria* (eval rubric lines), never presets or pipelines. Yield 3 S-criteria from a 13-min talk; that is a successful run, not a thin one.
- Phase-4 candidate tables should state each candidate's HOME, not just its bucket — the one declined pick (#4) died because its assumed home turned out to be a mechanical engine, and naming homes up front made that a cheap Phase-5 discovery instead of a post-build one.

## 1.0 — 2026-08-12 — pof (run 2: Cain batch ×5 — the hardening run; bumped to 1.1 in the same change)
- Batch mode over N same-class videos works: one pick gate, one TDD round, one commit. Cross-video repeats of a rule merge into one criterion and signal load-bearing rules. Codified in SKILL.md v1.1 (designer-talk source class: 5 routing shapes + module-gap rule + batch mode).
- Dual-home routing (eval criterion + generation-prompt enrichment) resolved run 1's watch item on its first trigger — "born compliant AND judged compliant" is the right default for pattern-shaped findings, criterion-only for prose principles.
- New gap class: a registered sub-module with no MODULE_CONTEXTS entry is effectively unjudged (dialogue-quests). The fix is adding the whole context, seeded from the finding.
- **Version conflict note:** `~/.claude/skills/research/` holds a DIFFERENT skill lineage (the personas-specific /research, no version field). Sync ritual step (b) skipped — overwriting would destroy the personas skill. This PoF-adapted skill lives only in-repo; if a shared library home is ever wanted, it needs a distinct name (e.g. `research-pof`).
