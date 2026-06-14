# Zen-Perf Fix Wave 9 — Medium DB / Fetch Consolidation

> 6 findings closed (8 commits incl. a test update + an import cleanup). Server/data-layer
> query + request consolidation; all output-identical.
> Baseline preserved: tsc 0→0; tests 15 fail / 3959 pass (back to baseline after a caught regression).

## Commits

| Finding | Fix | Tests |
|---|---|---|
| ctx 01 (ability-spec DDL) | bootstrap ability_specs schema once per process (module-level flag) | 2 |
| ctx 23 (BuildConfigSelector) | UAT command is pure → compute client-side; 1+K HTTP/mount → 1 (+import cleanup) | 119 |
| ctx 23 (BuildHistoryDashboard) | `action=dashboard` composite route → 4 requests → 1 (+test mock update) | 92 |
| ctx 35 (game-director-db) | getDirectorStats 7→5 (conditional aggregates); getHealthTrend 1+2N→3 (GROUP BY + IN) | 10 |
| ctx 28 (prompt-evolution) | de-dup getAllABTests (2→1); single-pass module grouping in getEvolutionStats | 21 |
| ctx 35 (regression processSession) | batch per-finding reads (WHERE IN + Maps); Wave-7 idempotency untouched | 22 |

All preserve identical returned values/shapes (verified by passing tests + reasoning).

## A caught regression (process note)

The BuildHistoryDashboard composite-fetch change broke that component's own test — the test
mocked the four per-action GETs, and the dashboard now fires one `action=dashboard` request, so
the mock's fallback returned empty stats and the a11y `findByRole('progressbar')` timed out. The
full-suite check caught it (15→16 failures); I updated the mock to the composite shape (assertion
unchanged) and confirmed 15/3959. **Lesson:** changing a component's fetch shape can break tests
coupled to the old request shape — run the full suite, don't trust per-fix subagent tests alone.
(Also learned the baseline 15 failures = 13 catalog/ueStaticCheckers + leonardo-client + ChartPanel,
all pre-existing on master.)

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3959 pass — baseline (no net regressions; the one introduced was fixed) |
| ESLint (changed files) | 0 errors (orphaned Play/ChevronDown imports cleaned) |

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
| 8 | Medium memoization sweep (batch 1) | 6 |
| 9 | Medium DB/fetch consolidation | 6 |

**Total closed: 55 / 176** (56 counting #37). All highs + 12 mediums done. ~70 mediums + 27 lows remain.
