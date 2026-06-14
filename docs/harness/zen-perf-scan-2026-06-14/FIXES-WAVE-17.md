# Zen-Perf Fix Wave 17 — Last Remaining Highs

> The last 3 high findings (one a substantial architecture change). After this, essentially all highs are closed.
> Baseline preserved: tsc 0→0; tests 15 fail / 3976 pass; 0 lint errors.

## Commits

| Finding | Fix | Tests |
|---|---|---|
| #36 (ctx 02) | hoist the per-action alive-enemies scratch array out of the combat tick loop (was allocating millions of throwaway arrays); byte-identical output | 79 |
| #67 (ctx 27) | split the 540-line buildTaskPrompt switch into an 18-handler registry (new cli-task-handlers.ts); byte-identical per task type | 39 |
| #53 (ctx 05) | **architecture change (owner-approved):** make the store the single catalog source — grid renders from entries (not the frozen DUMMY_ITEMS), the entryByItemId join Map is deleted, and "Add Item" now actually adds to the grid via a new addEntity store action | 49 |

#53 was the audit's highest-effort finding (6/10): the store already seeds from DUMMY_ITEMS and each ItemEntry carries `data: ItemData`, so CatalogGearTab now reads `useItemEntries()` as its only source (filter/sort/paginate on `entry.data`), CatalogItemGrid takes `ItemEntry[]`, and `handleCreateItem` wraps the new item and calls `addEntity('items', …)`. Displayed catalog + filter/sort/paginate + the prior primaryEntry null-safety all preserved.

## Verification
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3976 pass — baseline (no regressions) |
| ESLint (changed files) | 0 errors (4 warnings: 2 unused `ctx` params in the uniform handler signature; 2 pre-existing `config` in simulation-engine) |

**Flake note (for future verification):** the pre-existing catalog/`ueStaticCheckers` suite (server-only fs checks run under jsdom) oscillates between **15 and 16** failures depending on parallel test-run order — both are pre-existing on master and unrelated to these changes. A "16" should be re-run before treating it as a regression; the wave-17-touched areas (cli-task 52, combat+stores 261, inventory 52) all pass in isolation.

## Cumulative (all merged PRs + this branch)
**96 / 176 closed — ~65 of 67 high + 31 medium** (+#37). Only ~2 scattered highs + ~45 mediums + 27 lows remain. Next: medium sweep.
