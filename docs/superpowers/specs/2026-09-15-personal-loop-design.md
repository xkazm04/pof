# personal-loop — operator-paired pipeline quality walk

**Date:** 2026-09-15 · **Status:** approved (operator, in session) · **Normative source:** `.claude/skills/personal-loop/SKILL.md`

## Problem

The readiness campaign's loops (readiness-loop, gap-loop, green-loop, craft-loop) are autonomous. They raise levels, but the operator can't steer *how* a step produces its output (its prompt, its UI, its functionality) while that work happens. The operator wants a loop that works through the /status pipelines map one item at a time, produces the best output it can, and stops so they can give feedback.

## Decisions (operator-confirmed)

| Question | Decision |
|---|---|
| Walk order | `/status?tab=pipelines` lane order, **column-major**: every pipeline's step 1 top-to-bottom, then every step 2, and so on. Pipelines shorter than the current column are skipped. |
| Checkpoint | **Stop after every item.** Progress is tracked in the Obsidian vault so settled topics aren't raised again unless the operator reopens them. |
| Item granularity | **Pilot entity, then fan out.** Iterate on one representative entity; after "good", apply the settled result to the catalog's other entities. |
| Quality bar | **Both axes.** The R ladder (`readiness.ts`) and the A craft axis (`craft.ts`), aimed at R4/R5 × A-at-ceiling. |
| Recertify | After all requested work on an item, re-read the cell and report improved / held / degraded per axis. A degraded or unmeasured result stops for the operator. |

## Design decisions (made in design, recorded here)

1. **Frozen order.** `sortLanes` sorts by `readyPct`, so lifting a cell reorders lanes. The walk is snapshotted to `Personal/order.json` and retaken only on an explicit `reorder`.
2. **One truth path.** The scripts build lanes with the map's own `buildSwimlane` / `sortLanes` / `readinessOf` / `craftForCell` and the DB modules' `rowToArtifact` / `rowToVerdict` / `rowToCraftVerdict`, reading SQLite read-only. Verified against `scripts/readiness/inventory.ts` on all 344 cells on 2026-09-15 (0 mismatches).
3. **Conservative movement** (`src/lib/status/personalLoop.ts`, unit-tested):
   - R: when both readings are in the same state, compare rungs. Leaving `reached` is always `degraded`. A lifted wait or condemnation counts as `improved` only if the rung didn't drop. Otherwise the order is blocked < waiting.
   - A: an after-reading that is A0, stale, or absent is `unmeasured`. A before-reading that isn't a real gauge gives `baselined`. Otherwise compare craft rank; at-ceiling counts as gauged.
   - Overall: worst news wins, in the order degraded > unmeasured > improved > baselined > held.
4. **Memory in the vault, not the repo.** `Personal/Personal.md` (home), `order.json` + generated `order.md`, append-only `topics.md` with scoped lines (`global`, `deliverable:`, `archetype:`, `catalog:`, `step:`, `item:`), and `items/<slug>.md` whose frontmatter `status:` is the single source of progress. Baselines sit beside the note so a comparison survives across sessions.
5. **Produce through the product's path.** Pilot output goes through the app's own prompt or generator, so feedback on prompts and UI changes the product. Engine recipes are reused from gap-loop and green-loop.
6. **Independent measurement.** Judge verdicts come from `judge-run.ts`. Craft gauges come from a fresh subagent that didn't author the content. The loop never edits a checker, rubric, or lens to pass.
7. **Honest floor.** Media deliverables with `generatorWired: false` get a stop that names the capability gap, never a stand-in output.
8. **Operator stop via AskUserQuestion** (Good / Skip / Park, with free-text feedback), per the Fleet Machine Protocol's rule for real decisions.

## Components

| Unit | Responsibility |
|---|---|
| `src/lib/status/personalLoop.ts` | Pure: `columnMajorOrder`, `readinessMovement`, `craftMovement`, `overallMovement`, `itemSlug` |
| `src/__tests__/lib/status/personalLoop.test.ts` | Order and movement rules |
| `scripts/personal-loop/truth.ts` | Read-only DB load → `loadLanes`, `readCell` (whole cell or pilot entity), `personalDir` |
| `scripts/personal-loop/order.ts` | `snapshot` / `next` / `status` (regenerates `order.md`) |
| `scripts/personal-loop/recertify.ts` | One cell's reading; `--baseline` / `--compare` / `--entity` / `--json` |
| `.claude/skills/personal-loop/SKILL.md` | The flow: BOOT → BASELINE → RECALL → LOCATE → PILOT → STOP ⇄ FEEDBACK → FAN-OUT → RECERTIFY → WRAP |

## Out of scope (YAGNI)

- A live cursor overlay on `/status`. If wanted, it can be requested as feedback at an operator stop.
- Auto-dispatching items to the other loops. That contradicts the stop-after-every-item requirement.
