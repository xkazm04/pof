# Prompt Evolution & A/B Testing — Bug + UI Scan

> Total: 8

> **Context-map note**: the mapped file `src/components/modules/evaluator/PromptEvolutionView.tsx` no longer exists as a single file — it was refactored into a folder `src/components/modules/evaluator/PromptEvolutionView/` containing `index.tsx`, `usePromptEvolution.ts`, and 10 sub-components (`ABTestCard.tsx`, `ClustersPanel.tsx`, `constants.ts`, `EmptyState.tsx`, `ModeToggle.tsx`, `OptimizerPanel.tsx`, `StatsPanel.tsx`, `SuggestionsBar.tsx`, `TestsPanel.tsx`, `VariantCard.tsx`, `VariantsPanel.tsx`). All 12 files were read in full, plus `src/stores/promptEvolutionStore.ts` and `src/lib/prompt-evolution/engine.ts` for behavior verification.

## Bug findings

### 1. Rapid module switching can overwrite the UI with the wrong module's variants
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/PromptEvolutionView/usePromptEvolution.ts:59-64 (effect), src/stores/promptEvolutionStore.ts:143-155 (`loadVariants`)
- **Scenario**: User picks module A in the picker, then quickly picks module B before A's `/api/prompt-evolution` response returns. Two `loadVariants`/`loadSuggestions` requests are now in flight. If the response for A resolves after B's (out-of-order network, e.g. A's request was slower), the store's `set({ variants })` unconditionally overwrites state with A's data even though `selectedModuleId` is now B.
- **Root cause**: `loadVariants`/`loadSuggestions` have no request-sequencing guard (no AbortController, no "is this still the latest request" check keyed to `moduleId`); the last response to land wins regardless of which module it belongs to.
- **Impact**: The Variants/Suggestions panels silently show a different module's data than the one selected in the picker, and the create-variant / mutate / start-test actions then operate against the wrong module's variant set.
- **Fix sketch**: Track a request token or module id per in-flight fetch (e.g. `if (moduleId !== get().selectedModuleId) return;` after await, or an AbortController per module switch) before committing the response to the store.

### 2. Starting an A/B test from a variant card isn't guarded against double-submission
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/PromptEvolutionView/VariantCard.tsx:110-120
- **Scenario**: User expands a variant with 2+ siblings and rapidly clicks two (or the same) "A/B vs" sibling buttons before the first `startABTest` call resolves.
- **Root cause**: `startABTest` does set the shared `isMutating` flag in the store, but the sibling "start test" buttons here (unlike the "Mutate" button two lines above, which has `disabled={isMutating}`) have no `disabled` attribute at all, so the UI never blocks the second click.
- **Impact**: Duplicate/conflicting `start-ab-test` requests can fire for the same variant pair, creating redundant `ABTest` records that then both appear in the Tests panel.
- **Fix sketch**: Pass `isMutating` down to `VariantCard` and disable the sibling buttons (and/or track a local `pendingPairId` state) while a start-test request is outstanding.

### 3. "Conclude Test" has no busy state and can be clicked more than once
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/PromptEvolutionView/ABTestCard.tsx:131-140, src/stores/promptEvolutionStore.ts:228-243 (`concludeTest`)
- **Scenario**: User clicks "Conclude Test" on a running test with a slow network. The button remains enabled (no `disabled` prop, no loading flag) until the response arrives and flips `test.status` to `'concluded'`, which is the only thing that hides the button.
- **Root cause**: `concludeTest` in the store doesn't set any `isConcluding`/`isMutating`-style flag, so there is no state the component can use to disable the button between click and response.
- **Impact**: A second (or third) click before the first response lands sends duplicate `conclude-test` requests for the same test id; depending on server idempotency this can trigger redundant winner-selection writes or unnecessary load.
- **Fix sketch**: Add a per-test or global "concluding" flag (or a local component-level busy state keyed off `test.id`) and disable the button while the request is outstanding.

### 4. Clipboard-copy actions silently swallow failures with zero user feedback
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/PromptEvolutionView/VariantCard.tsx:124-130, src/components/modules/evaluator/PromptEvolutionView/ABTestCard.tsx:43-47
- **Scenario**: `navigator.clipboard.writeText` rejects — e.g. the page lost focus, the browser denied clipboard permission, or the app is loaded in a non-secure/embedded context. In `VariantCard` the call isn't even awaited or wrapped; in `ABTestCard`'s `handleUseWording` it is awaited but has no `try/catch`.
- **Root cause**: Both call sites assume `writeText` always succeeds and only wire up the success path (`toast.success` in `ABTestCard`, nothing at all in `VariantCard`).
- **Impact**: On failure the user gets no toast, no error, and no visual indication the copy didn't happen — they believe the prompt/wording is on their clipboard when it isn't (classic success-theater / silent-failure pattern), then paste something stale or unrelated elsewhere.
- **Fix sketch**: Wrap both calls in `try { ... toast.success(...) } catch { toast.error('Could not copy to clipboard') }`.

## UI findings

### 5. Sub-tab bar buttons are missing the shared `focus-ring` treatment used everywhere else in this view
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/PromptEvolutionView/index.tsx:99-112
- **Scenario**: Tab through the Prompt Evolution view with a keyboard. Every other actionable control in this feature (ModeToggle options, the "Use this wording" / "Finish & pick a winner" buttons in `ABTestCard`, the suggestion action buttons in `SuggestionsBar`) uses the `focus-ring` utility class for a visible focus indicator, but the `Optimizer / Variants / History / A/B Tests / Clusters / Stats` sub-tab buttons do not.
- **Root cause**: The sub-tab `<button>` className was hand-written (`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ...`) without reusing the `focus-ring` class already established as this view's convention.
- **Impact**: Keyboard users lose a consistent, visible focus indicator on the single most-used navigation control in the view — an inconsistency with the rest of the same component tree.
- **Fix sketch**: Add `focus-ring` to the sub-tab button className alongside the existing classes.

### 6. Module ids in the Stats breakdown truncate with no way to recover the full value
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/PromptEvolutionView/StatsPanel.tsx:38
- **Scenario**: A module id longer than fits in `w-28` (e.g. `arpg-animation`, `arpg-enemy-ai`) gets `truncate`d in the Module Breakdown table with no `title` attribute or tooltip.
- **Root cause**: Unlike `VariantCard.tsx:115` (`title={s.label}` on a similarly truncated element), this truncated span has no fallback for discovering the full text.
- **Impact**: Users can't tell which module a row refers to once the label is cut off, undermining the one place in the view meant to give a full cross-module overview.
- **Fix sketch**: Add `title={m.moduleId}` to the truncated span (or widen the column / use the human-readable label from `MODULE_OPTIONS` instead of the raw id).

### 7. Suggestions bar silently hides all but the first 4 suggestions with no count or "view more"
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/PromptEvolutionView/SuggestionsBar.tsx:44 (`suggestions.slice(0, 4)`), src/components/modules/evaluator/PromptEvolutionView/index.tsx:67-94
- **Scenario**: The evolution engine surfaces, say, 9 suggestions for a module; only the first 4 render, and there is no badge/counter/"show more" affordance anywhere indicating 5 more exist.
- **Root cause**: The cap is a hard `slice(0, 4)` with no accompanying UI to communicate the truncation.
- **Impact**: Users have no way to discover or act on lower-priority suggestions once more than 4 exist for a module, and no visual cue that anything was hidden — it just looks like "there are 4 suggestions" rather than "top 4 of N".
- **Fix sketch**: Show a small "+N more" affordance (or a "See all suggestions" link into a full list) when `suggestions.length > 4`.

### 8. Ad-hoc `${color}15` opacity strings duplicate an existing shared helper
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/PromptEvolutionView/OptimizerPanel.tsx:148,157-159; src/components/modules/evaluator/PromptEvolutionView/SuggestionsBar.tsx:138,149
- **Scenario**: Both files build translucent icon-chip backgrounds via string concatenation, e.g. `style={{ backgroundColor: \`${config.color}15\`, color: config.color }}`, assuming `config.color` is always a bare 6-digit hex string.
- **Root cause**: `src/lib/chart-colors.ts` already exports a `withOpacity(color, alpha)` helper (documented example: `withOpacity(STATUS_SUCCESS, OPACITY_8) // '#4ade8014'`) built exactly for this, but these two components hand-roll the same transformation instead of importing it.
- **Impact**: Fragile and inconsistent with the rest of the design system — if any of the module/status color constants used here (`MODULE_COLORS`, `ACCENT_EMERALD_DARK`, `STATUS_WARNING`, `ACCENT_PURPLE`) is ever swapped for a non-hex value (named color, `rgb()`, CSS variable), the `+ '15'` suffix silently produces an invalid `backgroundColor` value with no error, just a wrong/missing tint.
- **Fix sketch**: Replace the inline `${color}15` concatenation with the existing `withOpacity(color, OPACITY_8)` helper from `chart-colors.ts` in both files.
