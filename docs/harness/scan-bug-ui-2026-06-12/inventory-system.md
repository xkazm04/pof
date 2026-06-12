# Inventory System — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Selecting another item card mid-generation fires a premature/false completion and orphans the real one
- **Severity**: High
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:82-84`
- **Scenario**: User clicks "(Re)generate" on the primary item A (CLI session `gen-A` starts running), then clicks any other card B while it runs. `primaryItem` becomes B, so the single `useGeneration(primaryEntry)` hook re-subscribes its `sessionKey` from `gen-A` to `gen-B`.
- **Root cause**: `useModuleCLI` (src/hooks/useModuleCLI.ts:82-114) detects completion as a running→stopped transition of *whatever sessionKey it is currently subscribed to*. On the switch, `prevRunningRef=true` (from gen-A) meets `isRunning=false` (gen-B has never run) — the hook treats this as a completion: it records a session-analytics outcome with `success=false` (gen-B has no `lastTaskSuccess`) using A's prompt and a bogus duration, and fires `onComplete` prematurely (refetching `/api/catalog` before A's lifecycle transition is persisted). When `gen-A` actually finishes, no hook is subscribed to it, so the post-completion refetch never happens.
- **Impact**: silent failure + data corruption — a false "failed task" analytics record is written for a run that's still in progress; item A's lifecycle cell stays stale (still `planned`/`generated`) after a successful generation until a full reload; A's busy indicator also vanishes the moment B is selected, so the user may dispatch overlapping runs.
- **Fix sketch**: Make completion detection per-session instead of per-hook-instance: reset `prevRunningRef` whenever `opts.sessionKey` changes (skip the transition fire on key switch), and/or register the `onComplete` callback in the CLI panel store keyed by tabId at `execute()` time. Alternatively move `useGeneration` into `CatalogLifecycleCell` so each entity owns its own hook for the lifetime of its run.

## 2. AffixSunburst outer-ring labels index the wrong arcs — "2 Prefixes" is unlabeled and a grandchild label renders in its place
- **Severity**: Medium
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/AffixSunburst.tsx:118`
- **Scenario**: Open Mechanics & Scaling, look at the affix probability sunburst fed by `AFFIX_PROB_TREE` (3 children, two of which have 4 grandchildren each). The third ring-1 label reads "Power" — a ring-2 grandchild — drawn at the ring-2 radius, while the "2 Prefixes" segment has no label at all.
- **Root cause**: Labels are taken as `arcs.filter((_, i) => i < tree.children.length)`, assuming the first N arcs are the ring-1 arcs. But the `arcs` array is built interleaved (each child's ring-1 arc is immediately followed by its grandchildren's ring-2 arcs, lines 46-75), so for the real data the first 3 arcs are `[0 Prefixes, 1 Prefix, Power(gc)]` — index slicing grabs the wrong arc as soon as any child has children.
- **Impact**: wrong results in a designer-facing chart — segments are mislabeled/unlabeled, so the probability breakdown the chart communicates is incorrect.
- **Fix sketch**: Tag arcs at build time (`ring: 1 | 2`) and render labels from `arcs.filter(a => a.ring === 1)`, or collect ring-1 label entries into a separate array while building.

## 3. "Sort: Power" orders the grid by a different power formula than the PWR badge shown on every card
- **Severity**: Low
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:69-73`
- **Scenario**: User picks "Sort: Power" in the catalog. With the shipped seed data, Ranger's Bow (badge PWR 90) sorts above Assassin's Cowl (badge PWR 95) — the visible PWR numbers come out non-monotonic.
- **Root cause**: The sort comparator sums only `stats.numericValue`, while the card badge uses `computePower` (TradingCard.tsx:24-26) which adds `affixes.length * 10`. Two power formulas drifted apart; any item whose raw stat sum is lower but affix count higher than a neighbor's inverts the displayed order (Cowl: 65 stats + 3 affixes = 95 vs Bow: 80 stats + 1 affix = 90).
- **Impact**: wrong results — a sorted list that visibly contradicts the number printed on each card, undermining trust in the catalog's data displays.
- **Fix sketch**: Export `computePower` from TradingCard (or move it to `_shared/data.ts`) and use it in the `sortBy === 'power'` branch so the comparator and the badge share one formula.

## 4. Comparison panel allows the same item in two of three slots — duplicate React keys and a self-comparison
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel.tsx:33`
- **Scenario**: User adds a third slot, then selects item X in slot A, item Y in slot B, and item X again in slot C. `canCompare` passes (the distinct-id set is `{X, Y}`, size 2) and the comparison renders with `selectedItems = [X, Y, X]`.
- **Root cause**: The distinct-id guard only ensures *at least two* distinct selections, and the slot `<select>`s never exclude already-chosen ids. All three render `.map()`s key columns by `key={item.id}` (lines 124, 184), so the duplicate item produces colliding React keys.
- **Impact**: React duplicate-key warnings with potential mis-rendering on column add/remove, plus a nonsense comparison column (an item tied against itself skews `isBest`/win counts, usually suppressing the winner crown).
- **Fix sketch**: Filter each slot's options to exclude ids picked in other slots (or dedupe `selectedItems`), and key the column grids by slot index (`key={`${idx}-${item.id}`}`) so keys stay unique regardless.

## UI findings

## 5. Keyboard users can navigate the item grid but cannot open the item detail drawer
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/CatalogItemGrid.tsx:40`
- **Scenario**: Arrow-key roving focus across cards works nicely, but pressing Enter or Space on a focused card only toggles the hover tooltip (TradingCard.tsx:59-62, with `stopPropagation`). Selection — which opens the ItemDetailDrawer and re-targets the (Re)generate button — happens only via `onClick` on a plain wrapper `<div>`, which never fires from the keyboard. The `role="grid"` also contains `role="gridcell"` elements with no `role="row"` wrappers, so AT announces a malformed grid.
- **Root cause**: The activation behavior lives on a non-semantic mouse-only wrapper while the focusable element consumes Enter/Space for a secondary affordance (tooltip); grid ARIA structure is incomplete.
- **Impact**: A primary interaction (inspect item details) is unreachable without a mouse — a WCAG 2.1.1 failure on the catalog's main surface; grid semantics confuse screen readers.
- **Fix sketch**: Pass an `onActivate` prop into TradingCard and trigger selection on Enter (keep Space or a long-press for the tooltip); wrap cards in `role="row"` containers (or simplify to `role="list"`/`listitem` since per-cell 2D semantics aren't needed).

## 6. Equipment loadout paper-doll slots are mouse-only
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/EquipmentLoadoutSection.tsx:127-137`
- **Scenario**: The section's own copy says "Click any slot to equip items" — each slot is a `motion.div` with `onClick` only: no `tabIndex`, no `role="button"`, no key handler, and the equipped-item info is exposed only via a `title` tooltip.
- **Root cause**: Interactive elements built from divs; no keyboard or AT affordance was added when the picker flow was wired up.
- **Impact**: The entire loadout/equip flow (and the ScalableSelector behind it) is unreachable by keyboard and invisible to screen readers; hover-only `title` also leaves touch users without item details.
- **Fix sketch**: Render each slot as a `<button>` (motion supports `motion.button`) with `aria-label={slot.item ? `${slot.slotName}: ${slot.item.name} (${slot.item.rarity})` : `${slot.slotName}, empty — equip`}`; focus styles can reuse `focusRingStyle(ACCENT)` like the filter bar.

## 7. Filter and form controls have no accessible names
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/CatalogFiltersBar.tsx:45-70`
- **Scenario**: The toolbar's four `<select>`s (type, slot, rarity, sort) have no `aria-label` or associated `<label>` — a screen reader announces "combobox, All Types" with no hint of what is being filtered. Same for AddItemForm's name input, type/rarity selects, and description textarea (AddItemForm.tsx:29-43), which rely solely on placeholders/values.
- **Root cause**: Visual compactness (no visible labels) without compensating `aria-label`s; placeholders disappear once a value is set and are not reliable names.
- **Impact**: Non-visual users can't tell the rarity filter from the sort order or the type select from the rarity select; form intent in AddItemForm is guesswork.
- **Fix sketch**: Add `aria-label="Filter by type" / "Filter by slot" / "Filter by rarity" / "Sort items"` (and `aria-label`s on the AddItemForm fields). The toolbar already has `role="toolbar" aria-label="Item filters"` — extend the same care to its children.

## 8. Affix-table collapse button suppresses the focus outline and hides its expanded state
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/AffixSlotPanels.tsx:27-28`
- **Scenario**: Tabbing to the "Affix System Definitions" disclosure shows no focus indicator at all (`focus:outline-none` with no replacement), and a keyboard/AT user gets no `aria-expanded` cue that the table opened — the only signal is the animated chevron.
- **Root cause**: Outline removed without a `focus-visible` substitute; the sibling inventory components consistently use `focusRingStyle(ACCENT)` / `.focus-ring-inset`, so this button is a one-off deviation from the established pattern.
- **Impact**: Keyboard users lose their place on this panel; disclosure state is invisible to screen readers — inconsistent with the rest of the tab's focus treatment.
- **Fix sketch**: Replace `focus:outline-none` with the shared focus-ring utility (or `focus-visible:outline`), and add `aria-expanded={affixOpen}` (plus `aria-controls` on the table region).

## 9. Select/input pill styling is copy-pasted across three files and has already drifted
- **Severity**: Low
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/sub_inventory/catalog/CatalogFiltersBar.tsx:50`
- **Scenario**: The class string `text-sm font-mono px-3 py-2 rounded-lg bg-surface-deep border border-border/40 …` is repeated on 4 selects in CatalogFiltersBar, 3 fields in AddItemForm, and the comparison selects (ItemComparisonPanel.tsx:95) — and AddItemForm already drifted to `border-border/50` and drops `font-mono`, so adjacent dropdowns render with subtly different borders and typography.
- **Root cause**: No shared `<CatalogSelect>`/`<CatalogInput>` primitive; each new control re-types the pill recipe by hand.
- **Impact**: Visible inconsistency between the filter bar and the add-item form (border weight, font), and every future control multiplies the drift; also a natural home for the missing `aria-label` plumbing from finding 7.
- **Fix sketch**: Extract a small `FieldShell`/`CatalogSelect` component (className + accent + required `aria-label` prop) under `sub_inventory/_shared/` and swap the nine call sites onto it.
