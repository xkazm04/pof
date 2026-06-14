# Zen-Perf Fix Wave 5 — React Re-renders (batch 2)

> 6 fixes (7 commits incl. a react-compiler follow-up), 6 findings closed. Batch 2 of the
> re-render theme — the more behavior-touching ones (debounce, conditional fetch/writes),
> each kept observably equivalent.
> Baseline preserved: tsc 0→0; tests 15 fail / 3946 pass (identical); 0 lint errors.

With batch 1 (Wave 4), this closes **12 of the 13 high-severity re-render findings** (#3 inventory
remains deferred — it needs the cardRefs-owner refactor, see Wave 4 doc).

## Commits

| # | Commit | Finding | File(s) |
|---|---|---|---|
| 1 | `813ff6a` | #2 (ctx 01) | sub_ability/SpellbookSearch.tsx + spellbook-search-index.ts (+ test fixture) |
| 2 | `a095caa` | #4 (ctx 06) | sub_loot/affix/LootTableEditor.tsx |
| 3 | `8badb50` + `(follow-up)` | #6 (ctx 08) | sub_world/index.tsx + MapCanvas.tsx + TopologyGraph.tsx |
| 4 | `6eb416c` | #9 (ctx 17) | layout-lab/Baseline.tsx |
| 5 | `0022f5a` | #10 (ctx 19) | evaluator/HolisticHealthView.tsx |
| 6 | `a9c84b8` | #13 (ctx 32) | ue5-bridge/ws-live-state.ts + stores/ue5BridgeStore.ts |

## What was fixed

1. **Spellbook search debounce + stable index (#2).** Re-keyed the index `useMemo` onto the underlying source arrays (not the unstable `data` context object), precomputed `labelLower` once per result, and debounced the filter query 150ms (the input stays bound to raw `query`, responsive; only the O(index) scan waits). Final results identical.
2. **Loot preview memo (#4).** The live-preview bar is a deliberate WHOLE-TABLE drop-rate distribution (segment width = weight/totalWeight) — paginating it would show widths not summing to 100%, so I memoized it instead (recomputes only on entry/weight changes, not on unrelated ticks). Displayed content identical.
3. **World map re-renders (#6).** `matchingIds` was a `useMemo` keyed on a fresh `.filter()` array every tick, minting a new Set + re-rendering the whole animated map/topology SVG. Re-keyed on the existing `matchSignature` and memoized ZoneMapCanvas + TopologyGraph. **Follow-up commit:** built the Set *from* the signature (`split('|')`) so the memo reads only its dep — satisfies react-hooks/preserve-manual-memoization without an eslint-disable. Identical Set; visual output unchanged.
4. **Baseline steps memo (#9).** `pipeline.steps.map(...)` was a fresh array every render, busting `useEntityArtifacts`' memo. Wrapped in a `useMemo` keyed on `[catalogId, pipeline, detail?.steps]` (pipeline is a stable module-registry ref). Derived content byte-identical.
5. **HolisticHealthView refetch (#10).** The auto-refresh effect depended on object/array store refs, so any unrelated store touch re-fired a full `/api/project-health` POST. Now keyed on a primitive `inputsSignature` = `JSON.stringify` of the exact POST body; the server result is a pure function of that body, so the POST fires iff the body changes (no missed/extra refetch; mount still fires).
6. **ue5-bridge live-state diffing (#13).** Every WS message rebuilt the propertyWatches object + replaced every store slice; the 1 Hz FPS counter wrote unconditionally. `setLiveState` now compares each slice and only rebuilds propertyWatches when the watch set genuinely changed; the FPS write fires only on change. Messages are a mix of full snapshots/deltas/property-updates — only genuine no-op writes are skipped, so per-field selector consumers still see correct values.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| Test suite | 15 fail / 3946 pass — identical to baseline (no regressions) |
| ESLint (changed files) | 0 errors (pre-existing warnings only: WSConnectionStatus, motion/AnimatePresence, a hardcoded hex — all on master) |

## Patterns established (catalogue, items 22–24)

22. **Derive-from-dep to satisfy the React Compiler** — when a memo needs a *stable identity* keyed on a signature but its body reads the unstable source, the React Compiler's `preserve-manual-memoization` rule rejects the deps/reads mismatch. Build the value FROM the signature (deps == what's read) rather than keying-on-signature-while-reading-source — and you also drop the eslint-disable.
23. **Stringified-body signature as an effect dep** — an effect that should "refetch when the request body changes" but depends on unstable object refs re-fires on every render. Depend on a primitive `JSON.stringify(body)` signature: it changes iff the body changes, and (when the server result is a pure function of the body) that's exactly when a refetch is warranted — no missed or extra fetch.
24. **Read the finding before restructuring rendered content** — "renders all entries ignoring pagination" can be correct-by-design (a whole-table preview/distribution). The fix for the re-render is to *memoize*, not to paginate and silently change what the user sees. When the intent is ambiguous, memoize-not-restructure is the behavior-preserving choice.

## Cumulative status (waves 1–6)

| Wave | Theme | Findings closed |
|---|---|---|
| 1 | Dead code purge + dormant-feature activation | 8 |
| 2 | DB N+1 / over-fetch (server-side) | 6 |
| 3 | Algorithmic hot loops | 7 (+#37 by deletion) |
| 4 | React re-renders (batch 1) | 6 (#3 reverted) |
| 5 | React re-renders (batch 2) | 6 |
| 6 | Resource leaks / lifecycle | 6 |

**Total closed: 39 / 176.** Remaining: ~137 (mostly mediums/lows + the correctness wave).

## What remains
- **Wave 7 (correctness + diverged-logic):** #14 triplicated damage formula, #45 blueprint exec-edge (wrong + O(n²)), #66 GDD shared-singleton corruption, duplicate regression alerts (#35). The highest-stakes remaining highs.
- **Deferred:** #3 inventory re-render (cardRefs-owner refactor); #12 follow-on (CLITabBar/CLIBottomPanel same coarse subscription); the `(module_id, completed_at DESC)` session_analytics index.
- ~120 mediums/lows across all themes, opportunistically.
