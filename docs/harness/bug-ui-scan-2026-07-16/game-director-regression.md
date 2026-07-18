# Game Director & Regression — Bug + UI Scan

> Total: 10

## Bug findings

### 1. Snoozed findings never automatically expire and reappear
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-director/FindingsExplorer/FindingCard.tsx:44-52 (snooze write path); no read-side consumer exists anywhere in src/lib/regression-tracker.ts or src/lib/game-director-db.ts
- **Scenario**: A tester snoozes a "critical" finding for 7 days via the Snooze action. `snoozedUntil` is written to the DB (`game-director-db.ts:227/248/262`) but a repo-wide search (`grep -rn "snoozedUntil"`) shows the value is only ever written, never read back to compare against `Date.now()`. Ninety days later the finding is still `triageStatus: 'snooze'` and is permanently excluded from the "Open" filter in FindingsExplorer (`triageFilter === 'open'` only matches `active`/`confirmed`).
- **Root cause**: The snooze feature stores an expiry timestamp but no scheduled job, page-load check, or API path ever compares it to the current time to flip the status back to `active`.
- **Impact**: A genuinely unresolved critical/high bug silently vanishes from the team's "open findings" view forever after the snooze window — the exact "success theater" failure mode (feature *looks* time-bounded but isn't).
- **Fix sketch**: On read (list/stats/filter) or via a lightweight migration step in `getAllFindings`/`listFindings`, compare `snoozedUntil` to now and auto-revert `triageStatus` to `'active'` (clearing `snoozedUntil`) before returning results, or run the check in `updateTriage`'s companion read path.

### 2. "Browse" build-path button is a dead control
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-director/NewSessionPanel/index.tsx:102-108
- **Scenario**: User clicks the folder-icon button next to the Build Path input, expecting a native file/folder picker (it has `aria-label="Browse for build folder"` and looks fully interactive with hover states).
- **Root cause**: The `<button>` has no `onClick` handler at all — it is purely decorative but styled and labeled as functional.
- **Impact**: Silent failure with no error, toast, or visual feedback; users may assume the app is frozen or that their click "did nothing important" and lose trust in the rest of the form's affordances.
- **Fix sketch**: Wire it to an Electron/Tauri-style native folder dialog (if available in this app's shell) or remove/disable the button with a tooltip explaining manual path entry is required until the picker ships.

### 3. Triage note carries over across unrelated status changes
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-director/FindingsExplorer/FindingCard.tsx:57-72
- **Scenario**: A finding is marked "False positive" with note "Not reproducible on latest build." Later the tester reopens it and clicks "Confirm" (because it *did* reproduce) or "Ignore" for an unrelated reason. `requestTriage` pre-fills the note editor via `setDraftNote(finding.triageNote)` — the stale "Not reproducible" text appears under the new action's label, and if the tester clicks Save without editing, it's persisted as the note for the *new* triage state.
- **Root cause**: `draftNote` is seeded unconditionally from the previous `finding.triageNote` regardless of which triage transition is being made, with no indication to the user that the text is leftover from a different decision.
- **Impact**: Misleading audit trail — a finding can end up "Confirmed" with a note that says it's not reproducible, confusing whoever reads triage history later.
- **Fix sketch**: Clear `draftNote` (or clearly label it "previous note") when the target `triageStatus` differs from the finding's current stored reasoning, only reusing it verbatim when re-editing the *same* status.

### 4. Fix-dispatch tracking failures are swallowed with no user-visible signal
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/game-director/SessionDetail/index.tsx:60-67 and src/components/modules/game-director/FindingsExplorer/index.tsx:75-82
- **Scenario**: `markFixDispatched` throws (network blip, 500, etc.) after a one-click fix has already been sent to the CLI task runner. Both call sites do `catch { /* best-effort */ }` with zero logging and zero UI feedback.
- **Root cause**: The "detect → fix" stamping is treated as fire-and-forget, but there is no distinction surfaced to the user between "stamped successfully" and "silently failed to stamp" — both look identical (finding UI just doesn't change).
- **Impact**: Over time, findings that were actually fixed lose the audit trail linking them to the dispatched repair task, and nobody is ever told this happened — a classic caught-and-forgotten error.
- **Fix sketch**: At minimum `console.warn` or route through the existing `InlineErrorRetry`/toast pattern already used elsewhere in this context (e.g. `RegressionTrackerView`'s `actionError`) so a failed stamp is visible and retryable instead of invisible.

### 5. Partial regression-tracker refresh failure leaves the dashboard internally inconsistent
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-director/RegressionTrackerView/index.tsx:75-97
- **Scenario**: `handleProcess` calls `processSession` (POST), succeeds, and calls `setLastReport(report)`. It then calls `await refresh()`, which does five parallel fetches; if any one of `fingerprints`/`alerts`/`stats`/`sessions` throws, the whole `Promise.all` rejects before any of `setFingerprints/setAlerts/setStats/setSessions` run, but `lastReport` (from the successful process call) is already committed to state.
- **Root cause**: `lastReport` and the four `refresh()`-driven collections are updated on independent success/failure paths inside the same handler, with no rollback or reconciliation if one half fails.
- **Impact**: The UI shows a brand-new "Report: SessionX — 2 regressions detected" card while the Dashboard's top-line stats, the Alerts tab, and the Fingerprints tab still reflect the pre-processing snapshot (e.g. Alerts tab shows 0 active alerts even though the report just said 2 regressions were found) — until the user notices the inline error and manually retries.
- **Fix sketch**: Only commit `setLastReport` after `refresh()` also succeeds, or clearly badge the report card as "pending sync" until the four collections refresh successfully.

## UI findings

### 6. Inconsistent "active filter" visual language in the same toolbar
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-director/FindingsExplorer/index.tsx:153-191
- **Scenario**: The Triage filter group (Open/All/Triaged) and the Severity filter group (All/Critical/High/…) sit side-by-side in one toolbar. Triage's active state is `bg-border text-text` (neutral grey highlight); Severity's active state is `bg-border` + a per-severity `color` (orange/red/etc.) applied only to text, with no background tint difference from the inactive triage buttons.
- **Root cause**: Two adjacent, structurally identical button groups use two different rules for signaling "this is the selected option," so at a glance it's unclear which severity (if any) is currently active versus which is merely colored.
- **Impact**: Users scanning the toolbar can misread "no severity filter selected" as "one is selected" or vice versa, especially for low-saturation severities like "low"/"positive".
- **Fix sketch**: Give both groups the same active-state treatment (e.g. a shared `background: color+opacity, border: color+opacity` pattern already used elsewhere in this context, such as `FindingCard`'s `TriageButton`).

### 7. No empty/disabled-state messaging on the regression "Analyze Session" bar
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-director/RegressionTrackerView/index.tsx:182-203
- **Scenario**: Before any playtest session has completed, `sessions` is empty; the `<select>` shows only the placeholder "Select a completed session..." and the "Analyze" button is disabled via `!selectedSessionId`. Nothing tells the user *why* — it looks identical to the state where sessions exist but none is chosen yet.
- **Root cause**: The component has no branch for `sessions.length === 0` distinct from "sessions exist, pick one."
- **Impact**: A new user with zero completed sessions can't tell whether the feature is broken, still loading, or just waiting for input — every other empty state in this same context (FindingsExplorer, TimelineView, CoverageView, FingerprintsTab, AlertsTab) uses the shared `EmptyState` component with actionable copy, making this bar the one inconsistent, under-explained control in the whole module.
- **Fix sketch**: When `sessions.length === 0`, swap the select+button row for a short inline hint ("Complete a playtest session first") consistent with the `EmptyState` copy style used everywhere else in this context.

### 8. Snooze action gives no visible expiry/duration in the UI
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-director/FindingsExplorer/FindingCard.tsx:46-51,91-99 and src/lib/game-director-styles.ts:86
- **Scenario**: After snoozing, the only visible indicator is a static "Snoozed" chip (`TRIAGE_TOKENS.snooze.label`) — the actual `snoozedUntil` date computed at snooze-time (now + 7 days) is stored but never rendered anywhere in `FindingCard` or `FindingsList`.
- **Root cause**: The chip surfaces the triage *status* but not the *data* (expiry date) that made snoozing meaningful in the first place.
- **Impact**: Combined with Bug #1 (snoozes never auto-expire), the user has no way to even manually judge "is this due to resurface soon?" — compounding the invisibility of the snooze lifecycle.
- **Fix sketch**: Render `Snoozed until {new Date(finding.snoozedUntil).toLocaleDateString()}` next to the chip whenever `triageStatus === 'snooze'`.

### 9. Settings row in NewSessionPanel isn't responsive while the row above it is
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-director/NewSessionPanel/index.tsx:124 (Test Categories grid) vs. 161 (Settings row grid)
- **Scenario**: The Test Categories grid explicitly degrades for small screens (`grid-cols-2 sm:grid-cols-4`), but the Settings row directly below it (Playtime / Screenshots / Aggressive) is hard-coded to `grid-cols-3` with no `sm:`/`md:` variant.
- **Root cause**: Only one of the two sibling sections in the same panel was given a mobile breakpoint; the other was left at a fixed 3-column layout.
- **Impact**: On narrow viewports each of the three columns (label + tooltip icon + slider + value, or label + toggle button) gets compressed into a very tight column, causing slider thumbs, tooltip info-icons, and value labels to crowd together — while the section just above it gracefully reflows to 2 columns.
- **Fix sketch**: Apply the same `grid-cols-1 sm:grid-cols-3` (or similar) pattern used one section up, for consistency and to avoid cramped controls on mobile.

### 10. Dead "Browse" button also reads as a UI/affordance inconsistency
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-director/NewSessionPanel/index.tsx:102-108
- **Scenario**: Every other icon-only button in this context (`ArrowLeft` back button in SessionDetail, `X` dismiss in AlertsTab/FindingCard, `Trash2` delete in SessionDetail) has a working handler and a hover-state color shift tied to its action. The `FolderOpen` Browse button matches the same visual pattern (border, hover `text-text`, `aria-label`) but performs no action, breaking the implicit "if it looks like these other buttons, it works like them" convention established elsewhere in the module.
- **Root cause**: Same missing `onClick` as Bug #2, listed separately here because — independent of the functional bug — it also violates the context's established button-affordance pattern (every clickable-styled icon button elsewhere does something).
- **Impact**: Erodes trust in the rest of the icon-button vocabulary used throughout Game Director (Delete, Back, Dismiss, Resolve, etc.) since one of them is a decoy.
- **Fix sketch**: Same as Bug #2 — implement the handler or visually demote the control (e.g. muted/disabled styling with a "coming soon" tooltip) so it no longer matches the "functional icon button" visual class it currently belongs to.
