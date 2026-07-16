# Loot & Affix System — Bug + UI Scan

> Total: 10

## Bug findings

### 1. Timestamp-based IDs collide on rapid clicks, cross-contaminating entries
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:109
- **Scenario**: User double-clicks "+ Add" fast (or clicks it twice within the same millisecond, easy on a fast machine / with any kind of programmatic click, e.g. a script or accessibility switch device) — both new entries get `id = \`e${Date.now()}\`` with the identical timestamp.
- **Root cause**: `addEditorEntry` derives the entry id solely from `Date.now()`, which has 1ms resolution; nothing guarantees uniqueness within a render burst.
- **Impact**: Two rows render with the same React `key` (console warning + potential DOM reuse glitches), and because `updateEditorWeight`/`removeEditorEntry` match by `id`, dragging one entry's weight slider or clicking its trash button silently mutates/deletes *both* "duplicate" entries at once — a subtle data-corruption bug in the exact table the designer is trying to balance.
- **Fix sketch**: Use a monotonic counter or `crypto.randomUUID()` for new entry ids instead of `Date.now()`.

### 2. UE5 import silently discards true loot source, mislabeling every entry as "enemy"
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_loot/affix/useLootTableImport.ts:36
- **Scenario**: Designer imports a UE5-exported loot table JSON that actually contains a mix of chest, quest, and crafting entries.
- **Root cause**: `handleImportFile` hardcodes `source: 'enemy' as LootSource` for every parsed entry regardless of what the UE5 export actually represents — there is no source field in `parseUE5LootTable`'s output being read/mapped.
- **Impact**: The source filter and grouped headers in `LootTableEntryList` now show a table that is 100% "Enemy Drops," silently losing/misrepresenting real economy data with no error or warning shown to the user (success theater: import reports success and shows `UE5: {file}` as if everything came through intact).
- **Fix sketch**: Either surface source on import (map from the JSON schema if present) or default it but flag it clearly (e.g. an inline warning "source defaulted to Enemy — reassign manually") instead of presenting it as a clean import.

### 3. Side-effectful state updater risks doubled/misaligned undo history
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:93-106
- **Scenario**: In React 18 Strict Mode (dev) or any future concurrent-rendering path, `setEditorEntries`'s updater function is invoked more than once per commit to detect impurities.
- **Root cause**: `updateEditorWeight` (and `addEditorEntry`/`removeEditorEntry`) call `setEditorHistory(...)` *inside* the `setEditorEntries` updater callback — a state updater is supposed to be a pure function of its previous state, but here it has a side effect that pushes/coalesces a second piece of state.
- **Impact**: A double-invoked updater double-fires the history push, breaking the deliberate "coalesce continuous drag into one undo step" logic and potentially leaving `editorHistory` out of sync with `editorEntries` (e.g. Undo requiring two clicks to see any visible change, or reverting to an intermediate drag frame instead of the pre-drag state).
- **Fix sketch**: Compute `next` inside the `setEditorEntries` updater only, then call `setEditorHistory` from the *outer* callback body (after `setEditorEntries`) using the already-known `next`/`coalesce` values, not nested inside the updater.

### 4. Drop-rate preview bar omits "nothing" weight, misrepresenting true drop odds
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:55-63,201-207
- **Scenario**: Designer sets `nothingWeight` to a large value (e.g. equal to total item weight, meaning a real 50% chance of no drop) while balancing a table.
- **Root cause**: `previewSegments` computes each entry's `pct` as `entry.weight / editorTotalWeight * 100`, where `editorTotalWeight` sums only item weights and never includes `nothingWeight`. The rendered segments therefore always fill the bar to 100% width.
- **Impact**: The live preview — the exact tool meant to let a designer "simulate drop rates" — visually implies every roll guarantees an item drop, hiding the no-drop chance shown only in a separate text line above. This can lead to badly tuned drop tables shipped to UE5 via the re-export feature.
- **Fix sketch**: Include `nothingWeight` as its own (e.g. gray/neutral) segment in `previewSegments`, sized against `editorTotalWeight + nothingWeight`, matching the percentage already computed for the `nothingWeight > 0` banner.

### 5. Clipboard copy reports success even when the write silently fails
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditor.tsx:142-149
- **Scenario**: User clicks "Copy" in the UE5 re-export panel on an insecure origin, in a browser without clipboard permission granted, or when a permissions-policy blocks `navigator.clipboard`.
- **Root cause**: `handleCopyReExport` calls `navigator.clipboard.writeText(text)` without awaiting/catching the returned promise, then unconditionally sets `copiedReExport` to `true`.
- **Impact**: The UI shows the "Copied" checkmark/label regardless of whether the text actually reached the clipboard — a classic caught-and-forgotten (here: not even caught) silent failure that leaves the designer pasting nothing into their UE5 project and not realizing why.
- **Fix sketch**: `await navigator.clipboard.writeText(text).catch(...)`, only flipping `copiedReExport` to true on success, and surfacing a brief error state on rejection.

## UI findings

### 6. Loot entry rows have no responsive/mobile layout, unlike sibling filter panels
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEntryList.tsx:30-64
- **Scenario**: Open the Affix tab on a narrow viewport (phone width or a docked side panel).
- **Root cause**: Each entry row is a single non-wrapping `flex` row combining a fixed `w-28` name, a `flex-1` range slider, a fixed `w-14` weight readout, a fixed `w-20` share readout, and a trash button, with no `sm:`/`flex-col` fallback — unlike `LootFilters.tsx`, which explicitly does `flex-col sm:flex-row` for the same module.
- **Impact**: On narrow widths the slider is squeezed to near-zero usable width (hard to drag precisely) and/or the row overflows horizontally, breaking the "simulate drop rates" workflow specifically on the devices where designers are most likely to do a quick check.
- **Fix sketch**: Stack weight/share/remove into a second line below the name+slider under a `sm:` breakpoint, mirroring the responsive pattern already used in `LootFilters`.

### 7. Sticky source-group header has no scrolling ancestor, so it can't behave as intended
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEntryList.tsx:26
- **Scenario**: The "Enemy Drops (N)" / "Chest / Container (N)" group label is styled `sticky top-0 ... backdrop-blur-sm`, presumably so it stays visible while scrolling a long grouped list.
- **Root cause**: Neither `LootTableEditor`'s `BlueprintPanel` wrapper nor any ancestor establishes an `overflow-y: auto` scroll container around the entry list (the whole page scrolls instead), so `sticky` resolves against the page/viewport, not a local list container.
- **Impact**: Best case the sticky rule is a dead no-op (it never has room to "stick" before the group ends); worst case, on some browsers/zoom levels it sticks to the true top of the viewport and overlaps the app's own header/nav chrome as the page scrolls — an unintended overlay bug rather than the "always-visible group label" the code clearly intends.
- **Fix sketch**: Wrap the entry list in a fixed-height `overflow-y-auto` container so `sticky top-0` has a real scroll context, or drop `sticky` if the list is meant to rely on pagination instead of in-place scrolling.

### 8. Slot-machine reels clip long affix names with no ellipsis/truncation affordance
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_loot/affix/AffixRollSimulator/index.tsx:79-109
- **Scenario**: An affix name in `AFFIX_DEFS` that's longer than roughly "Godroll Amulet" (or any future longer name) lands in a reel.
- **Root cause**: Each reel is a fixed `w-24 h-12` box with only `overflow-hidden` — no `truncate`, `whitespace-nowrap`, or `line-clamp` — so a long name either wraps and gets vertically cut off mid-character or overflows unpredictably depending on font metrics.
- **Impact**: Inconsistent, sometimes illegible reel text for anything but short affix names, undermining the otherwise polished slot-machine animation.
- **Fix sketch**: Add `truncate` (or `line-clamp-2` if two lines are acceptable) so long names degrade gracefully with an ellipsis instead of a hard visual cut.

### 9. Focus-visible treatment is inconsistent across interactive controls in the same panel
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEditorToolbar.tsx:45-53
- **Scenario**: Tab through the Loot Table Editor toolbar (Import/Re-export/Undo/Add/Export JSON) and the pagination arrows with a keyboard.
- **Root cause**: `LootTableEntryList`'s weight slider and remove button use the shared `focus-ring` utility class, but the toolbar buttons in `LootTableEditorToolbar.tsx` and the prev/next buttons in `LootTablePagination.tsx:17-33` only rely on the browser's default outline (which several ancestor styles in this codebase tend to suppress), giving no consistent focus indicator.
- **Impact**: Keyboard/screen-reader users get a visibly different (or possibly absent) focus affordance depending on which control in the same editor they land on — an accessibility/consistency gap in an otherwise carefully tokenized design system.
- **Fix sketch**: Apply the same `focus-ring` (or equivalent `focus-visible:ring`) utility to every actionable button in the toolbar and pagination components.

### 10. Entry list content pops in/out abruptly, breaking the module's established motion language
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_loot/affix/LootTableEntryList.tsx:22-79
- **Scenario**: Type a search query, switch the source filter, or change page in the Loot Table Editor.
- **Root cause**: Nearly every other surface in this context animates state transitions — `LootTabPanels` wraps tab switches in `AnimatePresence`/`motion.div`, `LootTableEditor` animates the JSON export and re-export panels with `height`/`opacity` transitions — but `LootTableEntryList` re-renders its grouped rows with a plain conditional render and no `motion`/`AnimatePresence` at all.
- **Impact**: Filtering/paging causes a jarring instant swap of rows, standing out as visually inconsistent next to the smooth transitions everywhere else in the same tab.
- **Fix sketch**: Wrap the row list (or at least the "No items match" empty state) in a light `AnimatePresence`/fade, consistent with the rest of the module's transitions.
