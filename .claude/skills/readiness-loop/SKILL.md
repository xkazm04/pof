---
name: readiness-loop
description: The DRIVER of the PoF readiness campaign — measures every pipeline step's rung on the R0-R5 production-readiness ladder, picks the highest-value batch that is honestly liftable, dispatches up to 10 Opus subagents (one per cell/catalog), re-measures, and repeats until the achievable maximum is reached. It does not do the work itself; it routes each cell to gap-loop (existence, R0/R1 to R2+) or green-loop (quality, R3 to R4) and enforces the honest floor. Invoke with "run readiness-loop" / "readiness-loop measure | pick | dispatch | verify | wrap".
---

# Readiness Loop — drive the ladder to its achievable maximum

One question, run over run: **what is the highest rung every pipeline step can honestly reach, and which batch of cells moves furthest per fleet?**

This skill is the **driver**. It does not author content. It measures, picks, dispatches, re-measures, and stops — and its single most important job is **refusing to dispatch work that could only be completed by faking it.**

> Engine vs. memory: this file is the engine. Campaign memory lives in
> **`.claude/gap-loop/`** and **`.claude/green-loop/`** (`state.md`, `lessons.md`,
> `journal.md`) — read the relevant overlay before dispatching into that half.

## The ladder (the only scale)

`src/lib/status/readiness.ts` — one ordered scale, painted identically on `/status?tab=pipelines`:

| Rung | Name | Means |
|---|---|---|
| **R5** | SHIPPED | R4 **and** audited as actually running in UE |
| **R4** | PROVEN | a real L3/L4 gate passed headless-operable, or a strict judge at the shippable bar |
| **R3** | REVIEWED | passes, from an engine class that scales to quality without a gate |
| **R2** | DRAFTED | real output, shape-only check, generative class needing a gate |
| **R1** | HOLLOW | pass on placeholder data, or nothing can produce it |
| **R0** | NOT WIRED | no artifact at all |

Two states are **not rungs**: `⋯ waiting` (gate declared, never run) and `✕ blocked` (a checker or judge condemned it).

## MEASURE — never guess, never eyeball the UI

```bash
npx tsx scripts/readiness/inventory.ts                          # ladder histogram
npx tsx scripts/readiness/inventory.ts --level R1 --engine Claude,Code
npx tsx scripts/readiness/inventory.ts --state blocked --json    # fleet dispatch input
```

The script drives the **real** `buildSwimlane` + `readinessOf` the map uses and reads `~/.pof/pof.db` directly (no dev server needed). If it ever disagrees with `/status`, that is a bug in one import — not two opinions. **Take every target from here.**

## PICK — route each cell to the half that owns it

| Cell state | Owner | Why |
|---|---|---|
| `R0`, `R1` (non-media) | **gap-loop** | make something real exist |
| `R1` where the deliverable is media with no wired generator | **NOBODY — honest floor** | see below |
| `R2`, `R3` text/graph | **green-loop** | drive the judged median to ≥90 |
| `✕ blocked` with a judge-fail | **green-loop** | the findings ARE the worklist |
| `✕ blocked` with a failing checker | **gap-loop** | the artifact itself is wrong |
| `⋯ waiting` (L3/L4) | **gap-loop** | build UE substance, then drain the gate |
| R2+ content with a craft gauge below its ceiling and `content`-classed findings | **green-loop** | append the craft-loop findings (`/api/craft-verdicts`, criterion-named) to the catalog's worklist — the A-axis (see `craft-loop` skill) is a second findings source, never a second fixer |

Rank batches by: (a) how many cells flip, (b) whether it unblocks a chain, (c) reuse of one setup across many cells.

## The honest floor — the loop's most important rule

**A cell that can only move by faking it does not get dispatched.** Before dispatching ANY batch, drop cells whose rung is capped by a missing capability rather than missing effort:

- A media deliverable (`audio`, `vfx-particles`, `2d-art`, `3d-mesh`, `animation`) with **no wired generator** cannot be lifted by a text agent. The `engine` column may read `Claude` because an LLM wrote its *spec text* — that does not mean an LLM can produce the *deliverable*. Check `step-facts.json` `deliverable` + `generatorWired`, not the engine label.
- Documented floors from `.claude/gap-loop/lessons.md` (music/ambient stems with no music engine; cutscenes VO by design; ambient spatialization = config not media; 3 UE gates needing real PIE/Chaos/rig; the Qwen 3D-face ceiling) stay red **on purpose**. They are truth, not gaps.
- Recorded quality ceilings live in `src/lib/status/ceiling-facts.json`.

Dropping a cell for this reason is a **result**, not a failure — report it as "at its achievable max" with the reason.

## DISPATCH — up to 10 Opus subagents

- **One agent per catalog** (not per cell): the judge is sibling-aware and entity-coherent, so an agent must own every step of an entity at once. Splitting one catalog across agents manufactures the exact sibling contradictions green-loop exists to remove.
- **Cap at 10 concurrent.** Each agent gets: its catalog(s), the exact cell list with current rung + `because` + judge findings, the owning half's SKILL.md, and the honest-floor list for its cells.
- **Disjoint ownership.** Two agents must never touch one catalog, and content agents never edit repo source another agent owns.
- Agents work the **DB via the API**, not repo files (content lives in `pipeline_artifacts`).
- **Namespace the scratchpad per agent** — `.../scratchpad/cfg-<catalog>/`. Agents share ONE scratchpad directory; in the 2026-07-29 wave one agent's `cfg/Localization.json` clobbered another's mid-run and it read back a foreign catalog's content. Never let two agents write the same temp filename.
- **Stamp the baseline before dispatch.** Record each target cell's `updated_at` alongside its judge findings. Findings describe the content as it was *when judged*; if the artifact was rewritten since, the "before" score grades content that no longer exists and every before→after delta in the report is meaningless. Tell the agent which of its cells are in that state.

## JUDGE AS A SEPARATE STAGE — do not let agents hold it open

Authoring and judging are different jobs with different failure modes, and fusing them cost the 2026-07-29 wave most of its verdicts.

An official verdict is `judge-run.ts --median 3` — **3 sequential Opus draws per cell**, ~20-40 min for a 9-cell catalog. An agent that authors *and then* holds that run open will, on a session limit or timeout, die with its content applied but its verdicts unrecorded — leaving the cell showing a **stale verdict that grades content it no longer holds**. That is worse than not running at all: the map now lies in a way the ladder is specifically built to prevent.

Run it in two stages:

1. **Stage A — author.** Agents fix content, apply it, verify the round-trip, and **stop**. Cheap in-loop probes (`judge-one.ts`) are fine; official medians are not their job. An agent's deliverable is "content applied + what I changed".
2. **Stage B — judge.** The driver runs the official medians itself over the full changed set, resumable, one cell at a time. A killed Stage B loses only the current cell and can be restarted from the DB.

Never re-judge a cell whose agent may still be judging it — double-judging IS the one-directional re-judge spiral.

## VERIFY — re-measure, never trust the report

After every fleet:

```bash
npx tsx scripts/readiness/inventory.ts --json > after.json
```

Diff rung-by-rung against the pre-fleet snapshot. **An agent's claim is not evidence** — a cell moved only if the inventory says so. Re-measuring also catches the failure mode both campaigns hit: a fix that lifts one cell while breaking a sibling.

## Known instrumentation defects — check before blaming technique

Two harness bugs were **measured** on 2026-07-29. Both depress judged scores for reasons that have nothing to do with content quality, so **verify they are fixed before classifying any score plateau as a technique ceiling.** Recording a false `technique` ceiling permanently caps a capability class on bad evidence.

1. **The judge grades the generation prompt as content.** `scripts/judge-run.ts` → `buildPayload` strips only `genHistory` / `audioAssets` / `_provenance`, then copies every other top-level key into the judged JSON. **240 of 816 artifacts** carry a top-level `produceDirection: {direction, prompt}` whose `prompt` is the full ~5.7k-char produce instruction ("You are a senior systems designer at a AAA action-RPG studio…"). It rides into the payload verbatim — and the rubric separately penalizes *leaked engine/prompt tokens*, so the harness injects the defect it then docks for. Check with:
   `SELECT COUNT(*) FROM pipeline_artifacts WHERE data LIKE '%produceDirection%'`
2. **38% of siblings are invisible to the judge.** `src/lib/judge/siblingContext.ts` → `projectStep` emits only `statHooks` / `crossReferences` / `crossReferenceValues` plus **top-level scalars**. A step whose content lives in one nested object (the shape of nearly every `rules` archetype) projects as an **empty string**. Measured: **314 of 816 steps project empty, 143 more under 80 chars** — 56% unreadable. The judge then cannot see a sibling it is asked to check consistency against, and reports the cross-reference as invented. A large share of "cites a step that appears in no sibling context" findings are this, not author error.

Both are **grading-affecting**, so fixing either invalidates score comparability with prior waves — treat it as a rubric-version-class change and re-baseline, do not silently mix.

## STOP — the achievable maximum

Stop the campaign when a full fleet round produces **no net rung movement**, and every remaining non-R4/R5 cell has a recorded reason: an honest floor, a documented ceiling, or a declared gate awaiting a runtime that does not exist yet. Then write the ladder histogram + the reason list to the relevant overlay's `state.md`.

**Never** move a cell by weakening a checker, hand-editing artifact status, or re-judging a settled green — that is not a maximum, it is a lie with a nicer colour.
