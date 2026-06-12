# GDD Compliance & Design Doc — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Compliance report is never invalidated — stale scores survive project switches and pre-hydration audits
- **Severity**: High
- **Lens**: bug
- **Category**: stale-state
- **File**: `src/stores/gddComplianceStore.ts:24`
- **Scenario**: User opens GDD Compliance for project A (audit runs, report stored globally), then switches projects. `projectStore.switchProject` calls `loadModuleProgress` (projectStore.ts:256), which asynchronously replaces `checklistProgress`. When the compliance view remounts, its effect (`GDDComplianceView.tsx:186-189`) runs only `if (!report)` — the report from project A is still in the store, so no re-audit fires. Project B is now shown project A's scores, gaps, and "Last audit" timestamp. Variant: on a fresh browser (empty localStorage), the mount audit can fire before the server `loadProgress` resolves, auditing against an empty checklist — every implemented feature emits a false "implemented but not checked off" gap and all checklist percentages read 0.
- **Root cause**: The store treats the report as a global singleton with no notion of which project or which checklist snapshot it was computed from; the view's mount gate (`!report`) assumes "a report exists" implies "the report is current". Neither project identity nor checklist hydration is part of the invalidation contract. (Prior finding #2 covered the server cache losing resolutions; this is the client-side dual: the client never discards a stale report.)
- **Impact**: Wrong results presented as authoritative — compliance scores/gaps for the wrong project (or computed from empty checklist data) are displayed silently until the user happens to click Re-audit.
- **Fix sketch**: Store `projectPath` (and a checklist hash) alongside the report; in the view, re-run the audit when either differs from the current store state. Reset the report in `resetProject`/`switchProject` (a `clearReport()` action wired through the project bridge), and gate the mount audit on checklist hydration having completed.

## 2. Re-audit and Resolve failures are invisible once a report exists
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/evaluator/GDDComplianceView.tsx:202`
- **Scenario**: User has a rendered report. The dev server restarts (or the route's module-level cache is recycled — known issue #2), then the user clicks "Resolve" on a gap. The API returns 400 "No audit report available"; the store's `resolveGap` catch sets `error` (gddComplianceStore.ts:59-61) — but the only error UI is gated by `if (error && !report)`, which is false because a report exists. Nothing on screen changes: no message, the gap stays, the stale report keeps displaying. Same for a failing "Re-audit": `runAudit`'s catch sets `error`, the spinner stops, and the old report silently remains with its old "Last audit" timestamp.
- **Root cause**: Error rendering is modeled only as a first-load empty state. Once `report` is non-null there is no code path that surfaces `error`, so every post-success failure is swallowed. (New: the 2026-06-09 report documented the server returning 400 after cold start, but not that the client suppresses that error entirely.)
- **Impact**: Success theater — user actions appear to no-op; failed re-audits masquerade as fresh data; the known resolve-after-restart 400 becomes a guaranteed silent dead button.
- **Fix sketch**: Render a dismissible inline error banner above the module grid whenever `error` is set, even with a report present (and clear `error` on the next successful call). For resolve specifically, surface a toast/row-level message on failure instead of leaving the row untouched.

## 3. Quality star meter still uses unclamped `.repeat()` — the wave-1 clamp was only applied to room difficulty
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/gdd-synthesizer.ts:289`
- **Scenario**: A `feature_matrix` row carries a `quality_score` outside `[0,5]` (a row written before `clampQualityScore` was added to `upsertFeatures`, a seed/manual SQLite edit, or any future writer that bypasses `feature-matrix-db.ts` — SQLite is dynamically typed and the column has no CHECK constraint). `buildCoreSystemsSection` then evaluates `'★'.repeat(f.quality_score)` / `'☆'.repeat(5 - f.quality_score)`; a score of 6 makes the second repeat throw `RangeError: Invalid count value`, a negative score makes the first throw. The exception propagates out of `synthesizeGDD`, so the entire GDD (and both export actions) fails.
- **Root cause**: The 2026-06-09 critical (#1) was fixed at line 383 for room `difficulty`, but its prescribed remedy — "the same defensive clamp should wrap every `.repeat()` fed by stored data" — was not applied to the quality meter three sections earlier. The fix wave assumed write-time clamping (`clampQualityScore`, feature-matrix-db.ts:28) makes the read path safe, but that clamp only guards the current upsert path, not data already in the table or written around it. This is the incomplete half of a recent fix.
- **Impact**: Crash — one out-of-range row kills GDD generation, markdown export, pitch export, and PDF export, with a Retry button that can never succeed.
- **Fix sketch**: Reuse the line-383 pattern: `const q = Math.max(0, Math.min(5, Math.round(Number(f.quality_score) || 0)));` then `'★'.repeat(q) + '☆'.repeat(5 - q)`. Better: extract a shared `meter(value, max, fullChar, emptyChar)` helper used by both call sites and `progressBar`.

## 4. The roadmap "Feature Implementation Trend" chart is syntactically invalid Mermaid and never renders
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/gdd-synthesizer.ts:342-353`
- **Scenario**: Whenever `review_snapshots` has rows, `buildRoadmapSection` emits an `xychart-beta` whose `x-axis` array is split across multiple lines with a trailing comma before `]` (line 347 pushes `"Label",` for every snapshot including the last). Mermaid's xychart grammar accepts only a single-line, comma-separated list with no trailing comma (`commaSeparatedText: text | commaSeparatedText COMMA text`), so `mermaid.render` throws. `MermaidDiagram` catches the error, logs a `logger.warn`, and falls back to showing the raw source `<pre>` (MermaidDiagram.tsx:53-57,103) — the user sees a wall of mermaid code where the trend chart should be, with no error message. The exported markdown embeds the same broken ```mermaid block, so it renders as an error in GitHub/Obsidian too.
- **Root cause**: The chart builder formats the x-axis like prettified JSON (one entry per line, trailing comma) — valid in JS, invalid in Mermaid's line-oriented xychart grammar. Because the render failure is downgraded to a console warning with a source fallback, the breakage never surfaced. Unquoted/quoted labels containing `"` would break it as well.
- **Impact**: A whole advertised diagram is permanently dead in both the viewer and every export; silent (warn-level log only).
- **Fix sketch**: Build the axis on one line without a trailing comma: `x-axis [${snapshots.map(s => `"${label(s).replace(/"/g, "'")}"`).join(', ')}]`. Keep `bar [...]` single-line (it already is). Add a unit test that runs `mermaid.parse` over every generated diagram.

## 5. Deployment "Avg Duration" is a pairwise rolling halving, not an average — and cancelled builds deflate the success rate
- **Severity**: Medium
- **Lens**: bug
- **Category**: logic-error
- **File**: `src/lib/gdd-synthesizer.ts:521`
- **Scenario**: `buildDeploymentSection` computes `p.avgDuration = (p.avgDuration + b.duration_ms) / 2` starting from 0. With a single 10-minute build, "Avg Duration" reports 5 minutes (the seed 0 is averaged in). With N builds it is an exponentially-weighted value dominated by the last-processed row — and since builds are iterated newest-first, the oldest build in the 20-row window carries the most weight while the newest contributes ~2⁻ᴺ. Additionally, lines 518-519 count every non-`'success'` status as a failure, so `'cancelled'` builds (a first-class status per build-history-store.ts:10) drag the "Success Rate" down as if they were failures.
- **Root cause**: A running mean was hand-rolled incorrectly (no count divisor, seeded with 0) instead of summing and dividing — the sibling `build-history-store.ts:181,192` computes the same metric correctly with SQL `AVG(...)` over successful builds, which is direct evidence of the intended semantics. The success-rate denominator conflates "didn't succeed" with "failed".
- **Impact**: Wrong numbers in the Build & Deployment table of a document users export and share as the source of truth; always wrong unless all durations are identical.
- **Fix sketch**: Accumulate `durSum`/`durCount` and divide once per platform (or reuse `getPlatformSummaries()` from build-history-store instead of re-deriving). Track `cancelled` separately and compute success rate as `successes / (successes + failures)`.

## UI findings

## 6. Error-red is used as the compliance view's accent color — loading, primary action, and selection all read as failures
- **Severity**: High
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/GDDComplianceView.tsx:195`
- **Scenario**: The normal loading spinner is red (`STATUS_ERROR`, line 195), the primary "Re-audit" button is fully red-themed (`bg-status-red-subtle border-status-red-strong`, lines 243-244), and a *selected* module card gets a red border + red-tinted background regardless of its score (lines 337-340). A user opening the tab sees a red spinner (looks like something failed), a red primary action (looks destructive), and clicking a 95%-compliant module paints it red (looks critical).
- **Root cause**: The view adopted `STATUS_ERROR` as its module accent, while the sibling `GameDesignDocView` correctly uses `MODULE_COLORS.evaluator` and the rest of the app reserves the red ramp for severity/error semantics (`SEVERITY_TOKENS`, `scoreBandToken`). Red here collides with the very severity language this view renders next to it.
- **Impact**: Active miscommunication of state — neutral UI reads as failure/danger, undermining the carefully-built severity color system used by the gap rows one section below.
- **Fix sketch**: Swap the spinner, Re-audit button, and selected-card styling to the evaluator accent (`MODULE_COLORS.evaluator` with the `${ACCENT}14/38` tint pattern used in GameDesignDocView), keeping red exclusively for critical gaps and error states.

## 7. Resolve button mixes accent backgrounds with success-green text and has no in-flight state
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/GDDComplianceView.tsx:480`
- **Scenario**: The gap "Resolve" button combines `bg-accent-subtle border-accent-strong hover:bg-accent-medium` token classes with inline `color: STATUS_SUCCESS` — green text on the accent tint, matching neither the success token set nor the accent set. Clicking it fires an async store call with no pending state: the button stays clickable (double-submission possible), shows no spinner, and the row only disappears when the round-trip completes — or never, on failure (see bug #2).
- **Root cause**: Color tokens from two different semantic families were combined, and the async action was wired without the loading/disabled affordance every other async button in this view pair has (Re-audit, Export buttons all carry spinners + `disabled`).
- **Impact**: Inconsistent visual language for the one action that mutates triage state, plus a perceived-lag/no-feedback gap on slow or failing resolves.
- **Fix sketch**: Use the status-success token trio (`statusBg/statusBorder` from chart-colors, as `GapSideCard` already does), and add a per-gap `resolving` state: disable the button and swap the check icon for a `Loader2` spinner until the store call settles.

## 8. The accent button recipe is duplicated 5× with drift — including missing disabled styling on two export buttons
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/GameDesignDocView.tsx:246`
- **Scenario**: The inline accent-button style (`backgroundColor: ${ACCENT}15, color: ACCENT, border: 1px solid ${ACCENT}30`) is repeated for Retry (line 145), the empty-state Generate button (line 166, with different alphas `14/38`), and the three export toolbar buttons (lines 248, 257, 267). "Export .md" and "Export Pitch" have `disabled={...}` but no `disabled:opacity-40` class (Refresh and Export PDF do), so while an export is running those buttons look fully enabled yet ignore clicks.
- **Root cause**: A repeated JSX pattern was copy-pasted instead of extracted, and each copy drifted independently (alpha values, disabled treatment, title attributes).
- **Impact**: Visible inconsistency within a single toolbar (two buttons dim when busy, two don't), and every future accent tweak must be applied in five places.
- **Fix sketch**: Extract an `AccentButton` ({ icon, busy, disabled, children }) that owns the tint recipe, spinner swap, and `disabled:opacity-40`; reuse it for Retry/Generate/Copy/Export buttons here and for the compliance view's Re-audit after finding #6.

## 9. Export and Copy failures give zero feedback
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/GameDesignDocView.tsx:65`
- **Scenario**: `exportMarkdown`/`exportPitch` swallow all errors and return `null` (useGameDesignDoc.ts:66-68, 88-90); the handlers then `if (!markdown) return;` (lines 65, 85, 94). If the API errors (e.g. the synthesizer crash in bug #3 of the 06-09 report, or bug #3 above), the user clicks "Export .md", the spinner flashes, and… nothing: no file, no toast, no message. "Copy" is worse — `navigator.clipboard.writeText` can also reject (unhandled), and the "Copied" confirmation simply never appears, leaving the user unsure whether the clipboard now holds the GDD.
- **Root cause**: The hook converts every failure into `null` and the component treats `null` as "do nothing" instead of "tell the user". There is no error channel for the three export actions (the view-level `error` state only covers `generate`).
- **Impact**: Silent failure on the feature whose entire purpose is producing an artifact; users retry, blame the clipboard, or ship a stale file.
- **Fix sketch**: Have the handlers set a transient `exportError` rendered as a small inline alert next to the toolbar (or reuse an app toast if one exists), and wrap the clipboard write in try/catch with a "Copy failed" state on the same button.

## 10. TOC highlight never follows scrolling — `aria-current` sticks to the last clicked section
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/GameDesignDocView.tsx:189`
- **Scenario**: `activeSectionId` is set only in the TOC button's `onClick`. On first open nothing is highlighted; after clicking "Level Design" and then scrolling back to the top, the sidebar still highlights (and exposes `aria-current="true"` on) "Level Design" while "Project Overview" fills the viewport.
- **Root cause**: The sidebar is a scroll-spy pattern with the "spy" half missing — there is no IntersectionObserver/scroll listener mapping the visible section back to `activeSectionId`.
- **Impact**: The navigation lies about location (visually and to assistive tech), which matters in a long multi-section document this view exists to navigate.
- **Fix sketch**: Attach an `IntersectionObserver` (rootMargin tuned for the sticky toolbar) over the `gdd-${section.id}` elements inside `contentRef`, updating `activeSectionId` to the topmost intersecting section; keep click-to-scroll as-is.
