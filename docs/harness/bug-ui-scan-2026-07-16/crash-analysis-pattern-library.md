# Crash Analysis & Pattern Library — Bug + UI Scan

> Total: 9

> **Context-map discrepancy**: both files listed in scope no longer exist as single files on `master`.
> `src/components/modules/evaluator/CrashAnalyzerView.tsx` was split (commit `529b1cc0`, "split 17 more large .tsx files into ≤300-LOC folder modules") into `CrashAnalyzerView/{index.tsx, constants.ts, SeverityBadge.tsx, MiniStat.tsx, PlainModeToggle.tsx, CrashListItem.tsx, CallstackCard.tsx, AiDiagnosisCard.tsx, RawLog.tsx, PlainCrashSummary.tsx, PatternCard.tsx, ImportPanel.tsx, CrashDetailPanel.tsx}` (13 files).
> `src/components/modules/evaluator/PatternLibraryView.tsx` was split into `PatternLibraryView/{index.tsx, constants.ts, StatCard.tsx, AuthorPatternModal.tsx, PatternCard.tsx, PatternEditor.tsx}` (6 files).
> All 19 resulting files were read in full for this pass.

## Bug findings

### 1. Copy-to-clipboard shows success regardless of whether the write actually succeeded
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/CrashAnalyzerView/AiDiagnosisCard.tsx:16-20
- **Scenario**: User clicks "Copy" on the AI fix prompt in a non-secure context (http, some embedded webviews) or when clipboard permission is denied by the browser/OS.
- **Root cause**: `handleCopyPrompt` calls `navigator.clipboard.writeText(...)` without awaiting or catching the returned promise, then unconditionally calls `setCopied(true)`. Any rejection (permission denied, insecure origin, no Clipboard API) is silently swallowed and the UI still flips to the "Copied!" checkmark state.
- **Impact**: Success theater — the user believes the fix prompt is on their clipboard and pastes elsewhere, getting nothing; there is no fallback or error surfaced, so the failure is undiscoverable until the paste fails downstream.
- **Fix sketch**: `await` the promise inside a try/catch; only call `setCopied(true)` on resolve, and show a distinct error affordance (e.g. toast or inline text) on reject/unsupported API.

### 2. Clearing search/filters after a search leaves the pattern list permanently stale
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/PatternLibraryView/index.tsx:68-73
- **Scenario**: User types a search query (triggers debounced `searchPatterns()`), then deletes the query back to empty (or clears the module/category filter back to "All").
- **Root cause**: The debounced-fetch effect is gated by `if (searchQuery || moduleFilter || categoryFilter) { ... searchPatterns() ... }`. When all three become falsy again, the condition is false, so the effect body never runs and `searchPatterns()` (or an equivalent reset call) is never invoked to restore the full/unfiltered dashboard list.
- **Impact**: The visible pattern list silently remains whatever the last active filter produced (including a "no results" empty state) even though the user has visually cleared every filter control — a state-corruption/stale-data bug with no visual indication anything is wrong.
- **Fix sketch**: Always call `searchPatterns()` (or `fetchDashboard()` when all filters are empty) inside the effect regardless of the truthiness guard, or add an explicit "reset to unfiltered" branch when `!searchQuery && !moduleFilter && !categoryFilter`.

### 3. In-progress "Author Pattern" form can be silently wiped by an unrelated background refresh
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/PatternLibraryView/AuthorPatternModal.tsx:43-59 (effect deps at line 59); moduleIds sourced from src/components/modules/evaluator/PatternLibraryView/index.tsx:82,288-292
- **Scenario**: User opens "Author Pattern", starts filling in Title/Description, and while they're typing, `Extract Patterns` (also on this screen) finishes in the background and refreshes `topModules` in the store.
- **Root cause**: The modal's reset `useEffect` depends on `[open, moduleIds]`. `moduleIds` is a `useMemo` over `topModules` from the store; when `fetchDashboard`/`extractPatterns` completes, the store produces a new `topModules` array reference, which changes `moduleIds`'s memoized value even though the modal never closed — re-running the reset effect and blowing away every field the user had typed.
- **Impact**: Silent data loss — no warning, no confirmation, the form just reverts to blank while still open, and the user may not notice until they hit submit and it fails validation or saves an empty pattern.
- **Fix sketch**: Reset the form only on the `open` transition (e.g. track previous `open` in a ref, or key the effect solely on `open`), not on every `moduleIds` reference change; keep `moduleIds` as a plain prop read for populating the `<select>` options without it being a reset trigger.

### 4. Crash log import failures are completely invisible to the user
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/CrashAnalyzerView/ImportPanel.tsx:15-22
- **Scenario**: User pastes a crash log and clicks "Import & Analyze"; the `importCrashLog` call rejects or resolves to a falsy/undefined value (malformed log, API/network error, parse failure).
- **Root cause**: `handleImport` awaits `importCrashLog(rawLog)` with no try/catch, and only acts `if (report)` — on falsy return it does nothing at all, and on a thrown rejection there's an unhandled promise rejection. `ImportPanel` never reads the store's `error` field (used elsewhere in `CrashAnalyzerView/index.tsx`), so nothing renders here even if the store does capture an error.
- **Impact**: The user has no feedback that their paste didn't work — the textarea just sits there with no toast, no red banner, no cleared state; they may re-click repeatedly assuming the button isn't responding (retry-storm risk) or give up assuming the log had nothing analyzable.
- **Fix sketch**: Wrap the call in try/catch, surface the store `error` (or a local error state) next to the existing `importResult` success message, and keep `rawLog` intact on failure so the user doesn't have to re-paste.

### 5. Async submit handlers keep updating state after the component unmounts
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/evaluator/PatternLibraryView/index.tsx:75-79; src/components/modules/evaluator/CrashAnalyzerView/ImportPanel.tsx:15-22
- **Scenario**: User clicks "Extract Patterns" (or "Import & Analyze") then immediately navigates away from the module (tab switch) before the awaited call resolves.
- **Root cause**: `handleExtract`/`handleImport` call `setExtractResult`/`setImportResult` (and a `setTimeout` to clear it) after an `await` with no unmount/cancellation guard (no `AbortController`, no mounted-ref check).
- **Impact**: React logs "state update on an unmounted component" warnings and the pending `setTimeout` callback fires later against a component instance that no longer exists — harmless today but a latent landmine if these handlers grow additional side effects (e.g. a mounted third async chain) that assume the component is still alive.
- **Fix sketch**: Track a mounted ref (or `AbortController`) per handler and no-op the `setState` calls (and clear the timeout) once the component has unmounted.

## UI findings

### 6. Icon-only close button has no accessible label, inconsistent with sibling icon affordances
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/CrashAnalyzerView/CrashDetailPanel.tsx:45-47
- **Scenario**: A screen-reader user tabs to the crash detail panel's close (`XCircle`) button.
- **Root cause**: The button has no `aria-label`/`title`, so it announces only as "button" — whereas neighboring icon-only elements in the same file family are given explicit labels (e.g. `PatternCard.tsx`'s `Pin` icon has `aria-label="Pinned"`, its `CheckCircle2` has `aria-label="Verified"`).
- **Impact**: Inconsistent affordance quality across the same component family; the one truly *actionable* icon-only control in the panel is the one left unlabeled, while purely decorative status icons elsewhere got labels.
- **Fix sketch**: Add `aria-label="Close crash detail"` (and ideally a `title` for the mouse-hover tooltip) to match the labeling convention already used on `Pin`/`CheckCircle2` in this same evaluator sub-module.

### 7. Success-rate color coding borrows generic module-palette colors instead of a dedicated semantic token
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/PatternLibraryView/PatternCard.tsx:29-31
- **Scenario**: Designer/engineer later changes `MODULE_COLORS.content` or `MODULE_COLORS.evaluator` for unrelated module-branding reasons.
- **Root cause**: `successColor` picks between `ACCENT_EMERALD_DARK`, `MODULE_COLORS.content`, and `MODULE_COLORS.evaluator` purely by success-rate thresholds (`>=70`/`>=50`/else) — reusing two *module identity* colors as stand-ins for "medium" and "low" success semantics. This directly contradicts the design-token discipline the codebase otherwise enforces (see `CrashAnalyzerView/constants.ts`'s comment on `SEVERITY_TOKENS` and `PatternLibraryView/PatternCard.tsx`'s own use of `CONFIDENCE_TOKENS` two lines above for the confidence chip).
- **Impact**: A future rebrand of the "Content" or "Evaluator" module colors would unintentionally recolor the success-rate ring here too, and the choice of which module-color maps to "medium" vs. "low" success is not self-documenting — a new contributor has no way to tell this is a semantic (not module) mapping without reading the threshold logic.
- **Fix sketch**: Introduce a `SUCCESS_RATE_TOKENS` (high/medium/low) map alongside `SEVERITY_TOKENS`/`CONFIDENCE_TOKENS` in `chart-colors.ts` and reference that here instead of `MODULE_COLORS`.

### 8. Author-pattern modal lets users cancel/dismiss mid-save with no warning, and offers no reason for a disabled Save
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/PatternLibraryView/AuthorPatternModal.tsx:198-215
- **Scenario**: User fills the required Title/Description, clicks "Save Pattern" (button now reads "Saving…"), then clicks "Cancel" while the request is still in flight; separately, a user with an empty Title sees the Save button disabled with no explanation.
- **Root cause**: Only the Save button is disabled during `submitting`; the Cancel button (line 199-205) has no `disabled={submitting}` guard, so `onClose` fires immediately and unmounts/hides the modal while `handleSubmit`'s awaited `authorPattern(input)` is still pending. Separately, the disabled-Save state carries no `title`/helper text explaining which required field is missing.
- **Impact**: A mid-flight cancel gives the user the impression the action was aborted, but the network request continues (and per finding #5's pattern, updates state after the modal's local state is gone); the unexplained disabled Save button is a minor but recurring "why can't I click this" friction point.
- **Fix sketch**: Disable Cancel while `submitting` (or let it abort the in-flight request via `AbortController`), and add a `title`/inline hint on the Save button (or under the Title/Description fields) when they're empty.

### 9. Two-column crash split-view and the filter/sort toolbar have no responsive breakpoint for narrow viewports
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/CrashAnalyzerView/index.tsx:208-212; src/components/modules/evaluator/PatternLibraryView/index.tsx:177-237
- **Scenario**: The app is viewed on a narrow window or a tablet/mobile-width viewport (this is a "game-dev tooling app" but per the shared UI-perfectionist brief, responsiveness/mobile-first is explicitly in scope).
- **Root cause**: `CrashAnalyzerView`'s master-detail grid hardcodes `gridTemplateColumns: selectedReport ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)'` with no `sm:`/`md:` breakpoint fallback to a single stacked column, so selecting a crash on a narrow screen squeezes both the list and the detail panel into unreadably thin columns instead of the detail panel taking over full-width. Similarly, `PatternLibraryView`'s search+filter bar (`flex items-center gap-3 flex-wrap`) mixes one flexible search input with three fixed-width `<select>`s that wrap individually with no grouping, label, or stacked-row treatment.
- **Impact**: On any viewport narrower than roughly the two panels' combined minimum width, crash detail becomes difficult to read/interact with (truncated text, cramped callstack scroll area); the pattern-library filter row degurates into an unlabeled stack of dropdowns with inconsistent widths.
- **Fix sketch**: Add a breakpoint-driven layout (e.g. `grid-cols-1 md:grid-cols-2` with the detail panel replacing the list rather than sitting beside it below `md`), and group the filter/sort controls into a labeled, single-column stack below `sm`.
