# Session Analytics & Telemetry — Bug + UI Scan

> Total: 8

## Bug findings

### 1. Genre scan failures are completely silent — no error surfaced to the user
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/useGenreEvolution.ts:60-65 (scanProject catch block) and src/components/modules/core-engine/TelemetryEvolution/index.tsx:23-26 (handleScan)
- **Scenario**: User clicks "Scan Project" on a project whose path is stale/unreadable, or the `/api/telemetry` POST 500s. `apiFetch` throws, `scanProject`'s `catch { return null; }` swallows it (no `console.error`, no rethrow), and `handleScan` in the component does `await scanProject(...)` without inspecting the return value.
- **Root cause**: Error handling collapses every failure mode (network error, validation error, server error) into a silent `null` with zero logging or UI feedback, and the caller discards the result entirely.
- **Impact**: The button flips from "Scanning..." back to "Scan Project" and nothing else happens — indistinguishable from "scan found nothing new." Users will retry repeatedly or conclude the feature is broken, and there is no log trail to diagnose what failed.
- **Fix sketch**: Have `scanProject` rethrow or return a `{ error }` shape (and log via `console.error`), and have `TelemetryEvolution` track an error state to render via the existing `FetchError`/inline-alert pattern used elsewhere in the same context.

### 2. Suggestion Accept/Dismiss buttons have no in-flight guard — double-submit race
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/TelemetryEvolution/SuggestionsList.tsx:131-149; src/hooks/useGenreEvolution.ts:68-78 (resolveSuggestion)
- **Scenario**: User double-clicks "Accept Evolution" (or clicks Accept then quickly Dismiss before the first request's `refresh()` resolves). Both `onResolve` calls fire independent POSTs with the same `suggestionId` and different `resolveAction` values; there's no `disabled` state on the buttons and no request de-duplication.
- **Root cause**: `resolveSuggestion` has no in-flight tracking (unlike `scanning` for `scanProject`) and the buttons aren't disabled during the request; `resolveSuggestion` also has no try/catch, so a failed request is an unhandled rejection with zero user feedback.
- **Impact**: Possible duplicate/contradictory resolutions of the same suggestion server-side, and if the request throws, the failure is invisible — the row just sits there looking unresolved with no error, inviting more repeated clicks.
- **Fix sketch**: Add a per-suggestion `resolving` state (or reuse a Set of in-flight IDs) to disable both buttons while a resolve is pending, and wrap `resolveSuggestion` in try/catch to surface failures.

### 3. Debounced prompt-suggestion fetches can resolve out of order (stale response wins)
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useSessionAnalytics.ts:78-97 (usePromptSuggestions.fetchSuggestions)
- **Scenario**: User types a prompt, pauses just past the 500ms debounce so a fetch for "make a dungeon" fires, then keeps typing; a second debounced fetch for "make a dungeon boss" fires later. If the first request's network round-trip is slower than the second's (e.g., server cold path vs cached path), its `.then` resolves after the second and calls `setSuggestions(data.suggestions)`, overwriting the newer, currently-relevant suggestions with stale ones for the old, shorter prompt.
- **Root cause**: No request identity/AbortController/sequence check — every completed fetch unconditionally calls `setSuggestions`, regardless of whether a newer request has since superseded it.
- **Impact**: The UI can silently display suggestions for a prompt the user no longer has typed, misleading them into accepting an irrelevant suggestion.
- **Fix sketch**: Track a monotonically increasing request id (or the `prompt`/`moduleId` pair) in a ref and only apply the response if it still matches the latest dispatched request, or use `AbortController` to cancel superseded fetches.

### 4. `recordSessionOutcome` silently discards telemetry on failure with no retry/queue
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useSessionAnalytics.ts:104-127
- **Scenario**: A CLI task finishes, `recordSessionOutcome` POSTs the outcome; the request fails (transient network blip, server restart mid-deploy). The `catch` only does `console.error` — the session record is gone forever.
- **Root cause**: Fire-and-forget with no retry, no local queue/backoff, no persisted pending-write buffer.
- **Impact**: Since this is the sole ingestion path feeding `AnalyticsDashboard` (success rates, quality scores, insights all derive from recorded sessions), silent drops quietly skew the analytics the rest of the dashboard presents as authoritative — "success theater" one level removed: the dashboard looks confidently accurate while missing an unknown fraction of real sessions.
- **Fix sketch**: Add a lightweight retry (1-2 attempts with backoff) and/or a `localStorage`/IndexedDB pending-outcomes queue flushed on next mount, so a transient failure doesn't permanently lose the data point.

## UI findings

### 5. `ModuleStatsRow`'s fixed-width columns can starve the success-rate bar in the narrow evaluator panel
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/SessionAnalyticsDashboard/ModuleStatsRow.tsx:29-64
- **Scenario**: The parent `index.tsx` comment explicitly documents that the stats grid "collapses to 2 columns on the narrow evaluator panel," confirming this dashboard is rendered in a tight sidebar/panel width. `ModuleStatsRow` allocates fixed widths — chevron, `w-36` module name, the `flex-1` `StatBar`, `w-24` band label, `w-8` count — none of which shrink responsively. In a narrow container the `flex-1` bar can be squeezed to just a few pixels while the fixed columns (144px + 96px + 32px + icon) eat most of the available width.
- **Root cause**: No responsive width reduction (e.g. `sm:w-36 w-20`) or `min-w-0` truncation budget scaled to container width; all "chrome" columns are fixed while only the data-bearing bar is elastic.
- **Impact**: The visual centerpiece of the row — the success-rate bar — becomes nearly invisible exactly in the layout this component is known to run in, undermining the redundant-encoding design the code comments elsewhere are careful about (color + icon + label + bar).
- **Fix sketch**: Shrink or hide the module-name/count columns at narrow container widths (container queries or a passed-in `compact` prop), or let the bar have a `min-width` floor with the text columns truncating further first.

### 6. `TelemetryEvolution`'s bespoke `EmptyState` duplicates and diverges from the shared `@/components/ui/EmptyState` used one context over
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/TelemetryEvolution/EmptyState.tsx:1-45 vs src/components/modules/evaluator/SessionAnalyticsDashboard/index.tsx:11,54-66 (uses shared `EmptyState`)
- **Scenario**: Within the same "Session Analytics & Telemetry" context, one sibling component (`SessionAnalyticsDashboard`) reuses the shared `@/components/ui/EmptyState` (consistent icon container, title, description, action-button styling), while `TelemetryEvolution` hand-rolls its own empty state with a different icon container size (`w-14 h-14` vs shared component's presumed standard), a non-semantic `text-border-bright` class applied as an icon *content* color (borrowing a border token for a foreground icon), and its own bespoke button markup instead of a shared `Button`/action prop.
- **Root cause**: No reuse of the existing `EmptyState` primitive for a second "no data yet" screen in the same context.
- **Impact**: Two empty states with different padding, icon sizing, and color semantics ship side-by-side in the same feature area, breaking the "used consistently everywhere" promise of the design system and creating two divergent maintenance paths for what should be one pattern.
- **Fix sketch**: Refactor `TelemetryEvolution/EmptyState.tsx` to compose the shared `@/components/ui/EmptyState`, passing `icon={Dna}` and the scan button via its `action` prop the same way `SessionAnalyticsDashboard` does.

### 7. Ad-hoc alpha-suffix opacity values scattered across TelemetryEvolution instead of the shared opacity tokens used elsewhere in the same context
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/TelemetryEvolution/index.tsx:52,72-75; AcceptedGenres.tsx:44,46; SuggestionsList.tsx:61,135-137; EmptyState.tsx:17,31-33
- **Scenario**: `SessionAnalyticsDashboard` imports named tokens from `@/lib/chart-colors` (`OPACITY_10`, `STATUS_*`) and composes them (`` `${STATUS_WARNING}${OPACITY_10}` ``), but every TelemetryEvolution sub-file instead hardcodes raw two-digit hex-alpha suffixes inline: `08`, `10`, `12`, `15`, `20`, `25`, `30`, `40` all appear as bare string literals across the files with no shared constant.
- **Root cause**: The two components in the same audited context implement the "color + alpha" pattern two different ways — one token-driven, one string-literal-driven — with no single source of truth for the opacity scale.
- **Impact**: Any future rebrand or contrast-ratio fix to alpha levels requires manually greeping/updating string literals in TelemetryEvolution's five sub-files, and the two components risk visibly different translucency for what's meant to be the same "10%-tint chip" affordance.
- **Fix sketch**: Extend `@/lib/chart-colors`'s opacity constants (`OPACITY_08`, `OPACITY_12`, `OPACITY_15`, `OPACITY_20`, `OPACITY_25`, `OPACITY_30`, `OPACITY_40`) and swap the TelemetryEvolution literals to reference them, matching the pattern already established in `SessionAnalyticsDashboard`.

### 8. Bar-growth animation only ever plays once per mount, not on refetch
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/SessionAnalyticsDashboard/index.tsx:24-39
- **Scenario**: `barsAnimated` is set `true` once data first loads with `totalSessions > 0` and is never reset to `false` on a subsequent successful `refetch()` while `totalSessions` stays `>0` (e.g., user hits retry after a transient dashboard-fetch error, or the dashboard remounts after new sessions were recorded). The effect's `if (!isLoading && dashboard.totalSessions > 0)` branch calls `setBarsAnimated(true)` again, which is a no-op re-render (state unchanged), so `StatBar`'s width transition — which is presumably keyed off going from "not ready" to "ready" — never replays.
- **Root cause**: `barsAnimated` is a one-way latch with no reset path tied to a fresh data fetch (e.g., keyed by a fetch id or reset to `false` when `isLoading` transitions to `true`).
- **Impact**: The polished "bars grow in" entrance, called out deliberately in the code comments, silently stops working after the very first successful load — subsequent refresh cycles show bars appearing instantly instead of animating, an inconsistency a user comparing "before vs after retry" would notice.
- **Fix sketch**: Reset `barsAnimated` to `false` whenever `isLoading` becomes `true` (start of a fetch), so the existing effect's rAF-driven flip to `true` replays the grow-in on every successful load, not just the first.
