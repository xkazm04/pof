# Zen-Perf Fix Wave 4 — React Re-renders (batch 1)

> 6 perf commits applied + 1 revert. Theme: stop needless re-renders via memoization,
> ref/selector stabilization, and lifting state to its sole consumer — every fix
> behavior-preserving by construction (complete memo deps; a stale memo was the risk guarded against).
> Baseline preserved: tsc 0→0; tests 15 fail / 3946 pass (identical); 0 lint errors (2 pre-existing warnings).

This is batch 1 of the 42-finding re-render theme (the largest). I picked 7 fixes that are
behavior-identical by construction (re-renders are hard to verify visually without running the app);
**#3 was reverted** (see below) and behavior-changing ones (debounce, pagination content) were deferred to batch 2.

## Commits

| # | Commit | Finding | File(s) | Status |
|---|---|---|---|---|
| 1 | `beba531` | #1 (ctx 01) | sub_ability/index.tsx | applied |
| 2 | `7bd39de` → reverted | #3 (ctx 05) | CatalogItemGrid/TradingCard | **reverted** |
| 3 | `1ac53c1` | #5 (ctx 07) | sub_bestiary/index.tsx + ArchetypesTab.tsx | applied |
| 4 | `6961af0` | #7 (ctx 09) | sub_save/schema/BudgetAlerting.tsx | applied |
| 5 | `d0c2a02` | #8 (ctx 10) | animations/AnimationStateMachine.tsx + StateMachineEditor.tsx | applied |
| 6 | `f18d6f7` | #11 (ctx 21) | evaluator/deep-eval-engine.ts | applied |
| 7 | `f024853` | #12 (ctx 25) | layout/SidebarL2.tsx | applied |
| — | `(revert)` | #3 | reverts 7bd39de | — |

## What was fixed (each verified behavior-identical)

1. **spellbookData memo split (#1).** A useMemo carried `isSyncing` in its deps but only as a flag, re-running all 7 `buildLive*` transforms (+ search-index rebuild) on every sync toggle. Split into an inner memo (transforms, keyed on liveData/refresh) + a cheap outer memo merging `isSyncing` via spread. Context value identical for every state; only the recompute scope narrows.
2. **Bestiary filter state placement (#5).** The 6 filter states + the 94-element `filteredArchetypes` memo lived in the parent, re-rendering the whole Bestiary + sibling tabs per keystroke. Verified (grep) ArchetypesTab is the sole consumer, moved them down. Filtering/pagination logic byte-for-byte identical; keystrokes now re-render only ArchetypesTab. 7/7 tests.
3. **BudgetAlerting memoization (#7).** Re-ran regression projections (3× redundant) + nested `.find` lookups every render over frozen module constants. Wrapped in a `useMemo([])`, built the lookup Map once, collapsed the duplicate footer pass. ~13 passes/render → once. Output identical.
4. **Animation O(E²) edge scan (#8).** Both state-machine canvases ran `displayTransitions.some(...)` per edge to detect a reverse edge — O(E²), fired on drag mousemove. Added an `edgeKeySet` (Set of `from->to` keys); per-edge check is `set.has(reverseKey)` — O(1), identical condition. O(E²)→O(E). 23 tests.
5. **emitProgress snapshot (#11).** Replaced `JSON.parse(JSON.stringify(passStatuses))` per emit (~140/scan) with a shallow structural copy (fresh outer object + per-module-row spread; immutable string leaves shared). Content-identical, no consumer mutates the snapshot. 22 tests.
6. **SidebarL2 selector narrowing (#12).** Each StatusBadge subscribed to the whole `sessions` map, so every streamed token re-rendered every badge + the tab bar/panel. Moved the derivation into the Zustand selector — each badge selects the primitive `'failed'|'running'|null` it displays (Object.is skips unrelated updates; no new-object trap). Same priority logic. 7 tests.

## #3 reverted — and why (a durable lesson)

The inventory fix extracted a memoized `CatalogGridCell` and stabilized its `onFocus`/`onClick` —
correct in spirit — but the card's `ref` lives inside that cell, and writing the **`cardRefs` prop**
(`cardRefs.current[i] = el`) from a child (or from any `useCallback`, even in the parent) trips the
**React Compiler `react-hooks/immutability` rule**: "component props cannot be modified." `master`
avoids it only because it mutates `cardRefs.current` via an **inline ref callback in the parent's own
JSX** — the one form the rule permits. Satisfying the rule while memo-extracting the cell requires
lifting the ref-registration callback to the component that *owns* `cardRefs` (creates it via `useRef`),
which is outside this fix's 2-file scope. Rather than ship a lint error or an `eslint-disable`, I reverted
and deferred. **The inventory grid re-render fix (#5-inventory) needs a follow-up touching the cardRefs owner.**

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3946 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (2 pre-existing warnings: `fps`, `PASS_LABELS`) |

## Patterns established (catalogue, items 13–15)

13. **Split the cheap flag out of the expensive memo** — a useMemo recomputes a heavy transform because a cheap, unrelated flag sits in its deps. Split: heavy memo keyed on true inputs + a cheap outer memo that merges the flag.
14. **Narrow the store subscription to a primitive** — components subscribing to a whole map/object re-render on every unrelated mutation (e.g. a streamed token replacing the map). Select the primitive slice the component displays (Object.is equality), or lift the filter state to the sole consumer. Avoid returning a fresh object from the selector (the new-object-per-render trap).
15. **React Compiler immutability boundary (gotcha)** — mutating an object/ref that arrives as a prop is rejected by `react-hooks/immutability` *except* via an inline ref callback in the owning component's own JSX. Memo-extracting a list item whose ref writes a parent-owned ref array trips this; the ref-registration must live in (or be a stable callback created by) the component that creates the ref.

## Cumulative status (waves 1–4)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted/deferred) |

**Total closed: 27 / 176.** Remaining: ~149.

## What remains
- **Wave 4b/5 (re-render batch 2):** #2 (search debounce — behavior), #4 (loot live-preview pagination — content), #6 (map/topology SVG memo), #9 (Baseline `steps` memo-bust), #10 (HolisticHealthView unstable effect re-POST), #13 (ws-live-state unconditional store writes). Plus the deferred **#3 inventory** (needs the cardRefs-owner refactor) and the **#12 follow-on** in CLITabBar/CLIBottomPanel (same coarse subscription).
- Other themes: Wave 6 (resource leaks, 13), Wave 7 (correctness + diverged-logic consolidation, incl. #14 triplicated damage formula, #45, #66).
