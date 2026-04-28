# UI Perfectionist — Feature Matrix UI & API

> Context: Feature Matrix UI & API (Module System & Navigation)
> Files read: 5 (UI components + hook + types — API routes skimmed in scope)
> Total: 9 findings — Critical: 0, High: 4, Medium: 4, Low: 1

## 1. "Accent button" pattern is copy-pasted across 6+ surfaces with magic opacity suffixes

- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/shared/FeatureMatrix.tsx:425-444, 526-547, 1226-1247; src/components/modules/shared/QuickActionsPanel.tsx:116-127; src/components/modules/shared/RoadmapChecklist.tsx:646-660, 1208-1220
- **Scenario**: Every primary action that uses the per-module `accentColor` inlines the exact same recipe: `style={{ backgroundColor: \`${accentColor}24\`, color: accentColor, border: \`1px solid ${accentColor}38\` }}` plus `disabled:opacity-50` and an icon. The neverReviewed "Review with Claude" CTA, the toolbar "Review with Claude", "Implement This", QuickActionsPanel "Send", RoadmapChecklist "Claude", NBABanner "Run", and the "Run All Unchecked" button are all hand-rolled copies of the same control.
- **Root cause**: No `<AccentButton>` (or themed `<Button variant="accent">`) primitive. The hex-suffix-as-opacity convention (`24` = ~14%, `38` = ~22%) is hardcoded per use-site instead of being centralized — `chart-colors.ts` already exports `OPACITY_*` tokens (`OPACITY_15 = '26'`, `OPACITY_22 = '38'`) and `statusBg`/`statusBorder` helpers, but these surfaces don't use them.
- **Impact**: Six places to update if the accent treatment changes (e.g., to add a focus ring, switch from `24` to a token, or fix disabled styling). Subtle drift already exists — RoadmapChecklist uses `${accentColor}24/38` but the bottom "Run with Claude" in BulkActionBar uses identical magic, while NBARunnerRow uses `${accentColor}18/28`. The `24` vs `18` divergence has no design intent.
- **Fix sketch**: Extract `<AccentButton accentColor size="sm|md" icon={Icon}>` in `src/components/ui/`. Internally use `statusBg(accentColor, 0.14)` / `statusBorder(accentColor, 0.22)` so the magic hex suffixes disappear. Add `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` once, in the primitive. Migrate all six call sites; collapses ~80 lines of duplicated style blocks.

## 2. Three near-identical Copy buttons with separate `useState(copied)` machinery

- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/shared/FeatureMatrix.tsx:1043-1051, 1114-1123 (inline within FeatureRowItem); src/components/modules/shared/QuickActionsPanel.tsx:134-153 (CopyPromptButton); src/components/modules/shared/RoadmapChecklist.tsx:1463-1482 (CopyItemButton), 1064-1069 (BulkActionBar copy)
- **Scenario**: Four distinct implementations of "click to copy → flash a check icon for `UI_TIMEOUTS.copyFeedback` ms → revert to copy icon". All four import `Copy, Check` from lucide, manage their own `copied` state, and call `navigator.clipboard.writeText`. The visual treatment drifts: FeatureMatrix uses `text-text-muted hover:text-text`, QuickActionsPanel hardcodes `text-[#4ade80]` for the check, CopyItemButton also uses `text-[#4ade80]` — but the inline version in FeatureMatrix uses `STATUS_SUCCESS` constant.
- **Root cause**: No shared `<CopyButton text="..." />` primitive. Each surface re-implements the timer + state.
- **Impact**: Drift in success colour (`#4ade80` literal vs `STATUS_SUCCESS` token — same value today, but the literal is a maintenance booby-trap). Four places to update if you want, e.g., a sonner toast on copy or a longer flash duration. The `e.stopPropagation()` is forgotten in some variants.
- **Fix sketch**: Extract `<CopyButton text size="xs|sm" stopPropagation />` in `src/components/ui/CopyButton.tsx`. One `useState`, one timer, one icon set, uses `STATUS_SUCCESS` token. Replace all four call sites — drops ~50 lines.

## 3. RoadmapChecklist abandons the chart-colors token system for hard-coded hex + Tailwind colour classes

- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/shared/RoadmapChecklist.tsx:469-477, 518-528, 545-563, 587-606, 615-619, 639, 749, 760-771, 786-797, 962-1004
- **Scenario**: While FeatureMatrix uses `STATUS_SUCCESS`, `STATUS_ERROR`, `statusBg()`, `OPACITY_*` tokens, the sibling RoadmapChecklist file is full of literals: `bg-green-900/20`, `border-green-500/40`, `bg-[#1a1700]`, `border-[#3a3000]`, `bg-[#0d1a0d]`, `border-[#1a3a1a]`, `bg-[#111130]`, `border-[#2e2e6a]`, `border-[#3e3e6a]`, `border-[#5e5e8a]`, `text-[#00ff88]`, `text-[#f59e0b]`, `text-[#fbbf24]`, `bg-[#f59e0b18]`, `text-violet-400`, `bg-violet-400/5`. Two files in the same folder render the same status concepts in two different colour languages.
- **Root cause**: RoadmapChecklist predates (or skipped) the `chart-colors.ts` rollout. `STATUS_SUCCESS` is `#4ade80` and `green-500` is `#22c55e` — visibly different greens used to denote the same "done" semantics across the app.
- **Impact**: A user who completes a checklist item sees one shade of green; reviews a feature in FeatureMatrix and sees another. Theme changes (e.g., a future light mode) will half-work. Devs adding a new status indicator have to guess which palette to follow.
- **Fix sketch**: Replace `bg-green-900/20 border-green-500/40` → `style={{ backgroundColor: statusBg(STATUS_SUCCESS, 0.20), borderColor: statusBorder(STATUS_SUCCESS, 0.40) }}`. Same pattern for yellow → `STATUS_WARNING`, blue → `STATUS_INFO`, violet → `ACCENT_VIOLET`. The `#00ff88` "running" colour should become a named token (e.g., `STATUS_LIVE` or reuse `STATUS_SUCCESS`). Net: ~25 hex literals removed, RoadmapChecklist comes back into the design system.

## 4. QuickActionsPanel hardcodes amber/red/green hexes parallel to existing tokens

- **Severity**: Medium
- **Category**: design-system
- **File**: src/components/modules/shared/QuickActionsPanel.tsx:10-14, 98-101, 150
- **Scenario**: `COMPLEXITY_CONFIG.intermediate.color = '#f59e0b'` (literal) and `advanced.color = '#ef4444'` (literal) sit next to `beginner.color = STATUS_SUCCESS` (token). The prompt-suggestions hint uses `bg-[#fbbf2408] border-[#fbbf2415] text-[#fbbf24] text-[#b0a070]` — four arbitrary hex literals to express "amber warning hint". The check icon in CopyPromptButton uses `text-[#4ade80]` instead of `STATUS_SUCCESS`.
- **Root cause**: Mixed authorship — beginner was migrated to tokens, intermediate/advanced were not.
- **Impact**: `#f59e0b` and `STATUS_WARNING` (`#fbbf24`) are *almost* the same amber; the file uses both for adjacent UI ("intermediate" badge vs "suggestion hint") with no design intent for the distinction. `#b0a070` is a one-off muted-amber that exists nowhere else.
- **Fix sketch**: Replace `'#f59e0b'` → `STATUS_WARNING`, `'#ef4444'` → `STATUS_ERROR` (or `ACCENT_RED`), `'#4ade80'` → `STATUS_SUCCESS`. For the suggestion hint, use `style={{ backgroundColor: statusBg(STATUS_WARNING, 0.03), borderColor: statusBorder(STATUS_WARNING, 0.08), color: STATUS_WARNING }}` and let opacity carry the muted feel — drops `#b0a070` entirely.

## 5. Search input has no clear button and no visible focus state

- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/shared/FeatureMatrix.tsx:570-580
- **Scenario**: The "Search features, notes, files..." input is the primary discovery affordance for the matrix, yet (a) once the user types, there's no X/clear button — they have to select-all-delete or empty the field manually, and (b) `focus:outline-none focus:border-border-hover` is the only focus treatment, so keyboard users get a barely-visible 1px border colour change.
- **Root cause**: Input was built as a thin wrapper over `<input>` with Tailwind classes; no shared `<SearchInput>` primitive that would standardize clear button + focus ring.
- **Impact**: Small but constant friction — every refinement of the search means manual erase. Keyboard users tabbing in can't tell where focus is on a dark theme. The "Showing X of Y features" indicator (line 613) hints the search is filtering but offers no way to undo.
- **Fix sketch**: Add a conditional `<button onClick={() => setSearchQuery('')}>` with an `X` icon at `right-2`, mirroring the left `Search` icon, shown only when `searchQuery.length > 0`. Strengthen focus to `focus-visible:ring-2 focus-visible:ring-[var(--border-bright)] focus-visible:border-transparent`. Better: extract `<SearchInput value onChange placeholder />` and reuse for QuickActionsPanel's "Ask Claude" input, which has the same gap.

## 6. Loading state is a 5×5 px spinner — no skeleton, no shape preview

- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/shared/FeatureMatrix.tsx:389-395
- **Scenario**: While `useFeatureMatrix` fetches, the entire matrix area collapses to `<Loader2 className="w-5 h-5" />` centered in `py-12`. Then the full table snaps in. On a project with 30+ features and a slow seed, this is several seconds of "is anything happening?" followed by a layout jolt as the summary bar, filter chips, search row, and grouped rows all paint at once.
- **Root cause**: No skeleton component for the matrix shape (summary bar bones, chip row bones, ~5 row placeholders).
- **Impact**: Perceived slowness; layout-shift jank when results arrive. The neverReviewed state (line 401-456) is a beautiful empty state — the loading state is its neglected cousin.
- **Fix sketch**: Build a `<FeatureMatrixSkeleton>` that renders a grey-on-grey version of the structure: a 6px progress-bar bone, a row of pill-shaped chip bones, a search-row bone, and 5–8 row bones (animated with `animate-pulse` or the existing `transition-all duration-slow`). The `StaggerContainer` already exists for the real rows — match its rhythm so the swap-in feels smooth.

## 7. Status filter chip count badges duplicate the SummaryBar — and they disagree under filtering

- **Severity**: Medium
- **Category**: visual-consistency
- **File**: src/components/modules/shared/FeatureMatrix.tsx:825-870 (SummaryBar), 872-930 (StatusFilterChips), 612-617 (Result count)
- **Scenario**: Three places display "how many of each status": the SummaryBar segmented bar with inline counts (e.g., "3 implemented · 2 partial"), the chip row with the same counts inside circular badges, and the "Showing X of Y features" line below. All three read from `summary` (which is unfiltered), so when a user types in search or narrows quality, the chips still show the full module counts — a user filtering down to "show me the 5 partials" sees the chip say "12 partial" because the summary never recomputes.
- **Root cause**: `summary` is the unfiltered server-side count. The chips were never wired to a filtered count derived from `filtered`.
- **Impact**: Users misread the chips as "live" filter state. Three semantically-overlapping UI surfaces (segments, chips, text count) all showing slightly different things makes the header noisy.
- **Fix sketch**: Either (a) compute `filteredSummary` from `filtered` in a `useMemo` and pass that to chips so the badges become live counts, or (b) explicitly mark the chips as "module totals" with a subtle separator from the live "Showing X of Y" line. Option (a) is the standard faceted-filter pattern. Also consider hiding the SummaryBar's inline count list when chips are present — they show the same data.

## 8. Icon-only hover-revealed action buttons have no focus-visible state — keyboard users see nothing

- **Severity**: Medium
- **Category**: accessibility-polish
- **File**: src/components/modules/shared/FeatureMatrix.tsx:1100-1136 (FeatureRowItem hover actions); src/components/modules/shared/RoadmapChecklist.tsx:610-661 (cards layout hover actions), 893-904 (PriorityDropdown flag), 1280-1289 (NBARunnerRow Run)
- **Scenario**: Each feature row has a cluster of icon-only buttons (Play, Copy, Eye in FeatureMatrix; StickyNote, Flag, Copy, ScanSearch, Play in RoadmapChecklist) gated behind `opacity-30 scale-95 group-hover/row:opacity-100`. They become full-opacity on mouse hover only. There's no `focus-within` or `focus-visible` rule, so a keyboard user tabbing through the page lands inside an invisible button cluster with no indication. Some are even `<span role="button">` rather than `<button>`, with bespoke `onKeyDown={Enter}` handlers that miss `Space`.
- **Root cause**: The "reveal on hover" pattern was implemented as pure mouse affordance; keyboard a11y wasn't layered in.
- **Impact**: Keyboard users cannot discover the row-level actions (copy, view files, run-with-Claude); screen-reader users on the `role="button"` spans don't get native button semantics (e.g., disabled state, default Space activation).
- **Fix sketch**: Add `group-focus-within/row:opacity-100 group-focus-within/row:scale-100` alongside the hover variants on the wrapper span. Add `focus-visible:ring-2 focus-visible:ring-[var(--border-bright)] focus-visible:opacity-100` to each button so a focused button is always visible regardless of group state. Replace `<span role="button" tabIndex={0} onClick onKeyDown>` with real `<button>` elements — the only reason for `<span>` is event-bubbling avoidance, which `e.stopPropagation()` already handles.

## 9. Sticky header z-index uses magic numbers without a layered system

- **Severity**: Low
- **Category**: design-system
- **File**: src/components/modules/shared/FeatureMatrix.tsx:569 (`z-10`), 657 (`top-[40px] z-[5]`); src/components/modules/shared/RoadmapChecklist.tsx:1080 (`z-20`), 1360 (`z-[9999]`)
- **Scenario**: The matrix toolbar is `sticky top-0 z-10`. Category headers underneath are `sticky top-[40px] z-[5]` — chosen so they slide under the toolbar. The bulk-action bar in RoadmapChecklist is `z-20`. The context menu is `z-[9999]`. None of these refer to a tokenized stacking system; the `top-[40px]` is hand-measured against the toolbar height.
- **Root cause**: No `--z-toolbar`, `--z-sticky-header`, `--z-floating-bar`, `--z-popover` layer tokens. Heights are also magic — `top-[40px]` is whatever the toolbar happens to be today.
- **Impact**: Adding any padding to the toolbar (e.g., the search row growing from `py-1.5` to `py-2`) silently breaks the category-header alignment. A future tooltip or modal at `z-50` will conflict with the bulk bar at `z-20`.
- **Fix sketch**: Add four CSS vars to `globals.css`: `--z-sticky-secondary: 5; --z-sticky-primary: 10; --z-floating: 20; --z-popover: 50; --z-overlay: 100`. Replace `z-[9999]` with `var(--z-overlay)` × something larger if needed. For the `top-[40px]` measurement, give the toolbar a CSS var (`--toolbar-h: 40px`) and reference it from the category sticky offset — or wrap them in a single sticky parent so layout co-locates.
