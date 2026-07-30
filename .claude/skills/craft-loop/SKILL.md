---
name: craft-loop
description: The AAA-LENS axis of the PoF readiness campaign — gauges every pipeline step against real AAA studio practice on the PARALLEL A-axis (A0 UNGAUGED → A4 AAA-PARITY, src/lib/status/craft.ts) using the research-grounded lens library (src/lib/craft/lenses/), records honest per-medium ceilings (3D/anim capped at A2 forever), and ROUTES findings instead of fixing them — content defects to green-loop, missing human-review surfaces to the ideas backlog, capability gaps to the ceilings file. Never touches an R-grade. Invoke with "run craft-loop" / "craft-loop know | audit | route | wrap". For raising R-rungs use gap-loop/green-loop via readiness-loop.
---

# Craft Loop — gauge the map against AAA practice, honestly

One question, run over run: **how far is each step's output from what a AAA studio ships for that deliverable class — and which of those gaps are fixable effort, which are missing review UX, and which are capability ceilings to record rather than fight?**

The R-ladder (readiness.ts) measures automation honesty; the **A-axis** (craft.ts) measures craft distance from the roof. They are orthogonal and painted together on `/status?tab=pipelines` (A-chip per cell + the distance-to-roof rollup). Perfect tier for a step = **R5 × A-at-its-ceiling**. Design spec: `docs/superpowers/specs/2026-07-30-craft-loop-design.md`.

> Engine vs. memory: this file is the engine. Cross-session memory lives in the
> **`.claude/craft-loop/` overlay** (`state.md`, `journal.md`, `lessons.md`) — gitignored
> scratch; read it FIRST every run so sessions compound instead of restarting.

## The scale (read it before gauging)

`src/lib/status/craft.ts`: **A1 HOBBY** (would not survive professional review) · **A2 INDIE** (shippable indie, systematic gaps) · **A3 AA** (professional, misses named AAA-differentiating practices) · **A4 AAA-PARITY** (indistinguishable from the lens's benchmark anchors). A0 UNGAUGED is absence — never stored, only projected. States: `^` at-ceiling (achievement — the medium's recorded roof, `src/lib/craft/craft-ceilings.json`: 3d-mesh/animation A2 permanent, 2d-art A3 arguable, text/code/audio/vfx A4 uncapped), `~` stale (content changed since gauged).

## The flow

**KNOW (refresh lenses only when needed) → AUDIT (fleet + spot-check) → ROUTE (findings to their owners) → WRAP (journal + delta).**

## KNOW — the lens library

- Ten research-grounded rubrics in `src/lib/craft/lenses/<lensId>.md` — versions pinned in `src/lib/craft/lens-versions.ts`, mapping in `lens-map.ts` (deliverable class → lens; text catalogs may redirect to narrative/dialogue; cutscene audio → voiceover). The linter test `src/__tests__/lib/craft/lens-files.test.ts` enforces format + citations.
- **Only touch a lens when it is missing or genuinely wrong.** Any change that could move a score = bump `lensVersion` in BOTH the file frontmatter and `lens-versions.ts` — the bump projects every dependent verdict back to A0 UNGAUGED (visible invalidation, the point). Typo fixes don't bump.
- New rubric criteria MUST cite verifiable sources (GDC talks, postmortems, published standards). No invented citations — the linter counts Source lines, but only honesty keeps them real.
- **Calibration gate: the user reviews new/changed lens files before the first audit under them.** The lenses anchor "AAA" to the project's roof, not the model's vibes.

## AUDIT — gauge, don't fix

- **One agent per catalog** (sibling-aware: a step's craft is judged in its entity's context). Agents are **read-and-score only** — they author nothing, so a died agent leaves no stale content, only missing gauges.
- Per step the agent reads the artifact (DB via API), the step's lens file, and sibling steps, then POSTs to `/api/craft-verdicts`: `{catalogId, entityId, step, lens, lensVersion, aLevel, findings[], model}`. Every finding names the violated **criterion id** from the lens file and carries a routing `class`: `content` / `capability` / `ux`. Below-A4 with zero findings is rejected by the route.
- Per catalog, one **production-process scorecard**: entity `__catalog__`, step `__process__`, lens `production-process` — gauges the pipeline's shape (stage gates, human-review surfaces) not any step's content. Missing review surfaces are `ux`-classed findings.
- **Gauge against the ceiling honestly**: a 3D mesh judged A2 is AT ROOF — say so in the findings tone; do not manufacture A3 criteria a generative pipeline cannot meet (that is what the ceiling file records).
- **Cost shape**: single Opus draw per step (A-levels are coarse 5-buckets). Then the driver spot-checks: re-draw 10% of cells per catalog (min 3) with a fresh agent; any disagreement > 1 level voids and re-audits that catalog.
- The staleness anchor is stamped server-side (artifact `updatedAt` at write time) — never post a gauge for content you did not just read.

## ROUTE — findings go to their owners; this loop fixes nothing

| Finding class | Goes to | How |
|---|---|---|
| `content` | **green-loop** | append to the catalog's worklist (the readiness-loop PICK row: R2+ content with A below ceiling → green-loop with craft findings) |
| `ux` | **ideas backlog / /perfect vault** | file as a concrete review-surface proposal (which gate, which surface is missing) |
| `capability` | **`src/lib/craft/craft-ceilings.json`** | if it names a genuinely new ceiling, record it with reason + class; else it confirms an existing one — journal it |

Never dispatch a fix from inside this loop. The 2026-07-29 lesson (authoring and judging fused) applies doubly here: the gauge's value IS its independence.

## WRAP — compound the memory

1. `npm run validate` green; commit narrowly (shared tree — `git add` specific files only).
2. Update `.claude/craft-loop/state.md` (catalogs gauged, A-histogram, spot-check outcomes, next-batch pointer) + `journal.md` (dated entry) + `lessons.md` (anything hard-won).
3. Print the delta: distance-to-roof total + per-lens before → after (the `/status` rollup is the ground truth — read it, don't compute your own).

## Re-gauge triggers

- A lens version bump (its cells all read A0 — re-audit them).
- Stale gauges (`~` on the map — content re-produced since).
- An explicit "re-gauge" when the model market moves (the long-term chase: as generation improves, the same lenses should score higher — THAT is the measurement of progress).

## Laws (inherited from the campaign, non-negotiable)

- **Never game a lens.** Levels move by better content (green-loop's job) or a versioned rubric change — never by re-drawing until a nicer number appears.
- **Ceilings are results.** At-ceiling renders as achievement; recording a ceiling with its reason is a deliverable, not a failure.
- **The A-axis is display-only.** `src/__tests__/lib/craft/craftDisplayOnly.test.ts` pins that no grading module imports craft — do not "just wire it in" anywhere near acceptance.
- **Stale is stale.** Never report a `~` gauge as current; re-gauge or say UNGAUGED.
- **An agent's claim is not evidence** — the map's rollup after re-load is.
