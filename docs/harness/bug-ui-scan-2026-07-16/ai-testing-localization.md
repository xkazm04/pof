# AI Testing & Localization — Bug + UI Scan

> Total: 9

> Note on context-map drift: both scoped files have been refactored into folders since the context map was last written. `src/components/modules/game-systems/AITestingSandbox.tsx` is now `AITestingSandbox/{index.tsx, ScenarioCard.tsx, ScenarioEditors.tsx, DebouncedFields.tsx, constants.ts}`. `src/components/modules/evaluator/LocalizationPipelineView.tsx` is now `LocalizationPipelineView/{index.tsx, useLocalizationPipelineView.ts, OverviewTab.tsx, StringsTab.tsx, TranslationsTab.tsx, QATab.tsx, HazardCard.tsx, StringTableCard.tsx, StringCard.tsx, TranslationCard.tsx, PresetChip.tsx, SubTab.tsx, MiniStat.tsx, ReadyToShipBadge.tsx, ExpansionFactorBars.tsx, constants.ts, helpers.ts, types.ts}`. All files in both folders were read; `useAITesting.ts` itself was not refactored. To trace end-to-end behavior the caller of `AITestingSandbox` (`AIBehaviorView/index.tsx` + `SandboxTab.tsx`) and the localization store (`stores/localizationPipelineStore.ts`) were also read, since the scoped files only make sense in that wiring context.

## Bug findings

### 1. Debounced field "flush on unmount" comment is a lie — pending edits are silently dropped
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/AITestingSandbox/DebouncedFields.tsx:38-39
- **Scenario**: User expands a scenario card, types a new description or stimulus label, then collapses the card (or the scenario is deleted, or the parent unmounts) within the 400ms `COMMIT_DEBOUNCE_MS` window — no blur event fires because the field's container just unmounts via `AnimatePresence`.
- **Root cause**: The unmount effect at line 39 is `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, [])`. It only cancels the pending timer; it never calls `onCommitRef.current(local)`. The file's own header comment (lines 8-17) explicitly claims "Flush any pending debounced commit on unmount", but the code does the opposite — it discards it.
- **Impact**: Silent data loss. The user sees their typed text in the field while editing, collapses the card believing it saved (there's no dirty/unsaved indicator), and the edit vanishes with no error, toast, or console log — a classic "success theater" combined with a caught-and-forgotten write.
- **Fix sketch**: In the cleanup function, if `timerRef.current` is set, clear it and synchronously call `onCommitRef.current(local)` before returning (needs `local` captured via a ref since cleanup runs after the closure's `local` may be stale — mirror the existing `onCommitRef` pattern with a `localRef`).

### 2. `handleRunTests` races the "mark running" PUT against the CLI completion callback
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/AIBehaviorView/index.tsx:157-168
- **Scenario**: User clicks "Run Tests". `bulkUpdateScenarioStatus(ids, 'running')` (an un-awaited async PUT + refetch) and `testRunCli.execute(...)` are fired back-to-back with no ordering guarantee between them. If the CLI's `@@CALLBACK` writes final pass/fail statuses and `testRunCli`'s `onComplete` (line 75-89) calls `retry()` before the earlier "running" mutate's own trailing `refetch()` (from `useCRUD.mutate`, line 78 of useCRUD.ts) resolves, the late "running" refetch clobbers the just-displayed pass/fail results back to "running" for a frame.
- **Root cause**: Two independent fire-and-forget async chains (`bulkUpdateScenarioStatus` → `mutate` → `refetch`, and `testRunCli.execute` → CLI → `onComplete` → `retry`) both mutate the same suite/scenario state with no sequencing token or "latest request wins" guard.
- **Impact**: Transient but visible flicker/regression of test results to a stale "running" state right after a run finishes; on a slow network the window is wide enough to be noticeable, and if the CLI genuinely fails fast, `runningIdsRef.current` could already have been read/cleared before the initial "running" write even lands, causing an inconsistent final status.
- **Fix sketch**: Await `bulkUpdateScenarioStatus(ids, 'running')` before calling `testRunCli.execute(...)`, or track an increasing "run generation" counter and have `onComplete`/the bulk update ignore results that aren't from the latest generation.

### 3. `timeoutSeconds` input in ExpectedActionsEditor bypasses the debounce fix the file next to it exists to provide
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/AITestingSandbox/ScenarioEditors.tsx:153-160
- **Scenario**: User edits the "timeout" number field for an expected action. Unlike every text/textarea field in the same editor (which route through `DebouncedInput`/`DebouncedTextarea`, see `DebouncedFields.tsx`), this field calls `onUpdate(idx, { timeoutSeconds: ... })` directly in `onChange`, which propagates straight to `onUpdateScenario` → a network PUT, on every keystroke.
- **Root cause**: `DebouncedFields.tsx`'s own header comment documents that this exact pattern ("Every keystroke... fire onUpdate → a PUT... auto-refetched... dropping characters / jumping the cursor") was a known, fixed bug for text fields — but the fix was never applied to this numeric input, which was added/left using the old direct-onUpdate pattern.
- **Impact**: Typing a two-digit timeout (e.g. "15") fires two overlapping PUT + refetch cycles with no ordering guarantee; the second keystroke's PUT can resolve before the first's, so the final persisted value can revert to an intermediate typed value (lost update), and the refetch after each keystroke can also disrupt focus/cursor if a slow response lands mid-type.
- **Fix sketch**: Wrap the timeout input the same way, e.g. a `DebouncedInput` variant that parses to number on commit, or at minimum debounce the `onChange` locally before calling `onUpdate`.

### 4. Mutation failures are swallowed — callers treat a failed PUT the same as success
- **Severity**: Medium
- **Category**: bug
- **File**: src/hooks/useCRUD.ts:75-84 (consumed by src/components/modules/game-systems/AIBehaviorView/index.tsx:78-89)
- **Scenario**: The "mark running" bulk PUT (or the "mark error after CLI failure" bulk PUT) fails due to a transient network error. `useCRUD.mutate` catches the error, `console.error`s it, and returns `null` — but `bulkUpdateScenarioStatus` in `useAITesting.ts:106-118` just returns `result !== null` and none of its callers in `AIBehaviorView/index.tsx` (lines 81-84, 164) check that boolean.
- **Root cause**: Errors are converted into a boolean return value that nobody inspects; the only trace is a `console.error` line invisible to the end user.
- **Impact**: If marking scenarios "running" fails, the UI still proceeds to kick off the CLI run as if scenarios were flagged; if the later "mark error" PUT (after a CLI failure) also fails, scenarios are left stuck showing "running" indefinitely with zero user-facing indication anything went wrong — a silent failure / stuck-state bug with no recovery path short of a manual page refresh (which won't fix the underlying stuck DB status).
- **Fix sketch**: Surface a toast/error banner when `bulkUpdateScenarioStatus` returns `false`, and/or have `useAITesting` expose the last mutation error alongside `error` so callers can react.

### 5. `runFullPipeline` has no in-flight guard against rapid double-submission
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/LocalizationPipelineView/index.tsx:55-62, src/stores/localizationPipelineStore.ts:186-224
- **Scenario**: User double-clicks (or mashes Enter-equivalent) "Run Full Pipeline" before React re-renders the `disabled={isLoading || !config}` attribute into the DOM. Two overlapping `runFullPipeline` calls both call `set({ isLoading: true, error: null })` and hit `/api/localization-pipeline` concurrently.
- **Root cause**: The only guard against concurrent invocation is the `disabled` prop, which is reactive (post-render) rather than a synchronous in-flight lock inside the store action itself.
- **Impact**: Two full-pipeline runs (each presumably an expensive scan + AI translation + QA pass) can execute in parallel; whichever response resolves last wins and overwrites the store wholesale (`scanResult`, `strings`, `entries`, `qaFindings`, etc. all replaced together at lines 204-220), so a slower first response landing after a faster second one silently reverts newer results to older ones, and the wasted duplicate AI/translation call is pure cost with no benefit.
- **Fix sketch**: Add an early return in `runFullPipeline` if `get().isLoading` is already true, or track a request-id/AbortController and ignore stale responses.

## UI findings

### 6. AITestingSandbox header toolbar has no wrap/overflow handling
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/AITestingSandbox/index.tsx:66-131
- **Scenario**: The toolbar packs a 56px `ProgressRing`, an icon + label, a scenario count, up to two colored pass/fail badges, and two action buttons ("Run Tests", "Generate All Tests") all in one non-wrapping `flex items-center` row with no `flex-wrap` or horizontal scroll fallback.
- **Root cause**: No responsive strategy (wrap, condensed labels at smaller widths, or overflow scroll) is applied to this row; every child element assumes the container is wide enough for all of them simultaneously.
- **Impact**: On a narrower panel (e.g. this sandbox tab embedded in a split/resizable layout, or a smaller window), the row will either clip the trailing button or force a horizontal scrollbar on the whole toolbar, degrading usability of the primary "Run Tests"/"Generate All Tests" actions right when the suite has both passed and failed scenarios (i.e. exactly when both badges are shown and the row is most crowded).
- **Fix sketch**: Add `flex-wrap` with `gap-y` spacing, or collapse the button labels to icon-only below a breakpoint, or move the badges into the ProgressRing's tooltip/label instead of separate pills.

### 7. Inconsistent use of the opacity-token constants vs. hardcoded literals for the same badges
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/AITestingSandbox/index.tsx:86-99 (compare 108-112); src/components/modules/game-systems/AITestingSandbox/ScenarioCard.tsx:177-181
- **Scenario**: In the same file/component, the passed/failed count badges hardcode `${STATUS_SUCCESS}15` / `${STATUS_ERROR}15` (opacity `"15"` as a literal string) while the "Run Tests" button four lines later uses the imported `OPACITY_15`/`OPACITY_30` constants for the identical visual treatment. `ScenarioCard.tsx`'s "Generate Test" button repeats the hardcoded `"15"`/`"30"` pattern even though it separately imports and correctly uses `OPACITY_15`/`OPACITY_30` for the status pill just above it.
- **Root cause**: The opacity-suffix design token (`OPACITY_15`/`OPACITY_30` from `@/lib/chart-colors`) was introduced but not consistently retrofitted across every color+opacity usage in the same files.
- **Impact**: Cosmetically invisible today (literal "15" and `OPACITY_15` currently resolve to the same string), but it's a latent drift risk: if the opacity token value is ever changed centrally, only some of these badges/buttons will pick it up, silently creating visual inconsistency between adjacent elements that are supposed to look identical.
- **Fix sketch**: Replace the remaining hardcoded `"15"`/`"30"` opacity suffixes with `OPACITY_15`/`OPACITY_30` for every color+opacity pairing in both files.

### 8. LocalizationPipelineView header/CTA use raw Tailwind indigo classes instead of the already-imported `ACCENT_INDIGO` token
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/LocalizationPipelineView/index.tsx:45-46, 55-62
- **Scenario**: The header icon tile (`bg-indigo-500/10`, `text-indigo-400`) and the "Run Full Pipeline" button (`bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20`) are styled with hardcoded Tailwind indigo utility classes, while the same file imports `ACCENT_INDIGO` from `@/lib/chart-colors` and uses it elsewhere (`focusRingStyle(ACCENT_INDIGO)` at line 41, and the "Translation" `MiniStat` and hazard/QA badges throughout the sibling tab files) as the canonical color token for this feature area.
- **Root cause**: Two different theming mechanisms (design-system color tokens driving inline `style` on some elements vs. static Tailwind color classes on others) coexist for what is meant to be one consistent accent color for the whole Localization Pipeline surface.
- **Impact**: If `ACCENT_INDIGO` is ever retargeted (e.g. a brand/theme pass, or a dark-mode-specific override), the header icon tile and the primary CTA button will not follow — visibly diverging from every other indigo-accented element in the same view (stat tiles, focus rings, sub-tab underline).
- **Fix sketch**: Drive the header icon/CTA button color from `ACCENT_INDIGO` (and its precomputed opacity variants) via inline style or a Tailwind arbitrary-value class bound to the token, matching the pattern already used for `MiniStat`/`SubTab`.

### 9. `PresetChip` has no visible keyboard-focus state, unlike its sibling `SubTab`
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/LocalizationPipelineView/PresetChip.tsx:1-17 (compare SubTab.tsx:10 which applies `FOCUS_RING_CLASS`)
- **Scenario**: A keyboard user tabs through the Strings/Translations tab filter row. The sub-tab buttons (Overview/Strings/Translations/...) each get a clear focus ring via the shared `FOCUS_RING_CLASS` utility, but the preset filter chips ("Hardcoded", "Low confidence", "Missing translations", etc., rendered immediately below) only change `transition-colors` on `active`/hover state and never apply any focus-visible styling.
- **Root cause**: `PresetChip`'s className string only branches on the `active` prop; it never includes `FOCUS_RING_CLASS` (or any `:focus-visible` treatment) even though the exact same `@/lib/ui/focus-ring` utility is already used elsewhere in this same view (`SubTab.tsx`, and `focusRingStyle` on the page root).
- **Impact**: Keyboard-only users lose track of which preset chip is currently focused while tabbing through the filter row — a functional accessibility regression relative to the adjacent, correctly-focus-ringed sub-tab bar in the same screen, and an inconsistency in how two visually similar toggle-button components handle the same interaction state.
- **Fix sketch**: Add `FOCUS_RING_CLASS` (or equivalent `focus-visible:ring-*` classes) to `PresetChip`'s button, matching `SubTab`.
