# Blueprint Transpiler & C++ Codegen — Bug + UI Scan

> Total: 10

> Note: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx` no longer exists as a single file — it was refactored into `BlueprintTranspilerView/` with `index.tsx`, `constants.ts`, `helpers.ts`, `ChangeCard.tsx`, `WriteToProjectButton.tsx`, `DiffPane.tsx`, `TranspilePane.tsx`. All 7 files were read in full, plus `src/hooks/useBlueprintTranspiler.ts`.

## Bug findings

### 1. Confirmed write can silently persist content that was never shown in the reviewed diff
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx:36-68
- **Scenario**: User clicks "Write to Project" → dry-run modal renders a diff computed from the *current* `header`/`source` props. While the modal is open, the user (or an auto-refresh flow) re-runs Transpile with edited Blueprint JSON in the other pane — `result.headerCode`/`sourceCode` change, so the `header`/`source` props flowing into the still-mounted `WriteToProjectButton` change too. The modal's `plan` state (the diff actually rendered) is untouched, so the user keeps looking at the old diff. Clicking "Confirm write" calls `confirmWrite`, whose `body(true)` closes over the *current* (new) `header`/`source` props, not the ones the diff was computed from.
- **Root cause**: `plan` (what's displayed) and the `header`/`source` props (what's actually sent on confirm) can diverge silently — only `moduleName` is checked for staleness (`planStale`), never the code content itself.
- **Impact**: The file written to disk does not match what the user reviewed and approved in the dry-run diff; this defeats the entire purpose of the dry-run safety gate and can silently overwrite a C++ file with unreviewed content.
- **Fix sketch**: Track a content fingerprint (e.g. hash of header+source) alongside `planModule`, and treat `planStale` as true whenever header/source diverge from what the plan was computed against — not just when `moduleName` changes.

### 2. Double-submission race between `parse()` and `transpile()`/`diff()` momentarily re-enables the action buttons
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/index.tsx:30-40 and src/hooks/useBlueprintTranspiler.ts:43-102
- **Scenario**: `handleTranspile` does `await parse(blueprintJson); await transpile(blueprintJson, ...)`. `parse()` sets `isLoading` to `false` in its own `finally` before `transpile()` sets it back to `true` in its own `try`. Between those two awaits there is a real (if brief) tick where `isLoading` is `false` and the Transpile/Diff buttons (`disabled={... || isLoading}`) are clickable again.
- **Root cause**: `isLoading` is a single shared flag toggled independently by three separate async functions instead of being derived once per compound operation; the two-network-call sequence isn't wrapped in a single loading scope.
- **Impact**: A fast double-click (or click during that window) fires a second parse/transpile with the current (possibly just-edited) textarea contents while the first is still resolving; `setAsset`/`setSummary`/`setTranspileResult` calls from both calls interleave and whichever resolves last wins, which can leave `asset`/`summary` from one Blueprint JSON paired with `transpileResult` from a different one.
- **Fix sketch**: Wrap the two awaited calls in a single `setIsLoading(true)/... /setIsLoading(false)` scope owned by the composite handler, or add a request-id/ref guard so a stale response can't clobber state from a newer request.

### 3. `WriteToProjectButton`'s module name doesn't resync when the active project changes
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx:23,16-21
- **Scenario**: `moduleName` is seeded once via `useState(defaultModule)`. `defaultModule` is `sanitizeModule(projectName)` computed fresh on every render in `TranspilePane.tsx:148`. If the user switches the active project (changing `projectName`/`projectPath` in `useProjectStore`) after already having interacted with this component (or simply after the initial mount computed a stale default), `moduleName` keeps its old value — there is no `useEffect` syncing state to the new `defaultModule` prop.
- **Root cause**: Derived-prop-as-initial-state anti-pattern with no resync effect or key-based remount.
- **Impact**: A dry-run/write can target the wrong UE module path (leftover from a previously open project) without any visual cue that the module name is stale relative to the now-active project.
- **Fix sketch**: Add `useEffect(() => setModuleName(defaultModule), [defaultModule])` guarded so it doesn't clobber a manually-typed value, or key the component by `projectPath` to force remount on project switch.

### 4. "Load Sample" silently discards unsaved input with no confirmation
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/index.tsx:42-44
- **Scenario**: User pastes/edits a large Blueprint JSON, then absent-mindedly clicks "Load Sample" (visible on both Transpile and Diff panes) — `setBlueprintJson(SAMPLE_BLUEPRINT)` overwrites the textarea instantly and irrecoverably (no undo, no draft persistence).
- **Root cause**: Destructive state replacement with no guard for pre-existing non-empty content.
- **Impact**: Silent loss of potentially large hand-authored/pasted Blueprint JSON that the user has no way to recover.
- **Fix sketch**: Skip the overwrite (or confirm) when `blueprintJson.trim()` is already non-empty and differs from the sample.

### 5. Copy-to-clipboard "Copied" timers are not cleared on unmount or rapid re-clicks
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/index.tsx:46-50
- **Scenario**: `copyToClipboard` calls `setTimeout(() => setCopiedHeader(false), UI_TIMEOUTS.copyFeedback)` with no ref tracking. Clicking "Copy" repeatedly within the timeout window schedules multiple overlapping timers, and unmounting the view before the timer fires leaves a dangling `setTimeout` callback.
- **Root cause**: No `useRef`-based timer handle to clear on subsequent calls or on unmount.
- **Impact**: Minor — flickering "Copied" state on rapid re-clicks; a harmless-but-sloppy state update after unmount in React 18 (would matter more if this pattern is copy-pasted into a class component or a stricter environment).
- **Fix sketch**: Store the timeout id in a `useRef`, clear it before scheduling a new one, and clear it in a `useEffect` cleanup.

## UI findings

### 6. DiffPane has no dedicated loading state, unlike TranspilePane
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/DiffPane.tsx (whole file) vs TranspilePane.tsx:99-104
- **Scenario**: While `isLoading` is true, `TranspilePane` shows a centered spinner + "Transpiling Blueprint graph..." message replacing the empty-state panel. `DiffPane` has no equivalent — during a diff request the only feedback is the small spinner inside the "Run Semantic Diff" button itself; the result area stays blank with no messaging.
- **Root cause**: The two sibling panes were not built to a shared loading-state pattern/component.
- **Impact**: Inconsistent perceived responsiveness between the two tabs of the same feature; users may think the Diff tab is unresponsive during a slower semantic-diff request.
- **Fix sketch**: Extract a shared `<PaneLoadingState label=... />` used by both panes, or add the same centered spinner+label block to `DiffPane` when `isLoading` and no result yet.

### 7. Dry-run confirmation modal has no keyboard escape or focus trap
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx:99-169
- **Scenario**: The modal (`fixed inset-0 z-50 ...`) only closes via a click on the backdrop or the Cancel button; there is no `onKeyDown`/Escape handler and no explicit focus management moving focus into the dialog or trapping Tab within it.
- **Root cause**: Modal was hand-rolled with only mouse interaction paths considered.
- **Impact**: Keyboard-only users cannot dismiss the modal without tabbing all the way through it to Cancel, and focus can leak to background elements while the modal is open — this is a genuine interaction gap, not merely cosmetic, given this modal gates an actual filesystem write.
- **Fix sketch**: Add an `Escape`-key listener that calls `setPlan(null)`, and trap focus within the dialog while open (or reuse a shared `Modal` primitive if one exists elsewhere in the design system).

### 8. Status colors are inconsistently hardcoded vs. sourced from design tokens
- **Severity**: Low
- **Category**: ui
- **File**: WriteToProjectButton.tsx:88,93 · TranspilePane.tsx:116,158,178 · DiffPane.tsx:94,128
- **Scenario**: `constants.ts` correctly builds `CONFLICT_STYLES` from `STATUS_SUCCESS`/`STATUS_WARNING`/`STATUS_ERROR` (from `@/lib/chart-colors`), but the surrounding panes fall back to raw Tailwind utilities (`text-green-400`, `text-red-400`, `text-amber-400`) for success/error/warning icons and text in several places instead of the same token set.
- **Root cause**: Two color sourcing strategies coexist in the same feature — token-driven inline styles for conflict badges, and hardcoded Tailwind classes for success/error/warning elsewhere.
- **Impact**: If the design system's success/warning/error hues are retuned (a themeable token change), these hardcoded spots silently drift out of sync with the rest of the app's status colors.
- **Fix sketch**: Replace `text-green-400`/`text-red-400`/`text-amber-400` occurrences with the same `STATUS_SUCCESS`/`STATUS_ERROR`/`STATUS_WARNING` tokens already imported in this feature, applied via inline `style` or a small `text-status-success` etc. utility class.

### 9. "No project path" fallback breaks the toolbar's visual language
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton.tsx:70-72
- **Scenario**: Every other control in the code-tabs toolbar (the `.h`/`.cpp` tabs, Copy button, and the normal "Write to Project" button) is a pill-shaped button with icon + label. The disabled-path fallback renders as a bare, unstyled `<span>` with only a `title` tooltip — no icon, no affordance that hovering reveals guidance, no visual parity with its enabled counterpart.
- **Root cause**: The fallback branch was implemented as a plain text node rather than a disabled variant of the same button.
- **Impact**: Users scanning the toolbar can miss the message entirely (it looks like a passive label, not an actionable/blocked control), and the only way to learn *why* writing is unavailable is an easily-missed native tooltip.
- **Fix sketch**: Render a disabled button with the same icon/shape as the enabled "Write to Project" button (e.g. grayed out `Save` icon) so its blocked state reads as part of the same control family, keeping the `title` tooltip as supplementary detail.

### 10. Reset button destroys all input and results with a single click and no confirmation
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/index.tsx:75-84,104-112 (via useBlueprintTranspiler.ts)
- **Scenario**: Once any result exists, a small "Reset" affordance appears in the tab bar. One click immediately clears `blueprintJson`, `existingCpp`, `asset`, `summary`, `transpileResult`, `diffResult`, and `error` — including any hand-pasted Blueprint JSON or C++ the user spent time preparing — with no undo and no confirmation step.
- **Root cause**: Destructive action styled and gated identically to a low-stakes utility button (same size/weight as the tab buttons), with no differentiation for its irreversibility.
- **Impact**: A stray click discards potentially large pasted input the user has no way to recover, especially since it sits directly in the tab bar next to frequently-clicked tab buttons.
- **Fix sketch**: Give Reset a visually distinct (e.g. subtle red/outline) treatment and/or a short confirm-on-second-click / hold pattern, consistent with other destructive actions in the app.
