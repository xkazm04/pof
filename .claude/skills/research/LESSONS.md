# Lessons — research

## 1.0 — 2026-08-12 — pof
- New source class calibrated: **veteran-designer pure-design talk** (no tooling, no engine specifics — e.g. Timothy Cain's RT-vs-TB). Behaves like the knowledge/best-practice class but with a lower ceiling: findings are design-quality *criteria* (eval rubric lines), never presets or pipelines. Yield 3 S-criteria from a 13-min talk; that is a successful run, not a thin one.
- Phase-4 candidate tables should state each candidate's HOME, not just its bucket — the one declined pick (#4) died because its assumed home turned out to be a mechanical engine, and naming homes up front made that a cheap Phase-5 discovery instead of a post-build one.

## 1.0 — 2026-08-12 — pof (run 2: Cain batch ×5 — the hardening run; bumped to 1.1 in the same change)
- Batch mode over N same-class videos works: one pick gate, one TDD round, one commit. Cross-video repeats of a rule merge into one criterion and signal load-bearing rules. Codified in SKILL.md v1.1 (designer-talk source class: 5 routing shapes + module-gap rule + batch mode).
- Dual-home routing (eval criterion + generation-prompt enrichment) resolved run 1's watch item on its first trigger — "born compliant AND judged compliant" is the right default for pattern-shaped findings, criterion-only for prose principles.
- New gap class: a registered sub-module with no MODULE_CONTEXTS entry is effectively unjudged (dialogue-quests). The fix is adding the whole context, seeded from the finding.
- **Version conflict note:** `~/.claude/skills/research/` holds a DIFFERENT skill lineage (the personas-specific /research, no version field). Sync ritual step (b) skipped — overwriting would destroy the personas skill. This PoF-adapted skill lives only in-repo; if a shared library home is ever wanted, it needs a distinct name (e.g. `research-pof`).

## 1.1 — 2026-08-14 — pof (Mixar AI-Blender-fork run; bumped to 1.2 in the same change)
- **Read the gap's NEIGHBOURS, not just the gap** — APPLIED to Phase 5 step 2 (hence the bump). A candidate phrased as "feature X is missing" aims you at the unbuilt half and away from the built half, which is where the real defect can be. The candidate was "add metallic/roughness bakes"; the surrounding code revealed each bake *cleared the target's material slots*, so the shipped path had been exporting untextured meshes since it landed. That defect was worth more than the requested feature and no candidate table would ever have contained it.
- **"Declined tool, adopted test" — a GUI-decline sub-class, NOT yet codified (1st observation).** The standing GUI-only/off-domain rule correctly killed the tool in one line, but the demo drove the exact pipeline stage our own script automates, so its test escalation read as a checklist to fail against our code — and supplied both findings. Watch for a 2nd instance: a GUI tool operating on a stage the project already automates may be a higher-yield source than its bucket implies. Deliberately not written into SKILL.md at n=1.
- **Refusal-with-a-reason is now the house style in this project's Blender layer** (`unwrapPlan`, `cullLimitReason`, now `bakePlan`). Having the pattern established made an otherwise awkward call trivial: metallic has no Cycles bake pass, so it is returned as skipped-with-a-sentence instead of forcing a choice between fragile graph surgery and silently dropping what the user asked for. Generalisable prompt for any run: when a picked finding is only *partly* deliverable, look for the project's existing shape for saying so before deciding to descope it.
- **Version conflict note still stands:** `~/.claude/skills/research/` is a DIFFERENT skill lineage (the personas-specific /research, no version field, and it auto-loads over this one when `/research` is invoked). Sync ritual step (b) skipped again — overwriting would destroy the personas skill. This run had to read the repo-local SKILL.md explicitly after the wrong lineage loaded; that is now a recurring tax worth a rename (`research-pof`) if it bites a third time.

## 1.2 — 2026-08-14 — pof (run 2 of the day: AI-low-poly; bumped to 1.3 in the same change)
- **A narrow `git add` does NOT bound a commit — the pathspec on `git commit` does.** Two
  research sessions ran concurrently in one checkout; the other session's commit swallowed
  this run's finding because `git commit` with no pathspec commits the whole shared INDEX,
  including what a parallel session staged after your `add`. Recovered with `reset --soft`
  (local, nothing lost). Applied to SKILL.md Phase 10/11 as `git commit … -- <paths>` plus
  a "treat untouched modified files as live WIP, don't rewrite shared history" rule.
  Generalises to any repo where multiple agent sessions share a working tree.
- **The impact-map is trustworthy as an index and untrustworthy as a measurement.** A pick
  was built on its "214 components → fail 5/100" line, which recorded a state a later commit
  had already fixed — with the fix documented elsewhere in the same file. Rule of thumb worth
  carrying: when a candidate's premise is a *measured number* quoted from research memory,
  confirm it against code before the pick gate, not after. Cost here was one of four picks,
  and it converted cleanly into an already-have entry.
- **Second independent instance of "declined tool, adopted test"** (the 1.2 entry asked for
  one before codifying). Different source type — a provider comparison whose headline was
  already user-declined, while its incidental asides produced 3 findings for 3. The pattern
  is broader than GUI tools: when a source drives the same pipeline stage the project
  automates, the yield is in its throwaway steps, not its thesis.
