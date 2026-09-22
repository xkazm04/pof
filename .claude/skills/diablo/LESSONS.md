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

## 1.3 — 2026-09-22 — pof (W02)
- **Fix the prompt before judging the producer.** Every W02 produce failure was a prompt defect (unnamed keys, text fields, lists, wiring structure), found in three rounds, each a new checker kind. When a delegate fails, read its artifact against the prompt it was given before blaming the model.
- **A pass needs the same scrutiny as a fail.** Stat Block passed on a declared gap; Abilities passed on an invention injected by PoF's own stub contract. The grader cannot see parity — the overseer checks parity by hand against the wrapper until an instrument exists.
- **Measure a defect across the fleet, then pin the census at zero.** 102/114 turned a zombie's Stat Block into a PoF-wide fix with a regression guard.

## 1.4 — 2026-09-22 — pof (W03)
- **Ablate before you theorize about a generator.** One style-off candidate turned "the model can't draw a zombie" into "our style fragment makes it a skeleton" — a finding PoF owns. Keep ablations to n=1 per arm and stop when the direction is clear; say the n.
- **An instrument that cannot fail is not an instrument.** The whole-frame value share read 0.99 on every image (the ground dominated). Before trusting a measurement, check it can produce a failing number on a plausible bad input.
- **Do not submit to a selection-only checker what you would not accept.** Concept 2D Art grades only that a candidate is selected; submitting a skeleton "zombie" would have been a false pass the loop created itself.
- **Commit the type (and any guard codex runs) BEFORE dispatching**, so worktrees branched from HEAD typecheck and can self-verify; land the reader after.
- **Before calling a failure pre-existing, run it on a clean HEAD worktree** (junction node_modules, remove the junction with rmdir) — 3 were; 2 others were mine from an earlier commit whose test dir I had not run.

## 1.5 — 2026-09-22 — pof (W04)
- **Never write a Path node on an n=1 ablation arm.** W03 blamed the style on one style-off image; n=3 showed the subject text was the cause. Get n≥3 per arm before the diagnosis becomes a node, and measure with a blind instrument, not by eye.
- **Look at what a render produced before judging it** — the first sprite sheet was black and tiny (lighting + framing), not a failure of the approach.
