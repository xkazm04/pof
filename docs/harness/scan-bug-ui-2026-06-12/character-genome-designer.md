# Character & Genome Designer — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. "Hardened" codegen emits invalid C++ float literals — every preset genome's .cpp fails to compile
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/genome/codegen.ts:66` (also :64, :70-74, :80-83, :90 — every `}f` interpolation; and every `}.f` line for fractional values)
- **Scenario**: User clicks "Generate .cpp Implementation" for ANY of the four preset genomes (or any genome with a whole-number value in a `}f` field) and pastes into UE5. `gravityScale: 1.0` renders as `GravityScale = 1f;`, `lagSpeed: 10` as `CameraLagSpeed = 10f;`, `critMultiplier: 2.0` as `CritMultiplier = 2f;` — all invalid C++ ("invalid suffix 'f' on integer constant"). Conversely, typing a fractional value into a `}.f` field via NumberField (which clamps to min/max but never rounds to step, e.g. staminaCost `25.5`) renders `DodgeStaminaCost = 25.5.f;` — also invalid.
- **Root cause**: Commit 19206ae routed the editor through `@/lib/genome/codegen.ts` and the prior audit declared it "the safe implementation" — but its hardening covers only strings (`sanitizeCppIdentifier`/`csvEscape`), not numeric literal formatting. JS `String(1.0)` is `"1"`, so the `${value}f` template produces an integer literal with a float suffix; the split `}.f` vs `}f` convention assumes integer-valued fields stay integral and float-valued fields stay fractional, and both assumptions fail.
- **Impact**: corrupted output — the primary deliverable (UE5 subclass constructor) never compiles for the default presets; designers hit C++ errors with no warning from the app. Dedup note: this is NOT the prior report's finding #1 (name sanitization, since fixed); it is a distinct latent defect in the generator the fix promoted to the only code path.
- **Fix sketch**: Add `function cppFloat(v: number): string { return Number.isInteger(v) ? `${v}.f` : `${v}f`; }` (guarding non-finite to `0.f`) and replace every `${...}.f` / `${...}f` interpolation with `${cppFloat(...)}`. Unit-test `gravityScale: 1`, `lagSpeed: 10`, `staminaCost: 25.5` round-trips.

## 2. Clearing the genome name silently deletes the genome (and all its checkpoints) on next reload
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/modules/core-engine/sub_character/genome/GenomeHeaderPanel.tsx:43` (with `src/lib/genome/defaults.ts:106` and `src/stores/genomeStore.ts:222-238`)
- **Scenario**: User select-alls the title input and presses Delete (intending to retype the name), then closes or refreshes the tab before typing. The header input commits `name: ''` straight into the store on every keystroke; zustand persist writes it to localStorage immediately. On rehydrate, `sanitizeGenome` returns `{ error: 'missing or empty "name"' }` for that entry and the merge loop silently skips it; the checkpoint pass then drops every checkpoint whose `genomeId` is no longer in `genomeIdSet`. If it was the only genome, the whole collection resets to presets.
- **Root cause**: Asymmetric trust boundary — the in-app editor is allowed to persist a state (`name: ''`) that the rehydration sanitizer classifies as "irrecoverably invalid". An empty name is trivially recoverable (default it), but the merge treats it like structural corruption and deletes instead of repairing.
- **Impact**: silent, permanent loss of a hand-tuned genome plus its entire checkpoint history from a routine rename gesture; no error is ever surfaced.
- **Fix sketch**: In `sanitizeGenome`, treat an empty/whitespace name as a warning and default it (`'Unnamed Archetype'`) instead of returning an error — reserve the error path for non-object input. Optionally also revert-on-blur in GenomeHeaderPanel when the field is left empty.

## 3. Wizard marks a step "running" before a cancellable dispatch — preflight Cancel leaves an eternal spinner
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard.tsx:81-86` (with `src/hooks/useModuleCLI.ts:181-184`)
- **Scenario**: `character-setup` is in `EXPENSIVE_TASK_TYPES`. Under budget pressure (daily/monthly budget exceeded), clicking "Wire Characters" sets `steps[1] = 'running'` and `activeStepRef = 2`, then `execute()` shows the preflight confirm. The user clicks Cancel → `execute` returns without dispatching anything → `isRunning` never transitions → `onComplete` never fires. Step 2 shows the "Wiring characters…" spinner and the StepRail counts it active forever (same outcome if `scanProject()` rejects, since the `execute` promise is un-awaited and uncaught).
- **Root cause**: Optimistic state transition — the UI commits to 'running' before the async pipeline has actually committed to dispatching, and there is no rollback path for the early-return/throw branches of `execute`.
- **Impact**: success-theater spinner that never resolves; users believe a multi-minute UE editor task is in flight when nothing was launched, and the step status can never be corrected except by re-dispatching.
- **Fix sketch**: Mark 'running' only after dispatch is confirmed: `await execute(...)` in the handler, have `execute` return a boolean (false on preflight-cancel/throw), and reset the step to 'idle' (clearing `activeStepRef`) when it returns false or rejects.

## 4. Attribute Optimizer: lowering the level keeps the old allocation — efficiency badge reads >100%
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_character/attributes/AttributePointOptimizer.tsx:31` (and :33-35, :70-72)
- **Scenario**: Default state is Lv.50 with 49/49/49 (147 pts) allocated. The user drags the level slider down to 25 → `totalAvailable` becomes 72 but `currentAlloc` still sums to 147. "Unspent" shows `-75 pts` in red, and the header badge computes `currentScore/optimalScore` where the current build illegally uses double the points of the optimal one — displaying e.g. "180% efficient" as if the user's build beats the optimum.
- **Root cause**: `currentAlloc` is independent state that is never reconciled when its budget (`totalAvailable`, derived from `level`) shrinks; `updateAlloc` clamps only future single-attribute edits, and `efficiency` assumes `currentUsed <= totalAvailable` so optimal is an upper bound.
- **Impact**: wrong results — the headline efficiency metric becomes meaningless (a >100% score for an invalid build), undermining trust in the optimizer's recommendations.
- **Fix sketch**: On level change, proportionally rescale (or clamp) `currentAlloc` so its sum ≤ new `totalAvailable` (e.g. in a `useEffect` keyed on `totalAvailable`, or derive a clamped alloc each render). Alternatively cap `efficiency` math to point-legal builds and surface an explicit "over budget" state instead of a percentage.

## 5. Clipboard copies report success without verifying the write
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/core-engine/sub_character/genome/CodePreview.tsx:20-24` (also `GenomeHeaderPanel.tsx:65`)
- **Scenario**: User opens the generated .h/.cpp/CSV preview and clicks "Copy" in a context where `navigator.clipboard.writeText` rejects (non-secure origin, permissions policy, or focus loss). The button still flips to "Copied!" for 1.5s because the promise is fire-and-forget. The Share2 "Copy JSON" button in the header is worse: raw `navigator.clipboard` call with no feedback at all — failure and success look identical.
- **Root cause**: Unawaited promise + unconditional success state. The project already has a `copyToClipboard` helper returning a boolean (used correctly with a copied-flash in `BuildCodeExport.tsx:32-42`), but these two callsites bypass it.
- **Impact**: the user pastes into UE5/an editor and gets stale or empty clipboard contents after the app told them the copy succeeded — confusing data-loss-adjacent UX for the module's core hand-off action.
- **Fix sketch**: `const ok = await copyToClipboard(code); if (ok) setCopied(true); else show an error flash`. Apply the same helper + copied feedback to GenomeHeaderPanel's JSON copy button.

## UI findings

## 6. Code preview modal is keyboard-inaccessible: no Escape, no close button, no dialog semantics
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_character/genome/CodePreview.tsx:27-39`
- **Scenario**: A keyboard user generates the .cpp preview. The full-screen overlay can only be dismissed by clicking the backdrop — there is no Escape handler, no visible close button, no `role="dialog"`/`aria-modal`, no focus trap, and focus is not moved into the modal; Tab continues through the page underneath the overlay.
- **Root cause**: Hand-rolled modal that implements only the pointer path; the app's overlay pattern (backdrop + stopPropagation) was copied without the keyboard/ARIA half.
- **Impact**: keyboard and screen-reader users are trapped — they cannot dismiss the modal at all, and SR users are never told a dialog opened. This is the module's most-used output surface.
- **Fix sketch**: Add `role="dialog" aria-modal="true" aria-label={title}`, a visible X close button, a `keydown` Escape listener, and focus the panel (`tabIndex={-1}` + ref focus) on mount; restore focus on close. Better: extract a shared `ModalShell` so every overlay inherits this.

## 7. All custom sliders are invisible, unlabeled range inputs — 40+ unnamed focusable controls
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_character/genome/ProfileSection.tsx:88-90` (same pattern: `LevelScaledPowerCurve.tsx:155`, `LiveSimDashboard.tsx:55-57`)
- **Scenario**: Every profile field renders an `opacity-0` `<input type="range">` stretched over a NeonBar. Tabbing through the editor lands on ~42 sliders that a screen reader announces only as "slider, 400" with no name; the visible focus state is also absent because the real control is invisible (no focus ring is drawn on the bar when the hidden input has focus).
- **Root cause**: The decorative NeonBar carries the visuals while the functional input is hidden; `aria-label` was added to the adjacent NumberField but the slider — a separate tab stop — was left unnamed, and no `:focus-visible` style is mirrored onto the visible track.
- **Impact**: SR users cannot tell which of 42 identical sliders they are on; keyboard users lose track of focus entirely while traversing the editor's main editing surface.
- **Fix sketch**: Pass `aria-label={f.label}` (and "Preview level"/"Simulation level" for the two level sliders) to each range input, and add a peer-focus ring on the track container (`focus-within:` ring on the wrapper) so keyboard focus is visible.

## 8. Level-slider row duplicated across panels and already drifting (NumberField vs raw input, Lv.100 vs Lv.50)
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/sub_character/genome/LiveSimDashboard.tsx:50-65` (duplicate of `LevelScaledPowerCurve.tsx:150-165`)
- **Scenario**: The "Lv. | track + NeonBar + hidden range + numeric box + / max" row is copy-pasted between the power-curve panel and the sim dashboard. They have already diverged: the power curve uses the standard `NumberField` (blur-commit, clamping, aria-label, focus ring) while the dashboard uses a raw `<input type="number">` that silently ignores out-of-range keystrokes, has no aria-label, and uses the legacy `focus:border-blue-500/50` style. One panel simulates to Lv.100, the other caps at Lv.50 (the UE5 `maxLevel`), so the two "level" controls on the same screen disagree about the game's level range.
- **Root cause**: No shared `LevelSliderRow` component; each panel re-implements the composite control, so fixes (NumberField adoption, focus-ring standard) land in one copy only.
- **Impact**: inconsistent input behavior and styling within a single screen; the 50-vs-100 cap mismatch makes crossover levels above 50 look reachable when they are not.
- **Fix sketch**: Extract `LevelSliderRow({ value, max, color, onChange })` using NumberField + the labeled range from finding 7; parameterize max and use one source of truth (`UE5.maxLevel` or an explicit "projection" max) in both panels.

## 9. Genome title input has no placeholder, label, or empty-state affordance — it can vanish entirely
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_character/genome/GenomeHeaderPanel.tsx:43-44`
- **Scenario**: The archetype name is an unstyled transparent input (`border-none`, no placeholder, no aria-label, no hover/focus affordance). Users routinely fail to realize the title is editable; worse, if the field is cleared it renders as literally nothing — an invisible 0-width input next to the color dot — leaving no visual way back (and arming bug #2's data loss). The description input below it at least has a placeholder.
- **Root cause**: "Seamless inline edit" styling applied without the compensating affordances (placeholder, hover underline, focus ring) that pattern requires.
- **Impact**: discoverability failure for the rename action and a dead-end empty state on the editor's primary identity field.
- **Fix sketch**: Add `placeholder="Archetype name"`, `aria-label="Genome name"`, a subtle `hover:border-b border-border/40 focus:border-b` cue, and revert to the previous name on blur when left empty.

## 10. Selected state on wizard source cards and compare toggles is color-only, with no aria-pressed
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard.tsx:115-131` (also `GenomeHeaderPanel.tsx:80-90` compare chips)
- **Scenario**: The three character-source cards and the "Compare: All/<name>" chips communicate selection purely through background/border opacity shifts in the accent color. A screen reader announces all of them as plain buttons with no state; low-vision users get only a faint opacity delta (0.08 → 0.20 background) to distinguish selected from unselected.
- **Root cause**: Toggle buttons built without `aria-pressed` (or radio-group semantics for the mutually-exclusive source choice); the codebase already does this correctly elsewhere (`GenomeSelectorBar.tsx:46` Templates button has `aria-pressed`), so the pattern is established but inconsistently applied.
- **Impact**: selection state is invisible to assistive tech in the two places where choosing the wrong option dispatches a multi-minute CLI/UE task or silently changes which genomes the radar overlays.
- **Fix sketch**: Add `aria-pressed={active}` to the compare chips and `role="radiogroup"` + `role="radio" aria-checked` to the source cards; add a non-color cue (check icon or 2px border weight change) for the selected card.
