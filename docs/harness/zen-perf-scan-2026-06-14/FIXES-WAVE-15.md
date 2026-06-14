# Zen-Perf Fix Wave 15 — Client Over-fetch (Wave 2b) + the BT-metric decision

> 5 high findings closed. The deferred Wave-2b client-fetch highs + the now-decided BT metric.
> Baseline preserved: tsc 0→0; tests 15 fail / 3976 pass (identical); 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| #15 (ctx 07) | BehaviorTreeMetric now computes from the canonical BT_TREE (54 nodes / 6 depth) per the product decision; deleted the stale 8-node flat BT_NODES/BT_EDGES + dead coords | 19 |
| #26 (ctx 12) | cache the Poly Haven catalog (1h TTL) instead of refetching the full catalog per search | 20 |
| #30+#31 (ctx 22) | debounce scenario edits (local-while-focused, 400ms, flush on blur — no mid-edit clobber) + batch handleRunTests into one transactional bulk-status PUT | 6 |
| #35-FE (ctx 35) | FindingsExplorer uses the existing getAllFindings() batch (one request) instead of one-per-completed-session fan-out re-fired on refresh | 7 |

## Notable process points

- **#15** was actioned only after you chose "reflect the real tree" — the tile value changes (8/4 → 54/6) by design; the flat sample graph is now deleted.
- **#30/#31** needed a new batch endpoint (route + transactional `bulkUpdateScenarioStatus` db + hook op) since none existed.
- **Caught two of my own lint regressions** in the debounce fix: the render-time re-sync first tripped `set-state-in-effect` (fixed via adjust-state-during-render), then `react-hooks/refs` (reading `focusedRef.current` during render) — resolved by tracking focus as state, not a ref. Both fixed before the wave closed; final lint is 0 errors.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3976 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (pre-existing warnings only: useGameDirector `mutate`, etc.) |

## Cumulative (merged PR #2 + this branch, waves 13–15)
**89 / 176 closed — 58 of 67 high + 31 medium** (+#37). **~9 highs remain**, all in the deferred set that needs a design decision or a large refactor:
- **#17 post-process effect systems** — two drifted effect lists (7 vs 10); unifying picks a canonical set (effects appear/disappear).
- **#21 ability-forge prompt** — wiring it through the shared context system deliberately changes the emitted prompt (adds guardrails).
- **#18 audio CLI plumbing** — verbatim-duplicated across many module views; a broad mechanical extraction.
- **#24 two connection managers** (pof-bridge client vs ue5-bridge server) — architectural consolidation across opposite execution models.

Plus ~46 mediums + 27 lows.
