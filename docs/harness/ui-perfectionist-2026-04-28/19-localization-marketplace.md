# UI Perfectionist — Localization & Marketplace

> Context: Localization & Marketplace (Quality & Evaluation)
> Files read: 5
> Total: 6 — Critical: 0, High: 3, Medium: 2, Low: 1

## 1. Inline `text-{color}-400` Tailwind classes drift away from the chart-colors token system
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:38-49, 197-235, 287-362, 549-559, 753-757, 815, 821
- **Scenario**: This view both imports semantic constants (`ACCENT_EMERALD`, `STATUS_WARNING`, `STATUS_ERROR`, `STATUS_INFO`) for SVG fills *and* sprinkles raw Tailwind class strings — `text-red-400`, `text-emerald-400`, `text-blue-400`, `text-amber-400`, `text-green-400`, `text-indigo-400` — for the equivalent semantic states (error / success / info / warning / brand). The two paths drift: e.g. `STATUS_STYLE.approved` uses `text-green-400` while `translated` uses `text-emerald-400`, and `SEVERITY_STYLE.critical` uses `text-red-400` while the legend Badge uses variant `error` (which may resolve elsewhere).
- **Root cause**: There is no class-name twin to the chart-colors hex tokens, so authors reach for whatever Tailwind shade looks right at the call site. `STATUS_SUCCESS` is `#4ade80` (green-400) but `ACCENT_EMERALD` is `#34d399` (emerald-400) — both are used for "good" states interchangeably.
- **Impact**: Two near-identical greens (and two near-identical reds — `text-red-400`/`STATUS_ERROR=#f87171` vs Tailwind `red-400=#f87171` happen to match, but `text-red-300` on line 819 does not) read as accidental noise across the same card. The `approved` vs `translated` split implies a distinction users will not perceive.
- **Fix sketch**: Add a `STATUS_TEXT_CLASS`/`STATUS_BG_CLASS` map next to chart-colors (e.g. `success: 'text-emerald-400'`, `error: 'text-red-400'`, `warning: 'text-amber-400'`, `info: 'text-blue-400'`, `brand: 'text-indigo-400'`) and refactor `STATUS_STYLE`, `SEVERITY_STYLE`, MiniStat accents, and the LOCTEXT diff blocks to read from it. Collapse `translated` and `approved` to one color unless product confirms the distinction is meaningful — and add a comment if it is.

## 2. Tab-count badge is not visually distinct from the tab label, and active count badge does not change weight
- **Severity**: High
- **Category**: Component Architecture / Polish
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:594-607, 242-247
- **Scenario**: `SubTab` renders the count as plain `text-2xs text-text-muted` whether the tab is active or not. On the active tab the label brightens to `text-text` but the parenthesized count stays muted and same-size, producing a label that visually pulls apart ("Strings" bright + "(412)" dim).
- **Root cause**: The count span has no active-state branch, and uses literal `(123)` parentheses rather than a token-styled pill (compare to other count chips elsewhere in the codebase which typically use `Badge` or a small rounded surface).
- **Impact**: At a glance users cannot tell whether they are looking at one tab title or two adjacent items, and the active tab feels half-lit. This is the primary navigation chrome of the view, so the inconsistency is amplified.
- **Fix sketch**: Render the count as a small chip (rounded-full, `bg-surface-2`, tabular-nums) and bump it to `text-text` (or the indigo accent) when `active`. Consider extracting `SubTab` to a shared component since the same pattern appears in TranslationCard / Hazards filters. Verify against existing tabbed surfaces in `src/components/modules/evaluator/` for one canonical implementation.

## 3. Magic-number progress thresholds and width clamps duplicated across three bars
- **Severity**: Medium
- **Category**: Design System / Magic Numbers
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:311-320, 706-719, 837-883, 840-845
- **Scenario**: Three separate progress bars (per-locale translation progress, per-entry expansion bar, expansion-factor leaderboard) each hand-roll their geometry: heights `h-1.5` / `h-2` / `h-2.5`, max-width `120px` clamp on one, `MAX_EXPANSION` denominator on another, and a `1.5` divisor on a third. The threshold function `expansionColor` uses 0.7 / 1.0 / 1.2 buckets while the per-locale gauge on line 319 uses an inline 80 / 50 ternary.
- **Root cause**: No `<ProgressBar variant="…">` primitive — each bar inlines its own track + fill divs and color logic. The thresholds for "good / warning / bad" are picked twice with different breakpoints.
- **Impact**: Three bars in the same view that look almost-but-not-quite identical, and "80% green" on one bar means something different than "≤0.7 green" on another. A locale at 75% can simultaneously read healthy (factor color) and warning (progress color).
- **Fix sketch**: Extract `<ProgressBar value={pct} thresholds={…} height="sm|md" />` and have it accept either a thresholds prop or a precomputed color. Centralize the expansion buckets in `definitions.ts` next to `SUPPORTED_LOCALES` so the component only renders. Reuse for the marketplace recommendation engine UI when those gaps surface.

## 4. Empty/loading/error states for sub-tabs are missing — only the top-level scan has them
- **Severity**: Medium
- **Category**: Missing States / Polish
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:392-469, 471-542, 463-467, 533
- **Scenario**: The Strings and Translations tabs render a filter row, a chip row, a count line, and then a list. If `filteredStrings.length === 0` (e.g. user combines all four presets), the list silently collapses to an empty `<div>` under "0 strings" — no illustration, no "clear filters" CTA, no explanation. Compare this to the well-designed empty states for Hazards (line 547) and String Tables (line 574) which use `SurfaceCard` with icon + copy.
- **Root cause**: The two filterable tabs were built around the happy path (results present) and never received the empty-state branch the static tabs got.
- **Impact**: Users who over-filter hit a dead end and may assume the data is broken. Particularly painful here because preset chips combine restrictively (intersection), so empty results are easy to land on.
- **Fix sketch**: Add an `if (filteredStrings.length === 0) return <EmptyFilters onClear={…} />` branch in both tabs. The empty component should call `setStringPresets(new Set())`, `setSearchQuery('')`, `setContextFilter('all')` from a single "Clear filters" button. Match the visual treatment of the existing Hazards/Tables empty cards for consistency.

## 5. Stat bar accent thresholds are silently asymmetric (Hazards vs Hardcoded)
- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:229-237
- **Scenario**: The MiniStat row tints "Hardcoded" red unconditionally (any nonzero count looks alarming), but tints "Hazards" amber only when `criticalHazards > 0` (otherwise undefined → text-text). So 50 non-critical hazards render in default text while 1 hardcoded string renders bright red.
- **Root cause**: The accent rules were written ad hoc per stat rather than from a shared severity → color helper. There is no conditional on `hardcoded + ftextCount > 0` either, so the red persists at zero.
- **Impact**: The stats bar — a primary at-a-glance affordance — communicates an inconsistent severity model. Users are pulled to "Hardcoded" while ignoring potentially worse hazard counts.
- **Fix sketch**: Pass a `getSeverityColor(count, thresholds)` helper into MiniStat (or accept an `intent` prop with thresholds) so all six tiles share the same "0 = neutral / >0 = warn / >threshold = error" logic. At minimum guard the Hardcoded red with `(hardcoded + ftextCount) > 0 ? 'text-red-400' : undefined` and treat any hazard count > 0 as amber.

## 6. Filter `<select>` styling lacks chevron, focus ring, and dark-mode option contrast
- **Severity**: Low
- **Category**: Accessibility / Polish
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:411-440, 491-501
- **Scenario**: Both filter dropdowns use a bare native `<select>` with `bg-surface text-xs text-text` and `focus:outline-none` but no replacement focus indicator, no chevron icon, and no styling for the open option list (which inherits the OS theme). Compare to the search input alongside which has a clear `focus:ring-1 focus:ring-indigo-500/40`.
- **Root cause**: Native selects are styled directly; `focus:outline-none` removes the keyboard focus indicator without restoring one.
- **Impact**: Keyboard users lose focus state on the dropdown; on dark themes the OS option list may render with light backgrounds (Windows). Side-by-side with the search input, the visual weight is also different (no leading icon, no width consistency).
- **Fix sketch**: Either wrap the select with `appearance-none` + a `<ChevronDown>` overlay and add `focus:ring-1 focus:ring-indigo-500/40` to mirror the input, or extract a shared `<Select>` primitive used elsewhere in evaluator/. Restore a visible focus ring at minimum.
