# Bug+UI Scan Fix Wave 7 — Stale state & dead reads (theme G)

> 6 commits, 6 High findings closed (+8 new tests).
> Baseline preserved: tsc 0 src errors → 0; eslint (changed files) 0; tests (see Verification).

One mental model: **derived/cached state must be keyed to what it was computed from (project, approach population, checklist snapshot) and refetched when the thing it observes changes — a cache with no identity, or an effect keyed on something that never changes, silently shows the wrong answer as authoritative.**

## Commits

| # | Commit | Finding closed | The stale/dead read |
|---|---|---|---|
| 1 | `2062543` | health-insights #1 | every approach stamped with the module-wide success rate (wrong population) |
| 2 | `0c9fd79` | prompt-evolution #2 | hardcoded module picker drifted — 5 phantom ids, 5 real modules unreachable |
| 3 | `75fc854` | prompt-evolution #1 | A/B tests had no list endpoint — vanished on reload, Stats still counted them |
| 4 | `5a79052` | game-director #1 | SessionDetail effect keyed on session.id (never changes) → no refetch after a run |
| 5 | `4915d73` | quality-eval #2 | BatchReviewPanel interval created only in startBatch → frozen on remount/reload |
| 6 | `6a288b6` | gdd-compliance #1 | report is a global singleton → project A's scores shown for project B |

## What was fixed

1. **Per-approach success rate.** The miner divided by all module sessions, not the approach's; a 25%-real approach was stored at the 45% module blend and could be recommended as an anti-pattern's `bestAlternative`. Now divided by that approach's own sessions via the same `approachOf` memo the anti-pattern path uses.
2. **Registry-derived module picker.** `MODULE_OPTIONS` now maps `SUB_MODULES`, so it can't drift from the source `getModuleChecklist` reads.
3. **A/B test list endpoint.** New `get-tests` route action (backed by `getAllTests`, filterable by module) + `loadTests()` called from store `init()`, so persisted tests survive a reload instead of orphaning while Stats counts them Active.
4. **SessionDetail refetch.** Added `session.status`/`session.completedAt` to the data-loading effect deps so a completing/re-run playtest refetches instead of leaving the Findings tab empty under a "12 findings" header.
5. **Status-driven poll.** BatchReviewPanel's interval now lives in a suspend-aware effect keyed on the observed `batch.status === 'running'` (not on the start action), so it resumes on remount/reload; abort runs `pollStatus()` in `finally` so a post-completion 400 still refreshes.
6. **Project-keyed compliance.** The GDD report is tagged with its `projectPath` + a canonical checklist hash; `ensureAudit()` re-audits when either differs (cheap local compute), so a switch or late hydration never shows a stale/empty-checklist report. Added `clearReport()`.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors in `src/` (per-fix and at wave end) |
| `eslint` (all 15 changed files) | 0 problems |
| `vitest run` (full suite) | **3956 pass / 15 fail / 1 skip** — failure set identical to waves 1–6 (all pre-existing); +11 new tests passing across the 6 fixes |

## Cumulative status (this scan)

| Wave | Theme | Closed | Crit |
|---|---|---:|---:|
| 1 | CLI process lifecycle & abort theater | 6 | 1 |
| 2 | Fix-the-fixes (06-09 regression tail) | 7 | 0 |
| 3 | Destructive writes & data loss | 6 | 0 |
| 4 | UE5 codegen correctness | 4 | 0 |
| 5 | Queues, races & orphaned async | 6 | 0 |
| 6 | Trust boundaries & sim/display correctness | 4 | 0 |
| 7 | Stale state & dead reads | 6 | 0 |
| **Total** | | **39 / 323** | **1 / 1 (100%)** |

## Patterns established (catalogue items 50–53)

50. **Derive a per-group metric from the group's own population.** A rate computed once over the whole set and stamped onto every subgroup is wrong for all but the average — compute inside the subgroup loop (and reuse the memo a sibling pipeline already built).
51. **A picker/option list must derive from the registry it gates on.** A hardcoded "sample" list silently drifts: dead-end ids that resolve nothing, and real entities that become unreachable. Map the source of truth.
52. **Persisted data needs a read-back path, not just a write path.** Making something durable server-side is half the job; if the only loader is the current session's own mutation responses, a reload orphans it. Add a list endpoint + load on init.
53. **Key effects/caches on what actually changes.** An effect keyed on a stable id (session.id) never reruns when the entity's *contents* change; a cache with no project/snapshot identity never invalidates. Depend on the status/timestamp/hash that flips, or tag the cache and compare.

## What remains

323 → 284 open findings. Remaining themes (fresh session): **H + U3 — shell hazards + silent-failure UX** (~7), **U2 + U1 a11y foundations** (ConfirmDialog primitive, controls.tsx focus ring, shared dialog semantics, row-button pattern), then the U1 keyboard-access sweep (2–3 waves), plus the Medium/Low tail.
