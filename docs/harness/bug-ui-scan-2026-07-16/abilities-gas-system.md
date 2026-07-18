# Abilities & GAS System — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Search-navigate scroll silently fails to reach the target section
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_ability/index.tsx:63-71
- **Scenario**: User opens the spellbook search palette, picks a result that lives on a *different* sub-tab than the one currently active, and hits Enter.
- **Root cause**: `handleSearchNavigate` calls `setActiveTab(tab)` then waits `requestAnimationFrame` + `setTimeout(250)` before querying `contentRef.current?.querySelector('[data-section-id=...]')`. But the tab content is wrapped in `<AnimatePresence mode="wait">` with a 300ms exit transition (`transition={{ duration: 0.3 }}` at line 153) — the new tab's DOM does not mount until the outgoing tab's exit animation finishes. The fixed 250ms delay is shorter than that 300ms window, so the querySelector frequently runs before the new section exists in the DOM.
- **Impact**: The scrollIntoView silently no-ops (`el?.scrollIntoView` — optional chaining swallows the miss), so search-driven navigation to a section on another tab lands the user on the top of the new tab instead of the intended section, with no error or fallback retry.
- **Fix sketch**: Poll/retry (e.g. `requestAnimationFrame` loop until the element appears or a max-attempts cap) instead of a single fixed timeout, or switch tab content to `mode="popLayout"`/no-exit-wait so mount isn't gated behind the exit transition.

### 2. Reopening the search palette briefly shows stale filtered results
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_ability/SpellbookSearch.tsx:27-53
- **Scenario**: Type a query, close the palette (Escape) with the debounce still in flight or just after it settled, then immediately reopen with Cmd/Ctrl+K.
- **Root cause**: On reopen, the "state-during-render" effect at line 46-53 resets `query` to `''` synchronously, but `debouncedQuery` comes from `useDebouncedValue(query, 150)` — an internal timer-based hook whose state doesn't reset instantly. For up to ~150ms after reopen, `debouncedQuery` still holds the previous session's query, so `filtered` (computed off `debouncedQuery`) shows leftover results from the last search even though the visible input is empty.
- **Impact**: A brief but visible flash of wrong/irrelevant results right after reopening the palette — confusing during fast Cmd+K/Cmd+K double-taps, which is exactly how a command palette gets used.
- **Fix sketch**: Key the debounce hook (or the whole palette subtree) by an "open session" counter so it resets its internal timer/state on reopen, or gate `filtered` on `open` as well as `debouncedQuery`.

### 3. Hardcoded 0–10s timeline axis has no bounds-checking for out-of-range events
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_ability/effects/EffectsTimelineSection.tsx:44-45,64-66,76
- **Scenario**: Any future `EFFECT_TIMELINE_EVENTS` entry (or a live-data variant if this section is ever wired to `useUE5SourceSync` like the rest of the spellbook) with `timestamp > 10` or `timestamp + duration > 10`.
- **Root cause**: `left = (evt.timestamp / 10) * 100` and `width = (evt.duration / 10) * 100` are computed against a hardcoded 10-second window with no `Math.min`/clamp, and the axis labels are a fixed `[0,2,4,6,8,10]` array — nothing derives the window from the actual data.
- **Impact**: An out-of-range event renders past 100% of its lane (or its bar clips/overflows outside the `overflow` default of the lane `div`, which has no `overflow-hidden`), silently misrepresenting timing without any visual warning that the axis is out of scale.
- **Fix sketch**: Derive the axis span from `Math.max(...events.map(e => e.timestamp + (e.duration ?? 0)))` (with a sane floor of 10) instead of hardcoding 10, and clamp bar left/width to [0,100].

### 4. Sim histogram fabricates a bin range when all values are identical
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_ability/gas-balance/simulation.ts:251 (consumed by HistogramChart.tsx:94 via `formatRange`)
- **Scenario**: Run the GAS balance simulator on a deterministic ability (no crit roll, no variance source) so every sampled damage value comes out identical, e.g. `min === max === 50`.
- **Root cause**: `const range = max - min || 1;` substitutes an arbitrary width of `1` whenever the real range is `0`, so `buildHistogram` synthesizes bin boundaries spanning `50` → `51` (divided across `buckets` bins) even though every actual data point is exactly `50`.
- **Impact**: The rendered histogram's hovered-bin tooltip (`formatRange(bins[hoveredIdx])`, HistogramChart.tsx:94) reports a fabricated numeric range (e.g. "50.0–50.1") for a value that never varies — a designer reading the GAS Balance Analyzer would reasonably conclude there is measured variance where there is none. This is a "success theater" style silent misrepresentation, not a crash, so it's easy to ship unnoticed.
- **Fix sketch**: When `max === min`, render a single full-width bin labeled with the exact value (e.g. "= 50") rather than a synthetic sub-unit spread, and have `HistogramChart`/`formatRange` special-case a zero-variance result.

## UI findings

### 5. Effects catalog filter/pagination controls have no active-page reset when the underlying dataset itself doesn't change but selection state does
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_ability/effects/EffectsSection.tsx:82-119
- **Scenario**: Select a type filter that yields, say, 3 pages, page forward to page 3, then switch to a filter that yields only 1 page.
- **Root cause**: `handleTypeChange` does reset `page` to 0 on type change (line 51-54) so this specific transition is actually handled — but the `AnimatePresence mode="sync"` wrapper keyed on `${activeType}-${page}` (line 83) means the fade-in animation replays on every filter AND page change without any exit transition being visible (mode="sync" means old content is removed immediately, no crossfade), so the "animate in" on the new page/filter reads as an abrupt content pop rather than the smooth transition the rest of the spellbook (index.tsx's tab switch) uses.
- **Impact**: Inconsistent motion language within the same feature area — the outer tab switch crossfades smoothly (mode="wait", 300ms) while the inner effects catalog just snaps content in, breaking the "polish" continuity a user would expect from adjacent UI.
- **Fix sketch**: Either match `mode="wait"` with a brief exit transition for the effects grid, or intentionally document this as a cheaper "list refresh" pattern distinct from tab navigation — right now the difference looks accidental rather than a deliberate density trade-off.

### 6. Histogram tooltip has no dismissal/keyboard path and can render clipped at chart edges
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_ability/gas-balance/HistogramChart.tsx:77-98
- **Scenario**: Hover the first or last bar in a histogram with narrow bins (many buckets) rendered inside a constrained-width panel.
- **Root cause**: The tooltip is absolutely positioned at `left: ((hoveredIdx + 0.5) / bins.length) * 100%` with `transform: translateX(-50%)` and no edge-of-container collision handling — it isn't clamped to stay within the parent's bounds. It's also mouse-only (`onMouseEnter` on each bar); there's no keyboard-focusable equivalent, so the same information is unreachable via keyboard/touch.
- **Impact**: Hovering an edge bar can render the tooltip partially outside the rounded `bg-surface-deep/30` panel (visually clipped by parent overflow or bleeding onto adjacent UI), and keyboard/touch users get zero access to bin details that mouse users rely on — a meaningful data-analysis feature (the GAS balance histogram) is mouse-only.
- **Fix sketch**: Clamp tooltip horizontal position to the container's bounds (e.g. `Math.max(minPct, Math.min(maxPct, pct))`), and add `tabIndex`/`onFocus` to each `Bar` (or a roving-tabindex pattern) so the tooltip is reachable without a mouse.

### 7. AbilityDiff stat delta color relies on only 3 hardcoded semantic colors with no dark/light contrast check
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_ability/forge/AbilityDiff.tsx:27-31,76-83
- **Scenario**: View the ability-refine diff for a stat whose `direction` is `'neutral'` (colored `ACCENT_CYAN`) against the surrounding `text-zinc-500`/`text-zinc-600` labels used everywhere else in the same component.
- **Root cause**: `AbilityDiff` mixes two different color systems in one panel: semantic `DIRECTION_COLOR` tokens from `@/lib/chart-colors` for deltas, but raw Tailwind `zinc-*` utility classes (`text-zinc-200`, `text-zinc-500`, `text-zinc-600`, `border-zinc-800` used in the sibling `CodeDiff`) for everything else, instead of the app's `text`/`text-muted` design tokens used consistently in the other files in this same context (CoreSection, EffectsSection, BalanceHealthReport all use `text-text`/`text-text-muted`).
- **Impact**: This one component won't repaint correctly if the app's theme tokens are ever retuned (light-mode / alternate theme), since `zinc-*` is a fixed Tailwind palette, not the CSS-variable-backed `--text`/`--text-muted` tokens the rest of the GAS UI uses — a design-system consistency gap localized to the forge diff views.
- **Fix sketch**: Replace the `zinc-*` utility classes in `AbilityDiff.tsx` and `CodeDiff.tsx` with the shared `text`/`text-muted`/`border` tokens already used by `CoreSection.tsx`, `EffectsSection.tsx`, and `BalanceHealthReport.tsx` in the same folder.

### 8. Effects grid pagination controls disappear entirely instead of disabling gracefully
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_ability/effects/EffectsSection.tsx:122-136
- **Scenario**: Filter to a type with ≤8 effects (fits on one page).
- **Root cause**: `{totalPages > 1 && (...)}` removes the whole pagination row (prev/next buttons + "Page X of Y" label) rather than rendering it disabled.
- **Impact**: The catalog's layout height jumps depending on the active filter (pagination row present vs. absent), causing a visible reflow of the panel and the "Damage Execution Pipeline" panel below it every time the filter selection crosses the 8-item threshold — a small but avoidable layout shift during what should be a lightweight filter interaction.
- **Fix sketch**: Always render the pagination row but disable both buttons and show "Page 1 of 1" when `totalPages <= 1`, keeping panel height stable across filter changes.

### 9. SpellbookSearchPalette gives no visual affordance that Cmd/Ctrl+K reopens/toggles, only the trigger button's `kbd` hint
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_ability/SpellbookSearch.tsx:56-65,77-80
- **Scenario**: A user has the palette open and presses Cmd/Ctrl+K again (a very natural "close the thing I just opened" reflex, and the standard command-palette convention in most editors).
- **Root cause**: The global handler does `setOpen(prev => !prev)` — so Ctrl+K while open actually toggles it closed, which is correct behavior — but the palette itself only documents `ESC` to close (the `<kbd>ESC</kbd>` hint at SpellbookSearchPalette.tsx:115-117) and never mentions Ctrl/Cmd+K as an equally valid dismiss key, so discoverability of the toggle is asymmetric (advertised to open, not advertised to close).
- **Impact**: Minor — users who know the convention benefit, but the in-palette footer hints (SpellbookSearchPalette.tsx:169-179) don't reflect the full set of dismiss affordances, an easy inconsistency to tidy up given the footer already itemizes keybindings.
- **Fix sketch**: Add a "⌘K / Esc close" hint alongside the existing ESC badge in the palette header/footer.
