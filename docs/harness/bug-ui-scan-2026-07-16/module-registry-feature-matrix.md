# Module Registry & Feature Matrix — Bug + UI Scan

> Total: 9

> Note on context-map drift: `src/components/modules/core-engine/FeatureMatrix.tsx` no longer exists — it was refactored into `src/components/modules/shared/FeatureMatrix/` (18 files: index.tsx, useFeatureMatrixState.ts, helpers.ts, types.ts, constants.ts, FeatureList.tsx, FeatureRowItem.tsx, SummaryBar.tsx, StatusFilterChips.tsx, QualitySparkline.tsx, ReviewProgressBar.tsx, SortButton.tsx, QualityRangeFilter.tsx, VerificationBadge.tsx, VerificationSummaryBanner.tsx, NeverReviewedState.tsx, FeatureMatrixSkeleton.tsx, DependencyChain.tsx, QualityStars.tsx) — all read in full. Similarly `src/components/modules/shared/FeatureCard.tsx` no longer exists at that path — the live component is `src/components/shared/FeatureCard.tsx` (plus its sibling `FeatureCardGrid.tsx`), both read in full.

## Bug findings

### 1. Switching modules fast can splice stale feature data into the new module's view
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/useFeatureMatrix.ts:36-49,94-106
- **Scenario**: User opens Module A's Feature Matrix (triggers `fetchData` for A), then within ~1s navigates to Module B (LRU-cached tabs make this fast). A's slower `/api/feature-matrix?moduleId=A` response arrives after B's, because of network jitter/server load.
- **Root cause**: `fetchData` (lines 36-49) unconditionally calls `setFeatures`/`setSummary` on whatever response resolves, with no per-request token or `AbortController`. The `cancelled` flag set up in the mount effect (lines 94-106) is checked only inside `init().then()`, which does nothing with the flag — it never gates the `setFeatures`/`setError` calls inside `fetchData` itself. Since `fetchData` is recreated only when `moduleId` changes (useCallback dep), the async body captures whichever `moduleId` was current when invoked, but there's no guard preventing an older, slower request's result from overwriting a newer request's state after the hook has already moved on to a different module.
- **Impact**: The Feature Matrix (and its summary, verification results) can briefly — or persistently, if the race keeps recurring — show Module A's features while the header/URL indicates Module B, misleading the user about verification/implementation status of the wrong module.
- **Fix sketch**: Track an incrementing request id (or `AbortController` per `moduleId`) inside `fetchData`; only apply `setFeatures`/`setSummary`/`setError` if the request id/moduleId matches the latest one issued, and abort/ignore the previous in-flight request when `moduleId` changes.

### 2. Concurrent Feature Matrix mounts for the same module can double-POST the seed request
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useFeatureMatrix.ts:51-76,111-116
- **Scenario**: The module view is LRU-cached (per `useFeatureMatrixState.ts` comments about "Pauses when module is suspended (hidden in LRU)"), so it's possible for two independent mounts/instances tied to the same `moduleId` to run their own `useFeatureMatrix` hook and both observe an empty `features` array on first load simultaneously (e.g. a background prefetch plus a foreground tab).
- **Root cause**: `seededRef` (line 34) is a `useRef` scoped to a single hook instance, not a module-scoped or global lock. Each hook instance independently decides "I haven't seeded moduleId yet" and fires its own `POST /api/feature-matrix` seed request. The client-side guard cannot prevent two instances from racing the same insert-if-missing check on the server unless that check is provably atomic (single SQL upsert) — nothing in this file guarantees that, and the comment only documents the *intended* safety property (seedOnly won't clobber review data), not concurrency-safety.
- **Impact**: Best case, redundant network calls; worst case (if the server-side seed isn't a single atomic upsert), a duplicate-insert race that creates two rows per feature name for the module, corrupting the feature matrix until manually cleaned up.
- **Fix sketch**: Promote the "seeded" tracking to a module-scoped (not hook-instance-scoped) in-flight map (e.g. a `Set` on `globalThis` keyed by `moduleId`), or rely solely on a server-side atomic upsert and drop the client-side dedupe assumption.

### 3. CLI prompt dispatch uses a fixed timeout guess and silently drops the prompt if the terminal isn't mounted yet
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useModuleActions.ts:36-41
- **Scenario**: `sendPromptToModule` creates a new CLI session then does `setTimeout(() => dispatchEvent(...), UI_TIMEOUTS.mountDelay)`. On a slow render (large component tree, background tab throttling, or a cold module mount), the terminal component's event listener may not have attached yet when the timeout fires.
- **Root cause**: There is no acknowledgment/handshake between "terminal mounted and listening" and "dispatch the prompt" — it's a blind fixed delay, and `window.dispatchEvent` of a `CustomEvent` with no listener is a silent no-op (no error, no log).
- **Impact**: The user's prompt is lost with zero feedback — the CLI tab opens but the prompt they attempted to send never appears, and there's no retry or timeout-exceeded warning surfaced to the user.
- **Fix sketch**: Have the terminal component emit a "ready" event (or resolve a promise/ref callback) once its listener is attached, and queue/replay the prompt dispatch off that signal instead of a fixed timer; alternatively buffer pending prompts per `tabId` and flush them when the terminal announces readiness.

### 4. QualitySparkline SVG gradient ids collide across concurrently-mounted modules sharing an accent color
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/shared/FeatureMatrix/QualitySparkline.tsx:45,53
- **Scenario**: Two module tabs that share the same category accent color (accent colors are drawn from a small fixed palette per category, so collisions across modules are common) are both mounted at once (LRU-cached tabs), each rendering its own `QualitySparkline`.
- **Root cause**: The gradient `id` is derived only from `accentColor.replace('#', '')` (line 45), with no per-instance uniqueness (e.g. `useId()`). Multiple `<linearGradient>` elements in the same document end up with identical `id` attributes, which is invalid SVG/HTML; browsers resolve `url(#id)` references to *some* matching node, and known browser bugs (notably WebKit/Safari) will blank or misrender a gradient fill when a same-id `<defs>` node is added/removed elsewhere in the DOM (e.g. the other tab unmounts).
- **Impact**: Sparkline area fill can flicker, disappear, or render with the wrong module's gradient stops when a sibling tab with the same accent color mounts/unmounts.
- **Fix sketch**: Generate the gradient id with React's `useId()` (or a per-render unique suffix) instead of deriving it solely from the accent color string.

### 5. Clipboard-copy action has an unhandled promise rejection path
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/shared/FeatureMatrix/FeatureRowItem.tsx:47-53
- **Scenario**: `handleCopy` calls `await navigator.clipboard.writeText(text)` with no try/catch. In a non-secure context, when clipboard permission is denied, or in some embedded/iframe contexts, this promise rejects.
- **Root cause**: No error handling around the clipboard write; the `useCallback` body has no try/catch, so a rejection becomes an unhandled promise rejection.
- **Impact**: The "Copied!" tooltip/checkmark never appears (the user thinks the click did nothing) and the console shows an unhandled rejection with no user-facing explanation of why copying failed.
- **Fix sketch**: Wrap the `writeText` call in try/catch; on failure, show a distinct "copy failed" affordance (or fall back to a `document.execCommand('copy')`/manual-select path) instead of silently doing nothing.

## UI findings

### 6. Sticky category headers use a hardcoded pixel offset that breaks when the filter row wraps
- **Severity**: High
- **Category**: ui
- **File**: src/components/modules/shared/FeatureMatrix/FeatureList.tsx:74 (paired with src/components/modules/shared/FeatureMatrix/index.tsx:204)
- **Scenario**: The search/filter/sort control row in `index.tsx` (line 204) is `flex flex-wrap` and `sticky top-0`; on narrow viewports or with many active filters, it wraps to two (or three) lines, growing taller than the ~40px the category headers assume they need to clear.
- **Root cause**: `FeatureList.tsx` hardcodes `sticky top-[40px]` for category headers, assuming the sticky control row above it is always exactly one line tall. There is no dynamic measurement (e.g. `ResizeObserver`, CSS `scroll-margin`, or a shared sticky-stack utility) tying the two together.
- **Impact**: On mobile widths or when several filter chips/search text are active, the wrapped control row overlaps or leaves a gap against the category header, and the sticky category header can end up hidden behind or overlapping the search bar while scrolling — a real regression in the "sticky nav" UX the code is explicitly trying to build.
- **Fix sketch**: Measure the actual height of the sticky control row (ref + `ResizeObserver`, or CSS `position: sticky` with `top: var(--controls-height)` set from JS) rather than hardcoding `40px`; or use CSS `scroll-margin-top`/stacked sticky offsets that derive from the real element instead of a magic number.

### 7. Row hover-actions (Review/Copy/View files) are only discoverable on hover, invisible on touch devices
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/shared/FeatureMatrix/FeatureRowItem.tsx:113-149
- **Scenario**: A tablet/touch user (this is a game-dev tool, plausibly used on a Surface-type device with a touchscreen alongside a mouse) taps a feature row expecting to find the "Review with Claude", "Copy", or "View source files" actions.
- **Root cause**: The action button group is `opacity-30 ... group-hover/row:opacity-100` — full visibility is gated entirely behind CSS `:hover`, which touch input never triggers (there's no `:focus-within` or tap-to-reveal fallback, and the buttons remain functionally reachable only via low-contrast 30%-opacity icons that are hard to see, let alone know are interactive).
- **Impact**: Touch/no-hover users effectively cannot discover these three actions exist; even if they can tap them blindly (some browsers simulate a hover-then-click on first tap), the affordance is not communicated.
- **Fix sketch**: Also reveal the action group on `:focus-within` (already partially supported via `tabIndex`/keyboard) and raise the resting opacity for coarse-pointer contexts, e.g. `@media (hover: none) { opacity: 1 }` or `pointer:coarse` Tailwind variant, so touch users get a persistently visible (if lower-emphasis) action row.

### 8. FeatureCard's inactive-state text color may fail contrast against its own translucent background
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/shared/FeatureCard.tsx:36-45
- **Scenario**: An inactive `FeatureCard` renders `opacity: 0.65` on the whole button plus `color: STATUS_NEUTRAL` text over a `transparent` background (which shows the page background behind it) with a border also at reduced opacity (`OPACITY_20`).
- **Root cause**: Applying `opacity: 0.65` to the entire card (not just a filter on non-text decoration) compounds with `STATUS_NEUTRAL`'s own contrast ratio, effectively multiplying the text's already-muted color by another 0.65 alpha against a background whose color depends on whatever is behind the grid (which the component doesn't control). No contrast check anchors this combination to a WCAG AA minimum in either light or dark theme.
- **Impact**: On the light theme in particular (STATUS_NEUTRAL colors are typically tuned for dark surfaces), inactive card names/summaries can drop well below 3:1, making disabled/inactive features hard to read — worse, since "inactive" here is a normal, expected, frequently-seen state (not a disabled/rare one), this isn't a cosmetic nit but a real legibility gap for a core piece of UI.
- **Fix sketch**: Drop the whole-button `opacity` in favor of applying reduced opacity only to non-text chrome (border/background), and verify the text color combination independently meets 4.5:1 (or 3:1 for the small/bold mono label) against both theme backgrounds.

### 9. Quality range min/max selects silently "fix" invalid ranges with no transition or explanation
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/shared/FeatureMatrix/QualityRangeFilter.tsx:28-32,42-46
- **Scenario**: User sets max to 2 while min is already 4 (or vice versa); `onMinChange`/`onMaxChange` immediately snaps the *other* select to match, with no animation, message, or visual cue that a second value just changed underneath the user.
- **Root cause**: The auto-correction (`if (v > max) onMaxChange(v)`) mutates the sibling select's value as a side effect of the handler, but the UI gives no feedback distinguishing "you changed this" from "we also changed that for you" — both selects just silently show new values.
- **Impact**: Minor but real UX confusion: a user adjusting one dropdown sees a second, unrelated-looking dropdown value change with no explanation, which reads as a glitch rather than intentional range-clamping behavior.
- **Fix sketch**: Either disable/gray out the values that would create an invalid range (prevent the situation rather than auto-correcting after the fact), or add a brief highlight/transition on the sibling select when it's auto-adjusted so the causality is visible.
