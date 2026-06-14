# Zen-Perf Fix Wave 10 — Correctness Mediums (bug-shaped)

> 6 findings closed. Genuine bugs (not perf): each fix changes wrong behavior to correct,
> and adds/strengthens a test that would have caught it.
> Baseline preserved: tsc 0→0; tests 15 fail / 3970 pass (+11 new passing, 0 new failures).

## Commits

| Finding | Bug → Fix | Tests |
|---|---|---|
| ctx 21 (finding-collector) | combat-trace prose-before-JSON made `indexOf('[')..lastIndexOf(']')` straddle non-JSON → parse threw → pass silently dropped ALL findings. Now `scanBalancedJson` (string/escape-aware) + ```json fence extraction. | +9 |
| ctx 05 (inventory) | `primaryEntry = entries[0]!` handed `undefined` to useGeneration on an empty store → tab crash. Now `ItemEntry | undefined` + placeholder for the hook + gated (Re)generate. | 25 |
| ctx 18 (error-memory) | recordError 3 queries/error + non-transactional batch. Now one INSERT…ON CONFLICT…RETURNING + `db.transaction` batch (atomic). Rows verified identical; Wave-6 guard untouched. | (equiv. script) |
| ctx 20 (gdd-synthesizer) | "Avg Duration" used `(avg+x)/2` pairwise running mean (recency-weighted) → wrong number. Now true `sum/count`. | +2 |
| ctx 24 (ai-behavior) | AttackRing scale `/300` vs slider max 500 → ring clipped the viewBox at high distances. Now scale derived from a shared MAX_DISTANCE=500. | 6 |
| ctx 19 (weekly-digest) | longestStreak reused the LIMIT-200 recent query → a historical best streak scrolled out of the window and "best streak" silently shrank. Now full-history scan (monotonic). | (no test exists) |

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3970 pass — no new failures; +11 new passing |
| ESLint (changed files) | 0 errors (2 pre-existing unused-var warnings on master: getCategoryForSubModule, prevStartStr) |

## Cumulative status — all waves

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted) |
| 5 | React re-renders (batch 2) | 6 |
| 6 | Resource leaks / lifecycle | 6 |
| 7 | Correctness consolidation | 4 |
| 8 | Medium memoization sweep | 6 |
| 9 | Medium DB/fetch consolidation | 6 |
| 10 | Correctness mediums (bug-shaped) | 6 |

**Total closed: 61 / 176** (62 counting #37). All highs + 18 mediums done. ~58 mediums + 27 lows remain.

## Remaining (lower-severity, for future passes)
- ~24 medium re-render/memo (StateMachineEditor showCode gate, economy buildSupplyDemand, CatalogGearTab reflow, etc.)
- ~7 medium duplication (Leonardo 3 poll loops, ability damage-formula vs simulator, DR/danger-zone chart geometry)
- ~5 medium lifecycle (bridge poll AbortController, connection-manager reconnectAttempts, harness verifier kill-timers)
- ~2 medium algorithmic (menu-flow O(transitions·nodes), linkEntityToModule O(entities·194))
- listDeferredArtifacts missing index (needs a migration), 27 low findings
- **Deferred from highs:** #3 inventory cardRefs refactor, #12 CLITabBar/CLIBottomPanel, session_analytics (module_id, completed_at) index
- **Pre-existing, unrelated:** 15 test failures (13 catalog/ueStaticCheckers + leonardo-client + ChartPanel) — on master throughout.
