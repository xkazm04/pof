# Loot & Affix System — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

Prior-audit status check (2026-06-09): #1 (signed `>>` in XORShift32) is FIXED (`src/lib/seeded-rng.ts:32` now uses `>>>`). #2 (unvalidated `DropWeight`) is FIXED (`finiteNonNeg` boundary in `_shared/codegen.ts:29-32`). #3 (clipboard success theater, `LootTableEditor.tsx:128-135`) and #4 (economy median) are still open and remain KNOWN — not re-reported below.

## Bug findings (new since 2026-06-09)

## 1. Pagination Prev/Next operate on the unclamped stale `page` — dead clicks after deletions shrink the page count
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTablePagination.tsx:18`
- **Scenario**: Default table has 66 entries = 4 pages. User navigates to page 4 (`page = 3`), deletes 6 entries (totalPages drops to 3). `LootTableEditor.tsx:64` clamps only the *displayed* `safePage` (`Math.min(page, totalPages - 1)` → 2, shown as "Page 3 / 3") but never writes the clamp back to state. Clicking Prev runs `setPage(p => Math.max(0, p - 1))` → `page` goes 3 → 2, `safePage` stays 2 — the UI does not change. The button silently eats one click per unit of stale overshoot (more deletions = more dead clicks). Undo restoring a smaller snapshot triggers the same.
- **Root cause**: Clamping is done at render time for display only; the navigation callbacks close over the raw `page` state, so the visible page and the stored page diverge whenever `filteredEntries` shrinks outside the search/filter paths (delete, undo) which never call `setPage(0)`.
- **Impact**: Prev button appears broken (no-op clicks) right after a deletion session — silent, no error, user assumes pagination is buggy or the list is stuck.
- **Fix sketch**: Pass `safePage` as the navigation base: `onClick={() => setPage(Math.max(0, safePage - 1))}` / `setPage(Math.min(totalPages - 1, safePage + 1))`; or sync state eagerly in the editor (`if (page !== safePage) setPage(safePage)` via an effect, or reset page inside `removeEditorEntry`/`undoEditor`).

## 2. Auto-balancer conflates "degenerate lerp" (denom = 0) with "dropChance 0" — reports false reachable/unreachable verdicts
- **Severity**: Medium
- **Lens**: bug
- **Category**: logic-error
- **File**: `src/lib/loot/auto-balancer.ts:76`
- **Scenario**: A binding whose weights already sit entirely on the extreme rarity, e.g. an all-Common minion (`rarityWeights [100,0,0,0,0]`, `dropChance 0.5`, `bonusGold 10`, current EV ≈ `0.5·gold_Common + 10`). Designer asks `targetEV = 10` (below current → `extremeIdx = lo` = Common). Then `cw === extreme`, so `denom = E - A = 0` and execution falls into the `else` branch written for `dropChance === 0`: `reachable = Math.abs(g - targetEV) < 1` → `|10 - 10| < 1` → **true**, note says "Reweighting reaches the target — apply to retune" while `achievedEV` is unchanged and misses the target. Mirror case: an all-Legendary boss with `targetEV === currentEV` reports *unreachable* ("Target is beyond what reweighting alone can reach") even though `achievedEV === targetEV`.
- **Root cause**: `if (d > 0 && denom !== 0)` routes two unrelated degenerate cases into one fallback whose reachability test (`g ≈ targetEV`) is only valid when `dropChance` is 0; `denom === 0` simply means the lerp can't move EV from where it already is, where the correct test is `currentEV ≈ targetEV`.
- **Impact**: Wrong results from the headline goal-seek feature: success theater ("apply to retune" that does nothing) or a false "impossible" verdict steering designers to change dropChance/bonusGold unnecessarily.
- **Fix sketch**: Split the branches: when `denom === 0` (regardless of `d`), set `alpha = 0` and `reachable = Math.abs(currentEV - targetEV) <= 0.5` (rounding tolerance); keep the `g ≈ targetEV` test only for `d <= 0`. Add unit tests for already-at-extreme bindings in both directions.

## 3. Auto-balancer silently fabricates a distribution when `rarityWeights` is shorter than 5
- **Severity**: Low
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/loot/auto-balancer.ts:87`
- **Scenario**: A catalog entity's `data` passes `asLootBinding` (which accepts any array length — `economy.ts:26`) with e.g. 3 rarity weights; the linter explicitly anticipates this malformed shape (`economy.ts:104`). `solveWeightsForTargetEV` with `targetEV > currentEV` picks `extremeIdx = 4` (Legendary), but `blended = cw.map(...)` has length 3, so `extreme[4] = 100` is dropped entirely; blended sums to `100·(1-α)`, and `roundToSum100` (line 43-52) dumps the full `100·α` shortfall onto whichever of the 3 weights happens to be largest.
- **Root cause**: `blended` is built by mapping over `cw` (input length) while `extreme` is built over `RARITY_ORDER` (length 5); `roundToSum100` was designed to absorb ±1 rounding drift but is fed arbitrary mass deficits and conserves sum by distorting one component.
- **Impact**: Proposal weights are garbage (all surplus on a random mid rarity), yet `reachable` — computed from the full-length linear model — can still report true; a designer applying the proposal corrupts the binding's distribution.
- **Fix sketch**: Normalize the input to length `RARITY_ORDER.length` first (`const cw = toSum100(Array.from({length: 5}, (_, i) => binding.rarityWeights[i] ?? 0))`) so `blended` always spans all five rarities; optionally bail with `reachable: false` + note when the input shape is malformed.

## 4. `setEditorHistory` called inside `setEditorEntries` updaters — StrictMode double-invoke pushes duplicate undo snapshots
- **Severity**: Low
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:97`
- **Scenario**: In dev (this codebase runs React StrictMode — see StrictMode-safety comments in `useIsMounted.ts`, `useProjectScan.ts`), React intentionally double-invokes state updater functions. `addEditorEntry` (line 97-101) and `removeEditorEntry` (line 106-110) call `setEditorHistory(...)` *inside* the `setEditorEntries` updater, so each Add/Remove pushes two identical snapshots. The next Undo click pops to an identical state — visually a no-op — and every undo of an add/remove needs two presses. (`updateEditorWeight` self-heals only because its second invocation takes the coalesce path.)
- **Root cause**: Updater functions must be pure; queuing another state update from within one is a side effect that React is free to replay (StrictMode in dev, update rebasing under concurrent rendering in general).
- **Impact**: Undo appears broken in development (and is fragile under concurrent re-renders): one press does nothing after add/remove; history also burns its 50-slot cap twice as fast.
- **Fix sketch**: Hoist the side effect out of the updater: compute `next` from the current `editorEntries` (or use a reducer holding `{entries, history}` as one atom) and call `setEditorEntries(next)` + `setEditorHistory(h => capHistory([...h, next]))` as sibling top-level calls in the handler.

## 5. Slider-drag undo coalescing never ends — two separate drags of the same slider collapse into one undo step
- **Severity**: Low
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:84`
- **Scenario**: User drags entry X's weight 35 → 10, releases, inspects the preview bar, then drags the same slider 10 → 60. The first `onChange` of the second drag finds `lastWeightEditIdRef.current === X` (the ref is only cleared by add/remove/undo, never on pointer-up), takes the coalesce path, and `h.slice(0, -1)` discards the committed end-state of drag 1. Undo now jumps from 60 straight back to 35 — the intermediate value 10 is unrecoverable. Same with keyboard arrow-key adjustments minutes apart.
- **Root cause**: Coalescing is keyed only on "same entry id as the previous weight edit" with no drag-end boundary, so "one continuous drag = one undo step" silently extends to "all consecutive edits of the same slider ever = one undo step".
- **Impact**: Undo skips states the user deliberately settled on — loss of editing history granularity that defeats the purpose of per-action undo while tuning a single hot entry.
- **Fix sketch**: Reset `lastWeightEditIdRef.current = null` on the slider's `onPointerUp`/`onBlur` (pass an `onCommit` callback through `LootTableEntryList`), or coalesce on a short time window (e.g. clear the ref via a 500 ms timeout after the last tick).

## UI findings

## 6. Pagination chevron buttons are unlabeled icon-only controls with no hover/focus affordance
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTablePagination.tsx:17`
- **Scenario**: Screen-reader users tab onto the Prev/Next buttons and hear just "button" — no name. Mouse users get no hover feedback (other buttons in this panel use `hover:opacity-80`/`hover:bg-surface-hover`), and keyboard users get no visible focus ring (the entry list's remove button and sliders use the shared `focus-ring` class; these don't).
- **Root cause**: The buttons render bare `ChevronLeft/Right` icons without `aria-label`, and skip the module's established `focus-ring` + hover conventions.
- **Impact**: Pagination is effectively anonymous to assistive tech and feels inert to pointer/keyboard users — inconsistent with every neighboring control in the same editor.
- **Fix sketch**: Add `aria-label="Previous page"` / `aria-label="Next page"`, the `focus-ring` class, and a hover state (`hover:bg-surface-hover` or `hover:opacity-80 transition-colors`) matching the toolbar buttons.

## 7. Filter toggles (source, rarity, breadcrumb) convey active state by color alone — no `aria-pressed`/`aria-current`
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableSearchFilters.tsx:34`
- **Scenario**: The All/enemy/chest/quest/crafting source buttons, the rarity filter pills (`LootFilters.tsx:41`, inactive text at 50%-opacity tier color on a dark panel — borderline contrast), and the narrative breadcrumb steps (`NarrativeBreadcrumb.tsx:19`) all signal selection purely through border/background/text tint. A screen reader announces every option identically; low-vision users must discriminate subtle tint differences.
- **Root cause**: Toggle semantics are visual-only — the buttons carry no `aria-pressed` (filters) or `aria-current="step"` (breadcrumb), and no non-color cue (weight change exists only on the breadcrumb).
- **Impact**: Current filter state is invisible to assistive tech across the whole sub-module; users can't tell which subset of the loot table they are editing.
- **Fix sketch**: Add `aria-pressed={isActive}` to all filter buttons and `aria-current="step"` to the active breadcrumb item; wrap the breadcrumb in `<nav aria-label="Loot workflow">`. Raise inactive rarity-pill text from `OPACITY_50` to a contrast-safe value or pair with a border-weight change.

## 8. Search input and enemy-source select have no programmatic labels
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableSearchFilters.tsx:25`
- **Scenario**: The editor's search field is identified only by its placeholder ("Search items..."), which vanishes once the user types and is unreliably exposed to screen readers. The "Enemy Source" `<select>` in `LootFilters.tsx:63` has a visual heading that is not associated with the control, so it announces as an unnamed combobox.
- **Root cause**: Placeholder-as-label anti-pattern, plus a decorative header `<span>` instead of a `<label htmlFor>`/`aria-label` association. Contrast with `LootTableEntryList.tsx:41`, where sliders correctly get `aria-label` — the convention exists but isn't applied here.
- **Impact**: Assistive-tech users land on anonymous form controls and must guess their purpose; the module is internally inconsistent about labeling.
- **Fix sketch**: Add `aria-label="Search loot entries"` to the input and `aria-label="Filter by enemy source"` (or convert the heading span to a `<label htmlFor>`) on the select.

## 9. The "2xs mono pill button" is hand-rolled ten-plus times with drifting hover/disabled treatments — extract a shared component
- **Severity**: Low
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableEditorToolbar.tsx:45`
- **Scenario**: The same `text-2xs font-mono px-2 py-0.5 rounded border transition-all cursor-pointer` + `withOpacity(color, OPACITY_30)` border + colored text pattern is repeated for Import/Re-export/Undo/+Add/Export JSON (toolbar), JSON/C++/Copy (`LootTableReExportPanel.tsx:38-43`), Pool (`AffixRollSimulator.tsx:165`), and the source filters. They already disagree: toolbar buttons have `hover:opacity-80`, the re-export tabs and source filters have `transition-all` but no hover effect at all; disabled opacity is 0.4 here, 0.5 on Spin.
- **Root cause**: No shared `PillButton`/`ToolbarButton` primitive in `_shared/design` despite the panel/header primitives existing there, so each author re-types the recipe and drifts.
- **Impact**: Visible micro-inconsistency (some buttons respond to hover, others feel dead) and a multiplied cost for fixes like findings 6-7 (each a11y/hover fix must be applied N times).
- **Fix sketch**: Add `PillButton({ color, active, disabled, icon, children, ...aria })` to `sub_loot/_shared/design.tsx` encapsulating border/text/hover/focus-ring/disabled styling; migrate the toolbar, re-export tabs, pool button, and filter pills to it.

## 10. Empty entry list always blames "your search" — misleading when the table is actually empty
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_loot/affix/LootTableEntryList.tsx:76`
- **Scenario**: A user deletes every entry (or imports a table then removes all rows) with no search text and no source filter — the list shows "No items match your search." The user looks for a search box to clear instead of realizing the table is empty; the live preview bar and pagination also vanish simultaneously with no explanation.
- **Root cause**: A single hard-coded empty-state string for two distinct states (filtered-to-zero vs genuinely-empty); the component receives `filteredEntries` but not whether a query/filter is active.
- **Impact**: Misleading guidance at exactly the moment the user needs a recovery path (re-add or re-import entries).
- **Fix sketch**: Pass `hasActiveFilter` (search non-empty or source !== 'all') into `LootTableEntryList`; show "No items match your search/filter." when true, otherwise "Table is empty — use + Add or Import UE5 to populate it." optionally with an inline Add button.
