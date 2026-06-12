# Game Director & Regression — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

*Regression check on commit 1f51224: the `processSession` transaction wrap (regression-tracker.ts:144-292) is clean — single shared better-sqlite3 connection, fully synchronous body, no nested `db.transaction` calls (would be savepoint-safe anyway), and both modules' `ensureTables` DDL runs before `BEGIN`. No regressions introduced by that fix. Prior findings #2-#4 remain open and are not re-reported.*

## 1. SessionDetail never refetches findings/events after a playtest run completes
- **Severity**: High
- **Lens**: bug
- **Category**: state-staleness
- **File**: `src/components/modules/game-director/SessionDetail.tsx:65`
- **Scenario**: User opens a fresh (or completed) session and clicks "Run Playtest"/"Re-run". `simulatePlaytest` finishes, the hook's `refresh()` updates `director.sessions`, and SessionDetail re-renders with the new session object — score ring and summary strip appear ("12 findings"). But the Findings tab still says "No findings yet. Run a playtest to generate findings" and the Timeline tab stays empty (or shows the previous run's data after a re-run).
- **Root cause**: The data-loading `useEffect` deps are `[session.id, getFindings, getEvents]`. `session.id` never changes across a simulate, and both callbacks are stable `useCallback(..., [])` from `useGameDirector`, so the effect runs exactly once per mount. Nothing re-triggers the fetch when `session.status`/`session.summary` flip to complete.
- **Impact**: Wrong results — the header claims N findings while the list shows zero; user must navigate back to Overview and re-enter the session to see what the playtest just produced. Core run-playtest → review-results loop appears broken.
- **Fix sketch**: Add `session.completedAt` (or `session.status`) to the effect deps so a completed run refetches; alternatively have the `onSimulate` wrapper in SessionDetail `await onSimulate()` then call a local `reload()` that re-runs the findings/events fetch.

## 2. Health trend query freezes at the first 30 completed sessions (`ORDER BY ... ASC LIMIT`)
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/game-director-db.ts:433`
- **Scenario**: Once the project accumulates more than 30 completed sessions, `getHealthTrend()` runs `ORDER BY datetime(created_at) ASC LIMIT 30`, which returns the **oldest** 30 sessions ever. Every newly completed playtest from #31 onward is silently excluded from the trend, so the DirectorOverview chart never moves again.
- **Root cause**: `LIMIT` is applied to an ascending sort, so "limit to 30" means "the first 30 in history" rather than "the most recent 30". The intent (a rolling window of recent builds) requires sorting DESC for the cut, then re-ordering ASC for display.
- **Impact**: The "is the build getting better or worse?" chart permanently shows stale data with no error — a time bomb that fires exactly when the tool has been used long enough to be trusted.
- **Fix sketch**: `SELECT ... ORDER BY datetime(created_at) DESC LIMIT ?` then `rows.reverse()` in JS before mapping (or wrap in a subquery re-sorted ASC). Same applies to the `limit` query param path in route.ts.

## 3. Occurrence-history race in FingerprintsTab shows the wrong fingerprint's history
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/game-director/RegressionTrackerView.tsx:419`
- **Scenario**: User expands fingerprint A (fetch A in flight), then immediately expands fingerprint B. If B's response arrives first and A's second — easy on a busy dev server — A's occurrence rows are written into the single shared `occurrences` state and rendered under B's expanded row, permanently until B is collapsed/re-expanded. Even in-order completion flashes A's data under B with `loadingOcc` prematurely cleared to false by A's `finally`.
- **Root cause**: One shared `occurrences`/`loadingOcc`/`occError` state for whichever row is expanded, and `fetchOccurrences` has no guard that its response still belongs to the currently expanded `fpId`.
- **Impact**: Wrong results — the wrong bug's occurrence history (titles, fixes, dates) is displayed under a fingerprint, misinforming the regression investigation.
- **Fix sketch**: Inside `fetchOccurrences`, capture `fpId` and bail unless it still equals the current `expandedId` (track via ref), or store results keyed by fingerprint id: `setOccByFp(prev => ({ ...prev, [fpId]: occData }))`.

## 4. Create/triage/delete failures vanish with no user feedback (unhandled rejections)
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/game-director/NewSessionPanel.tsx:113`
- **Scenario**: The API returns an error (DB locked, validation, server down). `useGameDirector.createSession/updateTriage/simulatePlaytest/deleteSession` all `throw new Error(result.error)` — but `NewSessionPanel.handleCreate` (try/**finally**, no catch), `FindingsExplorer.applyTriage` (FindingsExplorer.tsx:66-79, same pattern), and the raw `onSimulate`/`onDelete` handlers in GameDirectorModule.tsx:76-80 never catch. The button spinner stops, the form/note panel stays open, and nothing else happens.
- **Root cause**: The hook's throw-on-error contract assumes callers surface errors, but every caller in this module swallows them as unhandled promise rejections (React error boundaries like ModuleErrorBoundary do not catch async rejections). Contrast RegressionTrackerView, which routes failures into an `actionError` banner.
- **Impact**: Silent failure — a user "creates" a session or "confirms" a finding, sees no error, and believes it succeeded; triage decisions are lost without trace.
- **Fix sketch**: Add catch blocks that set a local error state and render the existing `InlineErrorRetry` (already used by RegressionTrackerView) in NewSessionPanel, FindingsExplorer, and SessionDetail's simulate/delete handlers.

## 5. Regression alerts label the session where the bug was last *seen* as where it was "Fixed"
- **Severity**: Low
- **Lens**: bug
- **Category**: logic-error
- **File**: `src/lib/regression-tracker.ts:305`
- **Scenario**: Bug appears in Build 3, is absent in Build 4 (sweep marks fingerprint 'fixed' while processing Build 4), reappears in Build 6. The alert's `fixed_in_session_id` is computed by `findLastFixedSession`, which returns the most recent *prior occurrence* — Build 3. The AlertCard then renders "Fixed: Build 3 → Reappeared: Build 6", i.e. it names the build that *exhibited* the bug as the one that fixed it.
- **Root cause**: `findLastFixedSession` (despite its name) finds the last session containing an occurrence, not the session whose processing flipped the fingerprint to 'fixed'. The fixed-at session is never recorded by the sweep (regression-tracker.ts:259-268), so the alert substitutes last-seen.
- **Impact**: Wrong results — QA chasing "which build's changes fixed this (and which broke it again)" is pointed at the wrong build; the green "Fixed:" chip in the Alerts tab is factually false.
- **Fix sketch**: Record `fixed_in_session_id = <session being processed>` on the fingerprint when the sweep marks it 'fixed', and use that stored value when building the alert; keep last-seen separately if wanted for build-gap math.

## UI findings

## 6. Build-path "Browse" button is dead — it renders, focuses, and does nothing
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-director/NewSessionPanel.tsx:169`
- **Scenario**: In New Session, next to the Build Path input sits a folder-icon button ("Browse for build folder"). Users click it expecting a directory picker; nothing happens — no handler, no disabled state, no tooltip. Keyboard users tab onto it and Enter does nothing.
- **Root cause**: The button has `aria-label` and hover styles but no `onClick` — a placeholder shipped as a live control.
- **Impact**: Erodes trust in the whole form ("is Create also broken?") and wastes time on every new-session flow; it is the most prominent affordance next to the path field.
- **Fix sketch**: Either wire it (e.g. `<input type="file" webkitdirectory>` proxy or a server-side folder-pick endpoint, as fits this desktop-companion app), or remove the button and extend the placeholder/help text until the picker exists.

## 7. Triaging one finding collapses the whole Findings Explorer into a spinner and drops scroll position
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-director/FindingsExplorer.tsx:52`
- **Scenario**: User confirms/ignores a finding mid-list. `updateTriage` fires `void refresh()` in the hook, which produces a new `sessions` array identity; the explorer's load effect (deps `[sessions, getFindings]`) re-runs, calls `setLoading(true)`, and the early-return at line 124 replaces the entire list with a centered spinner while N parallel per-session fetches run. The list then remounts at the top — scroll position and the row the user was working on are lost. This happens on **every** triage click.
- **Root cause**: The effect keys off array identity rather than meaningful change, and reload uses the same `loading` flag as initial load instead of a background-refresh path; the optimistic `setAllFindings` update at line 75 is immediately clobbered by the full reload.
- **Impact**: Rapid triage (the screen's core workflow) becomes a stutter of full-screen spinners and scroll resets; batch-reviewing 30 findings is painful.
- **Fix sketch**: Only show the spinner when `allFindings.length === 0` (background-refresh silently otherwise), and gate the effect on a stable signature (e.g. completed-session id list joined) instead of `sessions` identity — the optimistic row update already keeps the UI correct.

## 8. SettingTooltip content is invisible to screen readers and the trigger lies about being a button
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-director/NewSessionPanel.tsx:27`
- **Scenario**: The info icons next to Playtime/Screenshots/Aggressive show guidance on hover/focus. A screen-reader user hears "Show guidance, button", presses Enter — nothing happens — and the tip text (the only documentation of these settings) is never announced because the tooltip div is unassociated and mounted/unmounted dynamically.
- **Root cause**: `role="button"` on a non-activatable span, and no `aria-describedby` linking the trigger to the tooltip content; the tooltip also lacks `role="tooltip"` and an Escape-to-dismiss.
- **Impact**: Assistive-tech users get zero access to the configuration guidance and a phantom non-functional button; fails WCAG 4.1.2 name/role/value.
- **Fix sketch**: Render the tip with `role="tooltip"` and a stable `id`, point `aria-describedby` at it from the trigger, drop `role="button"` (keep `tabIndex={0}`), and hide on Escape. Extract as a shared Tooltip if used elsewhere.

## 9. Finding row JSX is duplicated between SessionDetail and FindingsExplorer
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/game-director/SessionDetail.tsx:251`
- **Scenario**: `FindingsList` rows (SessionDetail.tsx:251-298) and `FindingCard` (FindingsExplorer.tsx:294-333) independently re-implement the same anatomy: `severitySurface` card, severity icon, title, category chip via `CATEGORY_LABELS`, related-module chip, description, suggested-fix line, confidence %, motion entrance. They have already drifted: the explorer wraps chips (`flex-wrap`) and shows triage badges; the detail view truncates description to 2 lines and shows none of the triage state — a finding the user just marked "false positive" in the explorer looks untouched when opened inside its session.
- **Root cause**: No shared `FindingRow`/`FindingCard` primitive; each screen grew its own copy, so visual and informational parity must be maintained by hand.
- **Impact**: Inconsistent presentation of the same entity across two adjacent tabs (triage state invisible in SessionDetail), and every future finding-field addition must be made twice.
- **Fix sketch**: Extract a shared `FindingCard` (severity surface, header chips incl. optional triage badge, description, fix, confidence) with slots for screen-specific actions (expand chevron vs. triage buttons, FindingFixButton). Render triage badges in SessionDetail for parity.

## 10. Session "Timeline" plays backwards — newest event first under a chronological rail
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/game-director/SessionDetail.tsx:338`
- **Scenario**: The Timeline tab draws a vertical rail with dots — the universal visual grammar for "read top-to-bottom in time order" — but `getEvents` returns `ORDER BY timestamp DESC` (game-director-db.ts:334-336), so the session ends at the top and "Session started" is the last row. Users reading the playtest narrative ("launched → explored → found bug → finished") read it inverted, and the staggered entrance animation reinforces the wrong direction.
- **Root cause**: A feed-style DESC query (sensible for `LIMIT 100`) is rendered with timeline visuals that imply ASC chronology; nobody reverses the rows for display.
- **Impact**: Comprehension cost when reconstructing what the agent did and in what order — the tab's entire purpose.
- **Fix sketch**: Keep the DESC query for the limit window but reverse before render (`[...events].reverse()` in `TimelineView`), or order ASC with a windowed subquery; optionally add timestamp group headers.
