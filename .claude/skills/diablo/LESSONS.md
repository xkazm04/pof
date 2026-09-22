# Lessons — diablo

## 1.0 — 2026-09-22 — pof
- **The registry consult changed the design and caught a defect, and it came AFTER the build.** The wrapper store was designed and implemented first; reading `import-normalization` then exposed that promotion bypassed the code-seed refusal (one validation door), and `reference-parity-gating` reshaped decision D3 (a reference-seeded step must not self-grade `pass`). Applied as a Law in v1.1: consult before a design decision.
- **Before calling a field a "design gap", grep the UE project for it.** Four of the dry run's gaps (slots, resistances, affixes, difficulty scaling) already existed in UE `Source/`; they were app-payload-vs-UE gaps, a different decision. Already a Law ("Schema flows down from UE").
- **Check whether a pipeline STEP already owns the field before mapping it onto the entity payload.** Bestiary's `Resistances` and `Monster Rarity` steps were the right home for two "gap" columns — which reframed the whole of Phase B as populating step artifacts (D3).

## 1.1 — 2026-09-22 — pof
- **A delegate's report is a claim; the overseer's re-run is the evidence.** cx-001 reported `done` truthfully, but the value came from re-running its acceptance commands in the worktree and re-ingesting real data (`unchanged 316`, refusal `observed 112`). Applied in v1.2 as oversight step 3.
- **A brief's out-of-scope list can leave a seam only the overseer sees.** Scripts were out of scope for cx-001, so the CLI would have printed a refused table as ingested; the overseer fixed it. When scoping a delegate out of a surface, check that surface after landing.

## 1.2 — 2026-09-22 — pof (W01)
- **Vitest has two failure channels.** An unhandled rejection is reported as a run `Errors` line while every test file passes; grepping `FAIL` missed a real defect of the overseer's own for a whole wave. A delegate (cx-003) surfaced it and filed it as "unrelated". Applied in v1.3 (oversight step 3).
- **A keyword probe can be fooled by the canon itself.** "The Diablo prompt still says Sundering" was the Diablo rule's own exclusion list. Look at WHERE a hit comes from (section header) before calling it a leak — then decide whether the rule should mention it at all.
- **Ask the delegate for open questions and verify them.** Astra's open question "pipelines embed PoF text" became the wave's most important finding (62 stub bodies) once measured.
