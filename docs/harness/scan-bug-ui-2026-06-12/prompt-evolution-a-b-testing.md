# Prompt Evolution & A/B Testing — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

Note on commit ae32fa0 (atomic trial increment): verified clean. The new `recordTrialAndEvaluate` keeps the pre-fix semantics (`null` when the test is missing or not running — confirmed against `ae32fa0^`), runs increment → re-read → evaluate → upsert inside one synchronous better-sqlite3 transaction with a sync `evaluate` callback, and the fixed A/B column-name branch cannot be user-controlled. No regression found. The findings below are unrelated to that fix.

## 1. Persisted A/B tests are unreachable after a page reload — the UI has no way to list them
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/stores/promptEvolutionStore.ts:109`
- **Scenario**: User starts an A/B test, then reloads the page (or restarts the dev server). The Tests tab shows the "No A/B tests yet" empty state, while the Stats tab (fed by `get-stats`) simultaneously reports `Active Tests: 1`. The running test still exists in SQLite but can never be seen, expanded, or concluded again from the UI.
- **Root cause**: `abTests` starts as `EMPTY_TESTS` and is only ever populated by the *responses* of `startABTest`/`recordTrial`/`concludeTest` in the current session. There is no `loadTests` action in the store, and `src/app/api/prompt-evolution/route.ts` has no list action at all — `engine.getAllTests()`/`getActiveTests()` exist (engine.ts:223-231) but are never exposed. The evolution-db persistence work made tests durable server-side, but the UI was never wired to read them back.
- **Impact**: Success theater / effective data loss from the user's perspective — every started test silently "disappears" on refresh; running tests become orphans that can never be concluded via the UI, permanently inflating the Active Tests KPI.
- **Fix sketch**: Add a `get-tests` action to the route (optionally filtered by `moduleId`) backed by the already-exported `getAllTests()`. Add `loadTests()` to the store and call it from `init()` and on module selection, replacing the session-local accumulation.

## 2. Module picker offers 5 phantom modules and hides 5 real ones — registry drift
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:66-79`
- **Scenario**: User selects "Abilities" (`arpg-abilities`), "AI" (`arpg-ai`), "Audio", "VFX", or "Multiplayer" from the picker. `getModuleChecklist()` returns `[]` for these ids (they don't exist in `SUB_MODULES`), so the create form shows "This module has no checklist items — pick a different module", variants/suggestions/sessions are always empty, and the optimizer always reports "sample too small". Meanwhile the registry's real modules `arpg-animation`, `arpg-gas`, `arpg-enemy-ai`, `arpg-loot`, and `arpg-polish` are not in the picker at all, so any variants/tests/history recorded for them are unreachable in this view.
- **Root cause**: `MODULE_OPTIONS` is a hardcoded "sample modules" list that diverged from `src/lib/module-registry.ts` (`SUB_MODULES` defines 12 ids; only 7 overlap with the picker). The registry is the single source of truth (`MODULE_LABELS` even exists for labels) but the view never consults it.
- **Impact**: ~42% of the picker leads to dead ends, and ~42% of real modules can never be evolved — wrong results presented as "no data", with no error anywhere.
- **Fix sketch**: Derive the options from the registry: `SUB_MODULES.map(m => ({ id: m.id, label: m.label }))` (or `MODULE_LABELS`), deleting the hardcoded array so the picker can never drift again.

## 3. One transient action error permanently blanks every tab in the view
- **Severity**: Medium
- **Lens**: bug
- **Category**: recovery-gap
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:355`
- **Scenario**: Any of the store's 12 API actions fails once — e.g. `get-stats` during a dev-server restart, a failed `cluster-prompts`, or a `record-trial` that 404s because the test just auto-concluded ("Test not found or not running"). The store sets `error`, and the render gate `{!isLoading && !error && (<>…all tabs…</>)}` hides the Optimizer, Variants, History, Tests, Clusters, and Stats panels entirely, leaving only the red banner.
- **Root cause**: A single global `error` channel doubles as a full-screen kill switch. Several actions (`recordTrial`, `concludeTest`, `loadStats`, `loadSuggestions`) set `error` but never clear it on entry, nothing clears it on tab switch, and the banner has no dismiss — recovery only happens as a side effect of re-selecting a module (which resets `error: null` via `loadVariants`).
- **Impact**: Whole feature appears broken after a transient hiccup; previously loaded, perfectly valid data is hidden until the user stumbles on the module-reselect escape hatch.
- **Fix sketch**: Render the error banner *alongside* content (drop `!error` from the content gate), add a dismiss button that sets `error: null`, and clear `error` when switching tabs/modules. Consider per-action error scoping for background calls like `recordTrial`.

## 4. Optimizer records phantom diffs when a pass doesn't actually change the prompt
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/prompt-evolution/engine.ts:524-531` (also 572-581)
- **Scenario**: User optimizes a short prompt that already mentions `.h/.cpp`, UE5 macros, and error handling. Pass 2's `addSpecificityHints` returns the prompt **unchanged** (all three hint checks pass → `hints.length === 0`), yet a "lengthen — Added specificity hints" diff is pushed unconditionally. Same in Pass 3: when the best cluster's dominant style is `step-by-step` and the prompt is a single paragraph, `toStepByStep` no-ops (blocks ≤ 1, mutations.ts:104) but a "Restructured to step-by-step style" diff is still recorded. If no other pass fires, the result has `wasModified: false` with `diffs.length > 0`.
- **Root cause**: Passes 2 (lengthen) and 3 (restructure) push their diff after calling the transform without comparing before/after — unlike the shorten branch (engine.ts:534-544), which guards with `optimized !== before`. Several mutation transforms are documented no-ops on certain inputs.
- **Impact**: Contradictory output: the summary bar says "No optimizations needed — your prompt already follows best practices" while the "Changes Applied" section below lists changes (PromptEvolutionView.tsx:1303-1311 vs 1315-1356); `predictedImprovement` is inflated by +0.06/+0.12 for edits that never happened.
- **Fix sketch**: Capture `const before = optimized` ahead of each transform and only push the diff (and improvement) when `optimized !== before`, exactly as the shorten branch already does.

## 5. `shorten` mutation deletes every parenthetical — gutting UE5 macro specifiers and function arguments
- **Severity**: Medium
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/lib/prompt-evolution/mutations.ts:127`
- **Scenario**: User applies the "Shorten" mutation (or the optimizer auto-applies it when the best cluster's dominant style is `minimal`, engine.ts:568) to a prompt containing `UPROPERTY(EditAnywhere, BlueprintReadWrite)` or `SetHealth(MaxHealth * 0.5f)`. The regex `.replace(/\(.*?\)/g, '')` strips *all* parenthesized text, producing `UPROPERTY` and `SetHealth` — and the corrupted prompt is persisted as a new variant via `createVariant`.
- **Root cause**: `shorten()` assumes parentheses only wrap prose asides, but in a UE5 companion app prompts are full of macro specifiers and call signatures. The sibling helper `trimRedundancy` (engine.ts:672) already knows this and only strips `(e.g./i.e./note: …)` asides — `shorten` never got the same restraint. Distinct mechanism from the known `swapOrdering` finding (#4 of 2026-06-09), which covered placeholder round-tripping only.
- **Impact**: Silent corruption of the user's prompt in a saved variant; the load-bearing technical content (macro flags, arguments) is exactly what gets deleted, making the "shortened" variant worse in ways an A/B test will then measure against a healthy baseline.
- **Fix sketch**: Reuse `trimRedundancy`'s targeted pattern `/\((?:e\.g\.,?|i\.e\.,?|note:)[^)]*\)/gi` in `shorten()`, or skip parenthetical removal when the content matches code-ish patterns (`/[A-Z_]{2,}|\w+\(/`).

## UI findings

## 6. Disclosure buttons and icon-only actions are invisible to keyboard and screen-reader users
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:666` (also 327-341, 739-747, 898-918)
- **Scenario**: A keyboard user tabs through the view: the sub-tab bar, "New Variant", "Create", "Mutate", "Copy", and the VariantCard/ABTestCard expand headers show no focus indicator (no `focus-ring` class, default outline likely reset), so focus position is lost. A screen-reader user hears the expandable card headers as plain buttons with no expanded/collapsed state, and the A/B flask buttons announce nothing useful — they are icon-only with just a `title`.
- **Root cause**: The app's `focus-ring` convention is applied inconsistently — `ModeToggle`, `PlainVerdictBanner`, and `SuggestionCard` have it, but the majority of interactive elements in this file don't. Disclosure toggles lack `aria-expanded`, and the flask buttons lack `aria-label` (`title` alone is not a reliable accessible name).
- **Impact**: Core flows (creating variants, expanding tests, starting A/B tests) are effectively unusable without a mouse and opaque to assistive tech.
- **Fix sketch**: Add `focus-ring` to every button/select in the file; add `aria-expanded={isExpanded}` to the VariantCard and ABTestCard header buttons; give flask buttons `aria-label={`Start A/B test vs ${s.label}`}`.

## 7. Starting an A/B test gives zero feedback and invites duplicate submissions
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:739-747`
- **Scenario**: On the Variants tab, the user clicks a tiny flask icon to start a test. Nothing visible happens — no toast, no navigation to the Tests tab, and the button neither disables nor shows a pending state. The natural reaction is to click again, and each click creates another `running` test row for the same variant pair (the engine/DB has no dedup for an existing running test on the same item).
- **Root cause**: `handleStartTest` (line 224-229) awaits the store call but renders no success/pending feedback, and the flask buttons ignore `isMutating`; every other create action in this view (variant create, mutate via suggestion) confirms with a toast.
- **Impact**: Users don't discover their test started (especially since the Tests tab looks empty after reload, see finding 1); duplicate running tests fragment future trial data and clutter the Tests list.
- **Fix sketch**: Disable flask buttons while `isMutating`; on success `toast.success('A/B test started')` and `setActiveSubTab('tests')` + expand the new test. Server-side, return the existing running test for the same (item, pair) instead of inserting a duplicate.

## 8. Variant "Copy" button is fire-and-forget — no confirmation, no failure handling
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:752-758`
- **Scenario**: User clicks "Copy" on an expanded variant. Nothing confirms the copy happened; if `navigator.clipboard.writeText` rejects (permissions, non-secure context), the failure is silent too — the user pastes and gets stale clipboard content.
- **Root cause**: The two other copy actions in this view ("Use this wording" at line 888-892, adopt-winner at line 308-316) both `await` the write and show `toast.success(...)`; this button skips both the await and the toast.
- **Impact**: Inconsistent interaction feedback for the same action verb within one screen; occasional silent copy failures that surface as confusing pastes.
- **Fix sketch**: Mirror `handleUseWording`: `await navigator.clipboard.writeText(variant.prompt)` in a try/catch, `toast.success('Copied to clipboard')` on success, `toast.error(...)` on failure. Consider extracting a shared `copyPrompt(label, text)` helper.

## 9. Three competing spinner implementations — one nearly invisible on its button
- **Severity**: Low
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:1121` (also 345-349, 1257-1261, 1662)
- **Scenario**: While clustering runs, the "Analyze Clusters" button shows a 3px border-spinner with no border color set — on the solid emerald button it renders in the theme's default border color and is barely visible. The page-level loader (line 347) is a different hand-rolled border-spinner with inline styles, while the Optimizer and Suggestion buttons use the `Loader2` icon.
- **Root cause**: No shared spinner primitive; each call site re-invents loading affordance, and the clusters one forgot a contrast-safe color (`border-t-transparent` against an unset border color).
- **Impact**: The clustering action can look unresponsive (its only feedback is a near-invisible spinner), and loading states feel inconsistent across one screen.
- **Fix sketch**: Standardize on `<Loader2 className="w-3 h-3 animate-spin" />` for in-button loading (already the dominant pattern here) and reuse it at lines 347 and 1121, or extract a `Spinner` ui component with a required color/size.

## 10. "New Variant" button silently no-ops when no module is selected
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/PromptEvolutionView.tsx:474-484`
- **Scenario**: With no module selected, the user clicks the enabled-looking "New Variant" button. The click toggles `showCreateForm`, but the form only renders when `showCreateForm && selectedModuleId` (line 488), so nothing appears. Worse, the toggle state is now inverted: after selecting a module, the user may need to click the button twice to open the form.
- **Root cause**: The disabled condition lives in the render gate of the *form* instead of on the *button*; the adjacent "Select a module first" hint is informational only and easy to miss next to an actionable-looking button.
- **Impact**: Button appears broken; latent toggle inversion makes the next interaction inconsistent.
- **Fix sketch**: Add `disabled={!selectedModuleId}` (with `disabled:opacity-40`, matching the Create/Optimize buttons) to the "New Variant" button, keeping the hint text as the explanation for the disabled state.
