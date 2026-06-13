# Inventory System — zen-perf scan
> Context: Items, Loot & Economy / Inventory System
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. TradingCard is unmemoized and receives fresh closures every render — whole grid re-animates on each keystroke
- **Severity**: high
- **Lens**: performance
- **Category**: re-render / memoization
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogItemGrid.tsx:40 (also TradingCard.tsx:45)
- **Scenario**: Typing in the search box, hovering one card, or paging. `searchQuery`/`focusedIndex`/`selectedItem` live on the parent `CatalogGearTab`; any change re-renders `CatalogItemGrid`, which re-renders all 20 `TradingCard`s on the page.
- **Root cause**: `TradingCard` is a bare `forwardRef` with no `React.memo`, and even if memoized it would still re-render because the grid hands each card brand-new inline callbacks/refs every render: `onClick={() => setSelectedItem(...)}` (line 40), `ref={(el) => { cardRefs.current[index] = el; }}` (line 41), `onFocus={() => setFocusedIndex(index)}` (line 42). Each `TradingCard` is heavy — `framer-motion` `layout` + spring + per-stat map + set-membership lookup + tooltip subtree.
- **Impact**: On every search keystroke the whole visible page (20 motion cards) re-evaluates and the `layout` animation engine re-measures, producing visible jank/typing lag; cost scales with `ITEMS_PER_PAGE`.
- **Effort**: 4 · **Value**: 8
- **Fix sketch**: Wrap `TradingCard` in `React.memo`. Stop passing `index`-bound closures: give the card a stable `onSelect(item)`/`onFocusItem(id)` (the parent derives index), or memoize a per-row handler. Set the ref via a stable callback factory keyed by id instead of an inline arrow that changes identity each render. Consider dropping `layout` on cards or gating it behind reduced-motion.

## 2. Grid keyboard navigation forces a synchronous layout reflow on every arrow press
- **Severity**: medium
- **Lens**: performance
- **Category**: forced reflow / DOM read in hot path
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:101
- **Scenario**: Holding/repeating an arrow key to move focus through the grid.
- **Root cause**: `getColumnCount()` calls `window.getComputedStyle(gridRef.current).gridTemplateColumns` on every `ArrowDown`/`ArrowUp` (used inside `handleGridKeyDown`, line 110). Reading computed style is a synchronous style/layout flush, executed mid-keydown alongside a `setFocusedIndex` + `.focus()` that themselves trigger the motion `layout` machinery.
- **Impact**: Each vertical-navigation keypress pays a forced reflow + focus-driven scroll; combined with finding #1's unmemoized cards this compounds into stutter during keyboard browsing.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Derive column count from the known responsive breakpoints (`grid-cols-1 / md:2 / xl:4`) via a `matchMedia`/`ResizeObserver` value cached in state, or read it once per resize rather than per keypress. Avoid `getComputedStyle` in the keydown handler.

## 3. Grid uses two sources of truth — static `DUMMY_ITEMS` for content, store `entries` only for lifecycle
- **Severity**: high
- **Lens**: architecture
- **Category**: dual source of truth / coupling
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:44
- **Scenario**: Any future "add/edit/delete item" or generated-image flow. The "Add Item" button fires a CLI prompt (handleCreateItem, line 124) but the new item never enters the rendered list, because the list is the frozen module constant `DUMMY_ITEMS`.
- **Root cause**: `items = DUMMY_ITEMS` (line 50) drives filtering/sorting/paging, while `useItemEntries()` (line 44) is pulled only to graft `lifecycle`/`ueAssets` back on by id via `entryByItemId` (line 45). The inline comment admits the split ("the static DUMMY_ITEMS array still drives the rich UI"). Two parallel item models (`ItemData` vs `ItemEntry`) joined by string id every render.
- **Impact**: Catalog cannot actually reflect store mutations; the join map is rebuilt whenever store entries change; the "Add Item" affordance is effectively dead with respect to the grid. New contributors must reconcile two item shapes.
- **Effort**: 6 · **Value**: 7
- **Fix sketch**: Make the store the single catalog source: seed the store from `DUMMY_ITEMS` once, render from `entries` (each `ItemEntry` carrying `data: ItemData` + lifecycle), and delete the runtime id-join Map. Filtering/sorting then operates directly on store entries.

## 4. `primaryEntry` uses `entries[0]!` non-null assertion — empty store crashes the tab
- **Severity**: medium
- **Lens**: architecture
- **Category**: unsafe assumption / robustness
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:83
- **Scenario**: First render before the items catalog is seeded, after a store reset, or if the `items` catalog key is ever empty.
- **Root cause**: `const primaryEntry = (primaryItem && entryByItemId.get(primaryItem.id)) ?? entries[0]!` asserts `entries[0]` is defined. `useItemEntries` returns `Object.values(... ?? {})`, which is legitimately `[]` when nothing is seeded, so `primaryEntry` becomes `undefined` despite the `!`, and it is then passed into `useGeneration(primaryEntry)` and dereferenced (`primaryEntry?.lifecycle`).
- **Impact**: A `!` that lies — `useGeneration` may receive `undefined`, and downstream code that trusts the non-null type can throw. Latent crash gated only on store population order.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Drop the `!`; type `primaryEntry` as `ItemEntry | undefined`, guard the regenerate button / `useGeneration` on its presence, and disable the (Re)generate affordance when there is no backing entry.

## 5. `CatalogGearTab` is a god-component mixing filter/sort/paginate/keyboard/CLI concerns
- **Severity**: low
- **Lens**: architecture
- **Category**: SRP / oversized component
- **File**: src/components/modules/core-engine/sub_inventory/catalog/CatalogGearTab.tsx:28
- **Scenario**: Maintaining or reusing the catalog filtering elsewhere (e.g. another catalog tab needs the same search/sort/paginate behavior).
- **Root cause**: One 195-line component owns 9 `useState` hooks plus the entire `filteredItems` filter+sort `useMemo` (lines 56-76), pagination math (78-79), the focus-reset-on-filter-change pattern (94-99), keyboard grid navigation (101-122), and AI item-creation prompt assembly (124-132). Filtering and CLI prompt construction are unrelated responsibilities living in the same file.
- **Impact**: Hard to test or reuse the (genuinely useful) filter/sort/paginate logic; high cognitive load; the prompt string (line 128) is buried in the component.
- **Effort**: 4 · **Value**: 4
- **Fix sketch**: Extract a `useCatalogFilters(items)` hook returning `{ filteredItems, pageItems, totalPages, currentPage, setters }`, and move `handleCreateItem`'s prompt building into a small `buildCreateItemPrompt(newItem)` helper. The component then just wires hooks to the already-split presentational children (`CatalogFiltersBar`, `CatalogItemGrid`, `CatalogPagination`).
