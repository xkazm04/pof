# App Shell & Navigation — Bug + UI Scan

> Total: 10

> Note on context-map drift: 5 of the 13 scoped files have been refactored from
> single files into folders — `SidebarL2.tsx` -> `SidebarL2/{index.tsx, useSidebarL2.ts,
> helpers.ts, constants.ts, ProgressRing.tsx, StatusBadge.tsx}`, `TopBar.tsx` ->
> `TopBar/{index.tsx, useTopBar.ts, ProjectDropdown.tsx, ProjectRow.tsx, ProjectStats.tsx,
> NotificationBadge.tsx, PofBridgeIndicator.tsx, constants.ts}`, `ModuleRenderer.tsx` ->
> `ModuleRenderer/{index.tsx, registry.tsx, helpers.ts}`, `GlobalSearchPanel.tsx` ->
> `GlobalSearchPanel/{index.tsx, useGlobalSearchPanel.ts, SearchResultRow.tsx, helpers.ts,
> constants.ts}`, `ActivityFeedPanel.tsx` -> `ActivityFeedPanel/{index.tsx, EventCard.tsx,
> CollapsedGroup.tsx, helpers.ts, constants.ts, types.ts}`. All files in each resulting
> folder were read in full. `src/components/layout/ResizeHandle.tsx` does not exist
> anywhere in the tree (under any name) — the L2 sidebar's resize handle is implemented
> inline inside `SidebarL2/index.tsx` + `useSidebarL2.ts` instead of as a standalone
> component; there is no separate `ResizeHandle` to audit. Also worth flagging:
> `src/app/page.tsx` now gates on a `readShellPref` preference and renders `NewHome`
> (the `/layout` lab shell) by default — `AppShell` is reachable only via the "Legacy
> shell" preference — so this scoped `AppShell`/`Sidebar`/`TopBar` tree is the *secondary*
> shell today, not the default landing experience.

## Bug findings

### 1. Global search results can be overwritten by a slower, older request
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout/GlobalSearchPanel/useGlobalSearchPanel.ts:80-99
- **Scenario**: User types "phys" (fires a debounced fetch for "phys"), then quickly types "physics" before the first request resolves. If the network/DB happens to answer the "phys" request after the "physics" request (out-of-order resolution — easy under real request latency variance, especially right after the lazy index-rebuild kicks off on panel open), `setResults` is called last with the stale "phys" result set, silently showing wrong results for the current query.
- **Root cause**: The debounce only prevents new *timers* from stacking (`clearTimeout`), but does nothing to cancel or ignore in-flight `apiFetch` calls. There is no `AbortController`, no request-id/sequence check before calling `setResults`.
- **Impact**: In a high-traffic, always-mounted global search surface, users can see search results that don't match what they typed, with no visual indication anything is wrong (loading spinner already cleared) — a classic "success theater" data race.
- **Fix sketch**: Track a monotonically increasing request id (or `AbortController`) per keystroke; only apply `setResults`/`setLastRebuilt` if the response corresponds to the latest request id, and abort the previous fetch when a new one starts.

### 2. Search index treated as "already built" after switching projects
- **Severity**: High
- **Category**: bug
- **File**: src/components/layout/GlobalSearchPanel/useGlobalSearchPanel.ts:16-68 (module-level `indexEnsuredThisSession`); src/components/layout/TopBar/useTopBar.ts:135-176 (`handleDelete`, `handleSwitchProject`, `handleNewProject`)
- **Scenario**: User opens the search palette in Project A (lazily builds the index, sets `indexEnsuredThisSession = true`), then switches to Project B via the TopBar project switcher (or deletes/resets the project). The search index is per-project SQLite data, but `indexEnsuredThisSession` is a module-scope boolean that survives the switch. Opening search again in Project B skips the lazy rebuild (`if (!indexEnsuredThisSession) handleRebuild(true)`), so it queries whatever the previously-active project's index left behind until the user manually clicks "Reindex".
- **Root cause**: `indexEnsuredThisSession` is a plain module-level `let`, not reset on any of the three project-transition code paths in `useTopBar.ts` (`handleDelete`, `handleSwitchProject`, `handleNewProject`), none of which know this flag exists.
- **Impact**: Cross-project stale/incorrect search results after any project switch, silently — no error, no stale-data indicator, and the user has no reason to suspect the index needs a manual rebuild.
- **Fix sketch**: Move the "ensured this session" flag into a store (or reset it via an exported function) and call the reset from `handleSwitchProject`/`handleNewProject`/`handleDelete`, or key the flag by `projectPath` instead of being global.

### 3. "Wait for hydration" gate doesn't actually wait for anything
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/layout/AppShell.tsx:55-60; src/components/layout/SidebarL2/useSidebarL2.ts:41-46
- **Scenario**: Both call `useSyncExternalStore(() => () => {}, () => true, () => false)` — the subscribe callback is a no-op that never actually attaches to zustand's persist `onFinishHydration`/`onRehydrateStorage` events. It merely returns `false` on the server and `true` after the first client render, regardless of whether the persisted store has actually finished reading/parsing localStorage.
- **Root cause**: The comment ("Wait for Zustand persist to rehydrate from localStorage") describes intended behavior, but the implementation is just an SSR/CSR mismatch trick (flips true on mount) — it does not subscribe to the real persist middleware's hydration completion event.
- **Impact**: On a slow/huge localStorage payload (or a device with slow synchronous storage access), the shell can render as "hydrated" (fading in the real UI, showing `SetupWizard` vs. main shell based on `isSetupComplete`) before the persisted values have actually loaded, causing a visible flash of default/incorrect app state (e.g., briefly showing the setup wizard for an already-configured project, or the width-readout portal mounting against a not-yet-restored sidebar width).
- **Fix sketch**: Use zustand persist's actual `hasHydrated()` state / `onFinishHydration` subscription (most zustand persist setups expose a `_hasHydrated` flag) as the `useSyncExternalStore` source instead of a synthetic post-mount flip.

### 4. Activity feed's "Earlier this week" bucket is unreachable on Sundays
- **Severity**: Low
- **Category**: bug
- **File**: src/components/layout/ActivityFeedPanel/helpers.ts:6-17
- **Scenario**: `weekStart = todayStart - (now.getDay() * 86_400_000)`. When `now.getDay() === 0` (Sunday), `weekStart === todayStart`, so the range `[weekStart, todayStart)` for "Earlier this week" is empty. Any event from earlier in the current week (Mon–Sat) that isn't from "Today" or "Yesterday" incorrectly falls through to "Older" every Sunday.
- **Root cause**: Off-by-zero in the week-start calculation for the day the week itself starts (`getDay()===0`), not accounted for as a boundary case.
- **Impact**: Activity feed's section grouping silently mis-files events on one day out of seven, undermining the "at a glance recency" purpose of the grouping (minor but real, and it's a clock/calendar edge case that will recur every week).
- **Fix sketch**: Special-case `now.getDay() === 0` (treat as start of a new week, so nothing this week other than today qualifies) or clarify the intended semantics (ISO week vs. calendar week) and adjust accordingly.

### 5. "Copy error" button has no error handling and no success feedback
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/layout/ModuleErrorBoundary.tsx:34-39
- **Scenario**: `handleCopyError` calls `navigator.clipboard.writeText(text)` without `await`, without a `.catch`, and without any success toast/indicator. In a non-secure context, a browser that blocks clipboard writes without a permission prompt, or simply a rejected clipboard-write promise (common in some sandboxed/embedded webviews), the click silently does nothing — no error surfaces (unhandled promise rejection only in the console), and even on success the user gets zero visual confirmation the error text was copied.
- **Root cause**: Fire-and-forget async call with no result handling in either direction — a caught-and-forgotten (or rather, never-caught) failure path plus success-theater-by-omission (no feedback either way).
- **Impact**: A user hitting a module crash — already a stressful moment — clicks "Copy" to paste the error into a bug report/chat and gets no confirmation it worked; if it silently failed, they'll paste nothing and not know why.
- **Fix sketch**: `await` the write, wrap in try/catch, and show a toast (the app already wires up `sonner`'s `Toaster` in `layout.tsx`) on both success and failure paths.

## UI findings

### 6. TopBar has no overflow strategy for its growing button row
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout/TopBar/index.tsx:96-105
- **Scenario**: The right-hand cluster stacks up to 7 elements when fully set up: `Studio3DLink`, `ExperimentLabLink`, `NewShellButton`, `SearchTrigger`, `ProjectStats`, `PofBridgeIndicator`, a static "UE5 + C++" label, plus `NotificationBadge` — all in one non-wrapping `flex items-center gap-3` row with only text labels (not icons) hidden below `sm`.
- **Root cause**: No `overflow-x-auto`, no responsive collapsing into a menu, and no priority order for which controls survive at moderate widths — every control assumes there's always room.
- **Impact**: On laptop/tablet-class viewports (not just phones) the row will visually crowd or clip, and because this is the always-mounted top bar, the crowding is present on every screen in the app.
- **Fix sketch**: Give the header row `overflow-x-auto` (matching the pattern already used in `CLIBottomPanel`/`CLITabBar`/search filter chips) or collapse the three static nav links (`Studio3DLink`, `ExperimentLabLink`, `NewShellButton`) into a single "More" menu below a breakpoint.

### 7. CLI tab labels have no tooltip on truncation, unlike every other truncated label in the shell
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout/CLITabBar.tsx:88-99
- **Scenario**: The tab label is a plain `<span className="truncate">{session.label || tabId}</span>` — long session labels ellipsize with no way to read the full name except entering rename mode (double-click). Elsewhere in the same context (`SidebarL2` module labels, `ActivityFeedPanel` event titles/group labels), the shared `TruncateWithTooltip` component is used specifically to solve this.
- **Root cause**: `CLITabBar` doesn't reuse the app's own `TruncateWithTooltip` pattern, so it's the one truncated label in the shell without a hover affordance.
- **Impact**: Minor but real inconsistency — users with descriptively-named terminal tabs ("Blueprint Transpiler Debug Session") can't see the full name without triggering rename mode, unlike anywhere else truncation happens in the shell.
- **Fix sketch**: Wrap the tab label span in `TruncateWithTooltip` (already imported elsewhere in this same context) for parity.

### 8. Sidebar-resize width readout can render off-screen near viewport edges
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/layout/SidebarL2/index.tsx:157-186
- **Scenario**: The floating "width readout" pill is portaled to `document.body` and positioned with `left: cursor.x + 16, top: cursor.y - 14`, with no clamping against `window.innerWidth`/`innerHeight`. Since the L2 sidebar sits at the left edge of the shell and the handle is dragged rightward (increasing width, moving the cursor rightward), on narrow browser windows or when the user drags past `SIDEBAR_MAX` toward the right edge, the pill can be partially or fully clipped off the visible viewport.
- **Root cause**: No boundary/collision detection on the portal's absolute position — it trusts the cursor position unconditionally.
- **Impact**: The one piece of real-time feedback during a resize drag (the live px readout, plus its accent-color snap-point cue) can become unreadable exactly in the wide-sidebar case, undermining the polish the rest of the interaction clearly aimed for (snap pulses, spring transitions, reduced-motion handling).
- **Fix sketch**: Clamp `left`/`top` against `window.innerWidth - pillWidth` / `window.innerHeight - pillHeight` (or flip the pill to the left of the cursor when near the right edge), matching the care already put into the snap/pulse/keyboard-resize logic in the same file.

### 9. Two nearly-identical "nothing to show" states in one context look and feel different
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout/ModuleRenderer/index.tsx:77-92 vs src/components/layout/ActivityFeedPanel/index.tsx:111-120
- **Scenario**: `ModuleRenderer`'s empty state (no category/module selected) is a bare centered heading + one line of muted text. `ActivityFeedPanel`'s empty state (no events yet) has a bordered icon tile, a heading, and descriptive body copy. Both are "nothing here yet" states living in the same shell context, but only one gets the fuller treatment.
- **Root cause**: No shared "empty state" component/pattern is used across the shell — each panel invented its own layout independently.
- **Impact**: Inconsistent visual weight/polish for conceptually identical situations undermines the sense of a single coherent design system across the always-mounted shell.
- **Fix sketch**: Extract a shared `EmptyState` primitive (icon tile + heading + description, as `ActivityFeedPanel` already does) and use it for `ModuleRenderer`'s welcome screen too.

### 10. Global search's filter-chip row can silently overflow with no scroll affordance
- **Severity**: Low
- **Category**: ui
- **File**: src/components/layout/GlobalSearchPanel/index.tsx:81-122
- **Scenario**: The filter chip row (`All` + 5 type chips) plus the right-aligned "Reindex" button all live in one `overflow-x-auto` flex row with no scrollbar styling, no edge-fade gradient, and no scroll-shadow cue. On a narrower panel (e.g. the `max-w-xl` panel on a smaller viewport, or once localization lengthens chip labels), chips can be pushed off-screen to the left of "Reindex" with nothing visually indicating there's more to scroll to.
- **Root cause**: Bare `overflow-x-auto` with no affordance — same gap pattern as finding #6 but here it's more discoverable-critical since filter chips are a primary interaction, not a secondary nav link.
- **Impact**: Users may not realize additional filter types exist beyond what's visible, effectively hiding filtering functionality behind an undiscoverable scroll.
- **Fix sketch**: Add a subtle fade/gradient mask at the scrollable edges (common pattern for horizontally-scrolling chip rows), or wrap `Reindex` onto its own row on narrow widths instead of sharing the scroll container.
