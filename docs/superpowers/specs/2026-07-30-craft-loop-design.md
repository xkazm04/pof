# Craft Loop — the AAA-lens axis (design)

**Date:** 2026-07-30 · **Status:** approved in brainstorming, pending spec review

## Problem

The readiness campaign's three loops (gap-loop = existence, green-loop = quality,
readiness-loop = driver) drive every pipeline step up the R0–R5 ladder, which measures
**automation honesty**: something real exists, a gate or strict judge confirmed it, it
runs in UE. The scale says nothing about whether the output would survive review at a
AAA studio — the app has no encoded knowledge of AAA development processes or outputs,
so its ceiling is "honestly automated", not "professionally crafted".

The long-term bet: the LLM market will make AAA-grade code, stories, dialogue,
voiceover, and effects feasible (arguably 2D art), while generative 3D modelling and
animation will **never** reach top tier. The app needs a roof high enough to chase for
years, with those permanent caps stated honestly.

"Perfect tier" for a step therefore has three legs:

1. **Automation** — exceptional automated execution with human review (the existing
   R-ladder + gap/green/readiness loops).
2. **Human postprocessing UX** — first-class app surfaces to review, curate, and
   post-process outputs with ease and high visual standard.
3. **AAA craft** — output and process measured against real AAA practice, honestly.

This design adds leg 3 as a measured axis and captures leg 2's gaps as routed findings.

## Decision summary

| Decision | Choice |
|---|---|
| Where craft verdicts live | **Parallel A-axis** (A0–A4) beside R0–R5 on /status; R-ladder unchanged |
| v1 scope | **Knowledge + audit** — fixing is NOT a new engine; content findings feed green-loop |
| Lens set | **9 output-discipline lenses + 1 per-catalog process lens** |
| Knowledge source | **Research-grounded rubrics** with named benchmark anchors and citations |
| Human-UX leg | **Process-lens findings → improvement backlog** (no third painted axis) |
| Structure | **New worker skill `craft-loop`** peer to gap/green + one routing row in readiness-loop |

## 1. The A-axis

New pure projection module `src/lib/status/craft.ts`, built exactly like
`src/lib/status/readiness.ts`: display + routing only. Acceptance, `gradeArtifact`,
checkers, and `statusModel`'s judge-elevation logic never read it.

| Rung | Name | Means |
|---|---|---|
| **A4** | AAA-PARITY | Indistinguishable from the lens's named benchmark anchors for this deliverable class |
| **A3** | AA | Professional craft; misses named AAA-differentiating practices (findings cite which) |
| **A2** | INDIE | Competent, shippable in an indie title; systematic gaps vs professional practice |
| **A1** | HOBBY | Would not survive any professional review |
| **A0** | UNGAUGED | No craft verdict yet, or the verdict's lens version is outdated |

Two states beside the rung (mirroring the R-ladder's waiting/blocked discipline):

- **`^` at-ceiling** — the step has reached the maximum its medium permits. Rendered as
  an achievement (a 3D mesh at `A2^` is a *result*), never as amber shame.
- **`~` stale** — artifact `updated_at` is newer than the verdict's `judged_at`; the
  score grades content the step no longer holds and must not be trusted or reported.

**Ceilings** live in `src/lib/craft/craft-ceilings.json`, per deliverable class, each
with a recorded reason and the market assumption stated explicitly:

| Class | Ceiling | Reason class |
|---|---|---|
| `3d-mesh`, `animation` | **A2** | permanent — generative 3D/anim assumed never top-tier |
| `2d-art` | **A3** | arguable — revisit as image models move |
| code / story / dialogue / voiceover / sfx-music / vfx | **A4** | uncapped — the long-term chase (vfx = the authored effect spec/graph; any capped mesh inputs are covered by the 3D ceiling) |

**Perfect tier** for any step = `R5 × A-at-its-ceiling`.

## 2. Lens library (KNOW phase)

Ten versioned files at `src/lib/craft/lenses/<lens>.md`:
`game-systems-code`, `narrative`, `dialogue`, `voiceover`, `audio` (SFX/music), `vfx`,
`2d-art`, `3d-art`, `animation`, `production-process`.

Each file: frontmatter (`lensVersion`, `deliverableClasses`, `ceiling`) + body with

- **Benchmark anchors** — named shipped games / studio practices per A-level.
- **Criteria with citations** — GDC talks, postmortems, published studio pipeline
  write-ups. A criterion without a source does not ship.
- **Scoring guidance** — disqualifiers and level boundaries, written so a score of A2
  can name exactly which AAA practice is missing.

The `production-process` lens is per-**catalog**, not per-step. It encodes the AAA
stage-gate shape (concept review → pre-production → content reviews → QA/integration →
sign-off) and audits **where the app gives the operator a human-review surface at each
gate a AAA team would have** — this is the measurement point for the human-UX leg.

Build: a research fleet (WebSearch/WebFetch mining, distilled per lens, citations
kept). **Calibration gate: the user reviews all ~10 lens files before the first audit
runs** — a cheap human pass that anchors "AAA" to the project's roof, not the model's
vibes.

Mapping: `src/lib/craft/lens-map.ts` assigns every `step-facts.json` deliverable class
to exactly one lens. A validate-time test fails if any class is unmapped.

## 3. Audit (AUDIT phase)

- **Fleet shape:** one Opus agent per catalog (sibling-aware — a step's craft is judged
  in its entity's context; the green-loop sibling lesson holds). Agents are
  **read-and-score only**; they author nothing, so the stale-verdict hazard from the
  2026-07-29 wave (author+judge fused) does not apply.
- **Per step emit:** `{ aLevel, findings[], routing }`. Every finding names the violated
  rubric criterion. Findings are classed:
  - **`content`** — fixable by green-loop (routed to its worklist),
  - **`capability`** — blocked on a generator ceiling (recorded in ceilings, never
    dispatched — the honest floor extended to craft),
  - **`ux`** — missing human-review affordance (routed to the improvement backlog).
- **Per catalog emit:** one `production-process` scorecard.
- **Storage:** new `craft_verdicts` table + `/api/craft-verdicts` route, cloned from
  the `judge_verdicts` pattern but a **separate table by design** — craft scores must
  never leak into `statusModel`'s judge-elevation logic. Columns: catalog_id,
  entity_id, step (or `__process__` for the catalog scorecard), lens, lens_version,
  a_level, findings JSON, model, judged_at, artifact_updated_at (staleness stamp).
- **Cost model:** single Opus draw per step — A-levels are coarse 5-buckets, far less
  variance-sensitive than 0–100 medians. Plus a driver-run **adversarial spot-check**:
  re-draw 10% of cells per catalog (minimum 3); any disagreement > 1 level voids and
  re-audits that catalog.

## 4. Display, routing, and the loop

**/status:** each pipeline cell gains a compact A-chip beside the R-code (`R4 A2^`),
glyph + word per the repo's StatusToken convention (never hue alone). The legend gains
the A-scale. A per-lens **distance-to-roof rollup** (Σ ceiling − current) is the
campaign headline — the honest measure of how much chase remains.

**Skill:** `.claude/skills/craft-loop/SKILL.md`, overlay `.claude/craft-loop/`
(`state.md`, `journal.md`, `lessons.md`, gitignored like the other overlays). Phases:

1. **KNOW** — build/refresh lens files (only when missing or version-bumping; a bump
   marks dependent verdicts A0-outdated).
2. **AUDIT** — the fleet + spot-check above.
3. **ROUTE** — `content` findings → green-loop worklists; `ux` findings → the app's
   existing improvement channels (ideas backlog / the /perfect vault) as concrete
   review-surface proposals; `capability` findings → ceilings file.
4. **WRAP** — overlay journal, fleet-memory lines, delta report (A-histogram before →
   after, distance-to-roof).

**readiness-loop integration:** one new PICK-table row — *R2+ content with A below its
ceiling and `content`-classed findings → green-loop, craft findings appended to the
worklist.* Nothing else in readiness-loop changes.

**Re-gauge triggers:** lens version bump · stale content · explicit "re-gauge" when
the model market moves. That recurrence is the long-term loop.

## Honesty laws (inherited, restated)

- Never move an A-level by weakening a lens — lenses only change via a version bump,
  which visibly invalidates dependent verdicts.
- Ceilings are results, not failures; at-ceiling renders as achievement.
- Stale verdicts are visibly stale and excluded from reports.
- The A-axis is provably display-only: a test pins `craft.ts` as a pure projection and
  asserts acceptance/grading modules do not import it.

## Testing

- `craft.ts` projection: pure, pinned rung order, state precedence (stale > at-ceiling).
- Lens-map completeness: every `step-facts.json` deliverable class maps to one lens.
- Ceilings schema: every ceiling has a reason + class.
- `/api/craft-verdicts`: standard `{success,data/error}` envelope, staleness stamping.
- Lens-file linter test: every lens has frontmatter version, anchors, and ≥1 citation
  per criterion.

## Out of scope (v1)

- A fixing engine of its own — green-loop owns content fixes.
- A third painted axis for human-UX maturity — measured via process-lens findings only.
- Re-scoring cadence automation (cron) — re-gauge is invoked manually.

## Build order (for the implementation plan)

1. `craft.ts` scale + ceilings file + tests (paints A0 UNGAUGED everywhere — honest start).
2. `craft_verdicts` table + API route + tests.
3. `lens-map.ts` + completeness test.
4. KNOW research fleet → 10 lens files → **user calibration review**.
5. /status A-chip + legend + distance-to-roof rollup.
6. `craft-loop` SKILL.md + overlay + readiness-loop routing row + docs sync.
7. First AUDIT fleet run (the baseline gauge).
