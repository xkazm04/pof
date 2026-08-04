---
name: green-loop
description: QUALITY half of the PoF readiness campaign — raises /status cells that already hold real content from R3 REVIEWED to R4 PROVEN by driving the canon-aware strict judge median to >=90. Fixes the REAL defects the v3 judge names (sibling contradictions, arithmetic, canon violations, defensive meta-commentary) across ALL of an entity's steps at once, then records an official median-of-3 verdict. Never games the judge and never weakens a checker. State under .claude/green-loop/. Invoke with "run green-loop" / "green-loop <catalog>". For cells with NO real content yet (R0/R1), use gap-loop instead.
---

# Green Loop — entity-coherence hardening under the canon-aware v3 judge

One question, run over run: **which cells hold real content that the strict judge still scores below the shippable bar, and what are the actual defects it names?** Take every TEXT cell as close to a genuine canon-aware median of 90 as the content allows — by fixing real defects, **never** by gaming the judge or weakening any checker.

> Engine vs. memory: this file is the engine. Cross-session memory lives in the
> **`.claude/green-loop/` overlay** (`state.md`, `BRIEF.md`, `UE-FOLLOWUP.md`, `w2c/`) —
> read it FIRST every run so sessions compound instead of restarting.

## Where this sits on the readiness ladder

/status paints ONE scale, `R0`–`R5` (`src/lib/status/readiness.ts`). This loop owns the **top half — quality**:

| From | To | Meaning |
|---|---|---|
| **R2** DRAFTED / **R3** REVIEWED | **R4** PROVEN | content exists and passes its checker; the strict judge has not scored it at the shippable bar → fix the named defects until it does |
| **R…✕** BLOCKED | R3/R4 | a judge condemned the content → resolve the findings, then re-judge ONCE |

It does **not** own R0/R1 — a cell with no real content behind it is **gap-loop**'s job. Attempting green-loop on an R1 HOLLOW cell polishes placeholder data, which is exactly the dishonesty the ladder exists to expose.

A strict judge pass at `BANDS.shippable` (≥90) on the **current rubric** is what `deriveCell` turns into R4, so the median IS the rung. Report movement in R-terms plus the score (`ambient::Zone Binding R3→R4, 88→92`).

## Environment (verify before working)

- PoF dev server origin: verify `curl -s -o /dev/null -w "%{http_code}" <origin>/layout` → **200**. Do NOT start another server if a good one is running; if it 404s, start your own and use that origin.
- Judge/config scripts default to port 3007 — ALWAYS set `POF_JUDGE_ORIGIN=<origin>` in the env of every `npx tsx scripts/*.ts` call.
- Content lives in the server DB (`~/.pof/pof.db`, `pipeline_artifacts`), **not** in repo files. Round-trip it via the scripts. Content agents touch DB content via the API and do not edit repo source owned by others.
- DB read (baseline + findings): `node -e` with `better-sqlite3` readonly on `~/.pof/pof.db` — `judge_verdicts` (catalog_id, entity_id, step, score, verdict, findings, rubric_version, judged_at) and `pipeline_artifacts`.

## The loop (per entity, ≤3 official rounds)

1. **Baseline** — latest `rubric_version>=3` verdicts for your catalog's cells (score + findings + fix). **The findings ARE your worklist.**
2. **Read everything first** — `POF_JUDGE_ORIGIN=<origin> npx tsx scripts/get-config.ts --catalog <id> --entity <eid> --step "<step>"`, and read **ALL sibling steps** before changing anything, plus the catalog's canon (`src/lib/catalog/canon/canon-seed.ts`). The judge is canon-aware AND sibling-aware — *a fix authored in isolation invents new contradictions.*
3. **Fix ENTITY-COHERENTLY** — resolve every named defect across all affected siblings at once. Levers that verifiably raise v3 scores (`src/lib/prompts/quality/` TEXT_TECHNIQUE):
   - single-source-of-truth numbers; arithmetic SHOWN and forward-derived, never reverse-engineered to hit a target
   - cross-reference siblings correctly — a sibling contradiction is an auto coherence fail
   - obey canon (PoF is SINGLE-PLAYER — no co-op/party; rarity Normal/Magic/Rare/Unique; ambient resident audio ≤8 MiB/zone; higher rarity = more affixes, never bigger raw numbers)
   - prove hard cases INLINE (worked math, ICU plural arms, state machines); name the failure/recovery/edge SEAM, not more prose
   - disclose your own edge cases honestly — it beats false airtightness
   - STRIP defensive meta-commentary ("note this is consistent with…") — self-justification is penalized
   - no vaporware, no leaked engine/prompt tokens
   - re-check internal arithmetic after every edit — deepening silently breaks sums
4. **Apply** — `npx tsx scripts/apply-config.ts ...`; verify the round-trip (re-fetch, deep-equal your intent).
5. **In-loop check** (cheap, single draw) — `scripts/judge-one.ts`. In-loop draws read **+8-14 high** vs an official median-3; aim central quality at ~93 so a −5 roll still clears.
6. **Official verdict** — `scripts/judge-run.ts --median 3`, draws **SEQUENTIAL** (parallel trips the rate wall). Use `--median 3` for any cell that in-loop scored ≥85.
7. Iterate on the judge's NEW findings. Stop when: median ≥90 (R4 — victory), 3 official rounds spent, or a genuine ceiling.

## The re-judge spiral is one-directional (wave-2, multiple agents)

Judge each cell **ONCE per content change**. NEVER batch-re-judge settled cells (wave-2 lost 7-20 points per cell doing exactly that), and never revert-and-re-judge hoping to restore a prior score. The settle mechanism works **once**. Depth added to a contested cell adds attack surface.

## Wave-1 proven levers (do these FIRST — they produced the campaign's greens)

1. **Sibling-completeness** — if the entity has fewer stored steps than its pipeline defines, COMPLETE the entity first. A judged cell is scored against the whole entity; sparse entities get every cell systematically under-scored (ashen-forest 4→10 steps lifted every cell to 90+).
2. **Sweep ALL mirrored values in one pass** (crossReferences, verification blocks, sibling copies) — one stale mirror cost −21 points.
3. **Machine-readable number blocks** (JSON fields) beat prose-buried numbers.
4. **Fix single sibling contradictions before adding depth** (+20-30/cell); deleting an incoherent subsystem beats patching it; leaner-airtight beats ever-deeper.
5. **Never re-judge a banked green** — variance can regress the recorded score.
6. **The loudest repeated finding can be a FALSE ceiling** — test the cheap alternative hypothesis (e.g. sparse siblings) before a big conversion.
7. State design **positively** — defensive/rebuttal voice is penalized; honest provenance notes beat confident assertion.

## Honest ceilings — record, don't fight

When findings point at a locked sibling you'd have to break, canon the judge correctly enforces, seed scarcity (more content = vaporware), or judge plausibility coin-flips — record a CEILING with the exact reason and move on. Do **NOT**: weaken a checker, hand-edit artifact status, invent lore to pad, break a green sibling to lift one cell, or chase an 88↔90 flap with re-judges (variance is ±5; median-of-3 settles it once).

Recorded ceilings belong in `src/lib/status/ceiling-facts.json`, classed `technique` / `project-data` / `checker-structural` — the capability layer excludes the latter two so the number measures technique, not this project's data.

## Report back (your final message = the deliverable)

Per catalog: a table of cells — step, entity, **R-level and score before → after** (note if median-of-3), defects fixed (one line), ceiling reason if stopped short. Plus: total cells reaching R4, cross-catalog contradictions you noticed but did **not** own (do not fix foreign catalogs), and any lesson worth banking. No file dumps.
