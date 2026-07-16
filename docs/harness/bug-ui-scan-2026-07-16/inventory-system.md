# Inventory System — Bug + UI Scan

> Total: 10

## Bug findings

### 1. "Create with AI Image" has no re-entrancy guard, letting two clicks fork the same item slug into diverging assets
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:153
- **Scenario**: User double-clicks (or hits Enter twice) on "Create with AI Image" before React re-renders the disabled state driven by `isCliRunning`. `handleCreateItem` itself never checks `isCliRunning` — only the button's `disabled` prop does, and that prop lags one render behind the zustand-backed `useModuleCLI` state.
- **Root cause**: `handleCreateItem` (CatalogGearTab.tsx:153-184) unconditionally calls `addEntity('items', …)` and `executeCli(…)` with a fixed `sessionKey: 'item-gen'`. Nothing inside the callback itself is gated on `isCliRunning`; the gate lives only in the disabled attribute of a separate component (AddItemForm.tsx:44), which updates asynchronously.
- **Impact**: Two catalog entries get created from the same click burst, both racing the same `item-gen` CLI session and both targeting `/items/<slug>.webp` derived from the same name. The second generation run silently overwrites the first item's icon path, so one of the two items ends up with a mismatched or missing image with no error surfaced to the user — success theater.
- **Fix sketch**: Check `isCliRunning` at the top of `handleCreateItem` and return early (or disable via a local `isSubmitting` ref that flips synchronously before the async state catches up); also derive the image slug/session key from the new item's generated id, not just the name, to avoid collisions.

### 2. Selected item detail drawer is never invalidated when its backing entry disappears
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:53
- **Scenario**: Open an item's detail drawer, then have the underlying `ItemEntry` removed from the catalog store (e.g. via a reset/delete action elsewhere, or a persisted-store re-seed) while the drawer is open.
- **Root cause**: `selectedItem` (CatalogGearTab.tsx:53) is a snapshot `ItemData` captured at click time (CatalogItemGrid.tsx:42) and is only ever cleared by the drawer's own `onClose` or by re-clicking the same card. There is no effect reconciling `selectedItem` against the live `entries` list, unlike `primaryEntry`, which does self-heal via its `?? pageEntries[0] ?? entries[0]` fallback.
- **Impact**: The drawer keeps showing a "ghost" item that no longer exists in the store — stale name/stats/rarity — with no indication to the user that the underlying data is gone.
- **Fix sketch**: Add an effect that clears `selectedItem` (or re-derives it from `entries` by id each render) whenever the matching entry is no longer present in `entries`.

### 3. Affix sunburst arc math has no bounds/normalization on child probabilities
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_inventory/catalog/AffixSunburst.tsx:46
- **Scenario**: Any `ProbabilityEntry` tree fed to `AffixSunburst` whose sibling `probability` values sum to more than 1 (a plausible authoring mistake upstream, since nothing enforces the invariant at this component's boundary).
- **Root cause**: `cumAngle` accumulates `child.probability * 2 * Math.PI` (AffixSunburst.tsx:47-74) with no clamp/normalization step; the same applies to grandchildren against their parent's `angle`. The component trusts the data is a valid probability partition.
- **Impact**: Arcs silently overlap or overshoot a full circle, producing a visually corrupted/overlapping sunburst with no warning — a data-entry bug upstream becomes an inscrutable rendering bug here.
- **Fix sketch**: Normalize each sibling group's probabilities to sum to 1 before computing angles (or clamp `cumAngle` and log/flag when the raw sum deviates from 1 beyond a small epsilon).

### 4. Equipping an item via the loadout picker silently drops any non-numeric stat
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_inventory/catalog/EquipmentLoadoutSection.tsx:93
- **Scenario**: Equip an item whose `stats` array contains a descriptive/non-numeric entry (e.g. a proc effect or flavor stat with no `numericValue`) via the paper-doll picker.
- **Root cause**: `handleSelect` (EquipmentLoadoutSection.tsx:90-103) builds the loadout item's `stats` record with `if (s.numericValue != null) stats[s.label] = s.numericValue;` (line 95), unconditionally skipping any stat lacking a numeric value.
- **Impact**: `StatContributions` (and any future consumer of the equipped item's stats) never sees the dropped stat — the equipped item silently appears weaker/less-informative than the catalog entry it came from, with no indication the data was truncated.
- **Fix sketch**: Preserve non-numeric stats in a separate display-only field, or surface a visible note ("+N non-numeric effects not shown") rather than dropping them outright.

### 5. Sort-order changes leave the current page index untouched
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogFiltersBar.tsx:64
- **Scenario**: Filter down to a few pages, page to page 3, then change "Sort: …" (name/power/rarity/type).
- **Root cause**: Every other filter control (`search`, `category`, `subtype`, `rarity`) explicitly calls `resetPage()` on change; the sort `<select>` (CatalogFiltersBar.tsx:64-70) does not, unlike its siblings.
- **Impact**: The item set is completely re-ordered but the page index is preserved, so the user is silently shown a different slice of items than before with no visual cue that "page 3" now means something else post-sort — easy to misread as data having changed unexpectedly.
- **Fix sketch**: Call `resetPage()` in the sort `onChange` handler for consistency with the other filter controls.

## UI findings

### 6. Equipment paper-doll slots are mouse-only — no keyboard path to equip gear
- **Severity**: High
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_inventory/catalog/EquipmentLoadoutSection.tsx:127
- **Scenario**: A keyboard-only user tries to open the item picker for the "Head" or "Main Hand" slot.
- **Root cause**: Each slot is a `motion.div` with `onClick={() => setPickerSlot(slot.slotId)}` (EquipmentLoadoutSection.tsx:127-138) but no `role="button"`, `tabIndex`, or `onKeyDown` handler — it is not in the tab order and has no keyboard-activatable semantics.
- **Impact**: The primary equip interaction of the whole loadout visualizer is entirely unreachable without a mouse/touch pointer, a significant accessibility gap for a core authoring surface.
- **Fix sketch**: Add `role="button"`, `tabIndex={0}`, a visible focus ring, and an `onKeyDown` handler that opens the picker on Enter/Space (or swap the div for a native `<button>`).

### 7. Filter selects have no accessible name beyond their current value
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogFiltersBar.tsx:49
- **Scenario**: A screen-reader user tabs through the filters toolbar.
- **Root cause**: The parent `div` carries `role="toolbar" aria-label="Item filters"` (line 42), but the individual `<select>` elements for category/subtype/rarity/sort (lines 49-70) have no `aria-label`/`<label>` of their own — a screen reader announces only "combobox, All Types" with no indication of which filter dimension it controls once focus lands inside the toolbar.
- **Impact**: Non-visual users cannot reliably tell category, subtype, rarity, and sort selects apart without reading every option.
- **Fix sketch**: Add `aria-label="Item type filter"`, `"Slot filter"`, `"Rarity filter"`, `"Sort order"` to the respective selects.

### 8. Sunburst tooltips are hover-only and can render outside the visible canvas
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_inventory/catalog/AffixSunburst.tsx:87
- **Scenario**: Hover an outer-ring arc near the left/right/top/bottom edge of a small-`size` sunburst; or try to inspect any arc's tooltip on a touch device.
- **Root cause**: Tooltip visibility is driven purely by `onMouseEnter`/`onMouseLeave` (lines 87-89) with no focus/touch equivalent, and the tooltip rect position (`tx - 50`, `ty - 18`, lines 108-110) is placed at the arc midpoint with no clamping against the SVG's `0 0 size size` viewBox — the parent `svg` is `overflow-visible` (line 78), so an edge arc's tooltip can spill outside the component's bounding box and get clipped by ancestor containers or overlap adjacent UI.
- **Impact**: Touch and keyboard users get zero access to per-affix probability labels; even mouse users can lose part of the label at the canvas edges.
- **Fix sketch**: Add `onFocus`/`onBlur` (with `tabIndex={0}` + `role="img"`/`aria-label` per arc) as a touch/keyboard-reachable alternative, and clamp the tooltip's `tx`/`ty` to stay within `[0, size]` before drawing the rect.

### 9. Comparison slot selects allow picking the same item twice with no proactive prevention
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_inventory/catalog/ItemComparisonPanel.tsx:94
- **Scenario**: In the 2-3 item comparator, pick the same item in Slot A and Slot B.
- **Root cause**: Each slot's `<select>` (lines 94-98) renders the full unfiltered `pool` regardless of what's already chosen in the other slots; the only guard is the downstream `canCompare` check (`new Set(slotIds.filter(Boolean)).size >= 2`, line 33) which just refuses to render the comparison body.
- **Impact**: The user sees a generic "Pick two or three different items to start comparing" message (line 204-206) with no indication of *why* — that they've picked a duplicate — leading to confusion about what's wrong.
- **Fix sketch**: Either disable/gray-out already-selected items in each sibling select's option list, or show a targeted inline warning ("Slots A and B have the same item") when a duplicate is detected.

### 10. Pagination doesn't restore scroll position, leaving the user stranded below the refreshed grid
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogPagination.tsx:14
- **Scenario**: Scroll down to the pagination controls at the bottom of a long filtered list, click "Next".
- **Root cause**: `CatalogPagination`'s Prev/Next handlers (lines 14-18) only update `currentPage` state; nothing scrolls the grid or viewport back into view, and the grid itself (`CatalogGearTab.tsx`) has no effect tied to page changes to do so either.
- **Impact**: After paging, the newly-rendered items sit off-screen above the user's current scroll position (still anchored near the pagination bar), so the page change is invisible until the user manually scrolls up — a common but avoidable papercut given the grid can run to 20 items/page.
- **Fix sketch**: On page change, scroll the grid container (or `window`) to the top of the grid, e.g. via the existing `gridRef` in `CatalogGearTab`.
