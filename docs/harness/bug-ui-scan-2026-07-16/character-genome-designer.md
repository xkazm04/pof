# Character & Genome Designer — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Source switch doesn't reset step-completion state
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard.tsx:58-68
- **Scenario**: User picks "Mannequin", dispatches Step 1 (Prepare Source) to completion, then goes back and picks a different source (e.g. a custom rig) via `pickSource`. Step 2 ("Wire mesh + skeleton + AnimBP") is already unlocked because `reachable(2)` only checks `steps[0] === 'done'`.
- **Root cause**: `pickSource` (lines 65-68) updates `source`/`assets` but never touches `steps`, and `reachable()` (lines 58-61) has no dependency on which source was actually prepared — only on whether *some* step-1 dispatch previously finished.
- **Impact**: The user can wire mesh/skeleton/AnimBP for a source that was never actually prepared by the CLI, producing a broken or mismatched character setup with the UI showing all-green step indicators.
- **Fix sketch**: Track which source id step 1 completed for (e.g. `preparedSource` state) and reset `steps` to `['idle','idle','idle']` (or re-lock steps 2/3) whenever `pickSource` selects a source different from the last prepared one.

### 2. Stale `isRunning` closure allows overlapping dispatches to the shared CLI session
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_character/wizard/CharacterSourceWizard.tsx:74-93
- **Scenario**: Once step 1 is done, steps 2 (and later 3) become simultaneously "reachable" per `reachable()`. If the user clicks "Wire Characters" and, within the same tick/before React re-renders `isRunning`, also triggers another dispatch (e.g. double-click, or a fast click on an already-reachable step while the first click's state update hasn't committed), both `dispatchWire`/`dispatchEnable`/`dispatchVerify` read the same stale `isRunning === false` and both call `execute(...)`.
- **Root cause**: The only guard against concurrent dispatch is the `isRunning` boolean from `useModuleCLI`, checked inside each `dispatchX` callback; it is not a synchronous ref-based lock, so two calls issued before the hook's state update commits both pass the `if (isRunning) return;` check. `activeStepRef` is used only to attribute completion after the fact, not to prevent the second dispatch.
- **Impact**: Two steps' prompts get sent to one shared CLI session; whichever `execute()` call actually starts overwrites `activeStepRef.current`, so the first task's real completion gets misattributed to the second step's status pill (marked done/error for the wrong step), and the genuinely-run step is left stuck on "running" forever.
- **Fix sketch**: Add a synchronous ref-based lock (e.g. `dispatchLockRef.current`) set at the very top of each `dispatchX` before any other work, checked and cleared alongside `isRunning`, so a second click cannot slip through before the render commits.

### 3. `useGenomeHistory` undo/redo is fully unwired — genome edits are irreversible outside manual checkpoints
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/useGenomeHistory.ts (whole file); src/stores/genomeStore.ts:119-123
- **Scenario**: A designer drags a slider in `CharacterGenomeEditor` (calls `updateProfile` → `storeUpdateGenome` → `genomeStore.updateGenome`), overwriting a field value with no confirmation and no way to revert unless they had previously created a named checkpoint via `createCheckpoint`.
- **Root cause**: `useGenomeHistory` implements a debounced, capped (50-entry) undo/redo stack, but it is not imported or referenced by `CharacterGenomeEditor.tsx`, `genomeStore.ts`, or any other file in the app (confirmed via repo-wide search — only a stray comment in `genome-checkpoint.ts` mentions it). The real genome state (`useGenomeStore`) has no `undo`/`redo` action at all.
- **Impact**: Every slider nudge is a silent, permanent mutation of the active genome (and, via `persist`, of localStorage) with no safety net; a single accidental drag on a genome without a recent checkpoint cannot be undone.
- **Fix sketch**: Either wire `useGenomeHistory` into `genomeStore`'s `updateGenome` path (snapshotting `genomes` on each debounced edit) and expose `undo`/`redo` actions + a keyboard shortcut/button in `CharacterGenomeEditor`, or remove the dead hook if checkpoints are the intended-only recovery mechanism (and make that explicit to users, e.g. an "unsaved changes" indicator prompting a checkpoint before risky edits).

### 4. Non-null assertion on genome lookup is a landmine if `genomes` is ever empty
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_character/genome/CharacterGenomeEditor.tsx:54
- **Scenario**: `const activeGenome = useMemo(() => genomes.find((g) => g.id === resolvedActiveId)!, ...)`. Today `deleteGenome` refuses to drop the last genome and `genomeStore`'s persist `merge()` falls back to fresh presets whenever the sanitized array is empty, so this can't currently be hit through normal UI — but nothing enforces that invariant at the `CharacterGenomeEditor` level itself.
- **Root cause**: The component trusts the store to always provide a non-empty `genomes` array and force-unwraps the `.find()` result instead of guarding for `undefined`.
- **Impact**: Any future change to `genomeStore` (a new bulk-delete action, an import path that doesn't go through `withUniqueId`, a preset-loading regression) that leaves `genomes` empty for even one render will throw inside `useMemo` during render, crashing the whole Character Blueprint tab with no visible error-boundary fallback in this file.
- **Fix sketch**: Guard with `genomes.find(...) ?? genomes[0]` (or an explicit empty-state early return) instead of the non-null assertion, so a future invariant violation degrades to an empty-state message rather than a render crash.

### 5. Power-curve crossover detection is numerically unstable for near-parallel curves
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_character/genome/sim-engine.ts:49-73
- **Scenario**: Two genomes have almost, but not exactly, identical per-level growth rates for a stat (e.g. `hpPerLevel` differs by a rounding-scale amount). `rateA === rateB` is false, so the code proceeds to `(v1a - v1b) / (rateB - rateA)`, dividing by a near-zero denominator.
- **Root cause**: Only the exact-equality case is special-cased; near-equal-but-not-equal rates aren't guarded, so tiny floating point/tuning differences swing `crossL` wildly, sometimes landing outside `[1,100]` (silently dropped) and sometimes landing just inside it.
- **Impact**: As a designer nudges a slider by a small amount while comparing two archetypes with very similar growth curves, the crossover marker on `LevelScaledPowerCurve` can flicker in and out of existence or jump to an unrelated level, making the "crossover point" feature look broken/noisy exactly when the curves are closest (the case designers most want a stable read on).
- **Fix sketch**: Add an epsilon threshold on `Math.abs(rateB - rateA)` below which the pair is treated as effectively parallel (same as the `rateA === rateB` branch) instead of computing an unstable division.

## UI findings

### 6. Comparison-table bar length ignores "higher is better" direction
- **Severity**: High
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_character/genome/GenomeComparisonTable.tsx:30-43
- **Scenario**: For a lower-is-better stat (any `COMP_STATS` entry with `higherIsBetter: false`, e.g. a cooldown or time-to-kill row), the archetype with the numerically largest (worst) value gets `barPct = (val / maxVal) * 100 = 100%`, so it renders the longest, fullest bar in the row — while `isBest`/the green highlight correctly go to the smallest value.
- **Root cause**: `barPct` is computed purely from `val / maxVal` (line 42) with no branching on `stat.higherIsBetter`, even though the "best" label and glow (lines 32, 43) do account for direction.
- **Impact**: A designer visually scanning bar lengths (the primary at-a-glance affordance of the table) will read the longest bar as "most/best" even on rows where it's actually the worst-performing archetype — the bar length and the best-value highlight actively contradict each other on every lower-is-better row.
- **Fix sketch**: For `higherIsBetter === false` rows, either invert the bar (`barPct = maxVal > 0 ? ((maxVal - val) / maxVal) * 100 : 0`) or keep bar length proportional to raw value but flip the fill color/direction so "longer" consistently reads as "better" across all rows.

### 7. "Show All" reshuffles the whole panel instead of just revealing more items
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_character/simulator/ArchetypeBalanceRadar.tsx:28-33
- **Scenario**: With 10+ archetypes, the default view (`displayResults`) is `balanceResults` sorted by `compositeScore` descending and sliced to the top 5. Clicking "Show All (N)" swaps to the raw, unsorted `balanceResults` order.
- **Root cause**: `displayResults` only sorts in the truncated branch (line 30); the `showAll` branch returns `balanceResults` as-is (line 29), so the ordering criterion silently changes between the two states of the same toggle.
- **Impact**: Score badges, the deviation heatmap columns, and the radar-overlay legend all visually reorder the moment the user expands the list, breaking the spatial mapping ("archetype X was the 2nd badge") they'd built up while comparing the top 5, and making it harder to relocate a specific archetype after expanding.
- **Fix sketch**: Sort `balanceResults` by `compositeScore` descending in both branches (only the slice differs between top-5 and show-all), so expanding only appends items rather than reordering existing ones.

### 8. Archetype identity relies solely on color across three dense visualizations
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_character/genome/GenomeComparisonTable.tsx:19-26; src/components/modules/core-engine/sub_character/genome/LevelScaledPowerCurve.tsx:140-143, 163-173; src/components/modules/core-engine/sub_character/simulator/ArchetypeBalanceRadar.tsx:72-88, 182-188
- **Scenario**: With up to 6 genomes (colors cycle through orange/emerald/violet/cyan/pink/warning-yellow in `CharacterGenomeEditor.addGenome`), the comparison table header dots, the power-curve line/legend, and the balance-radar badges/overlay legend all distinguish archetypes purely by hue — no shape, dash pattern, or persistent label token accompanies the color swatch in the densest views (power-curve overlay lines, radar polygon overlays).
- **Root cause**: The design system leans entirely on `withOpacity`/accent-color tokens for series identity with no secondary encoding channel (line style, marker shape, position-stable labeling).
- **Impact**: Users with color vision deficiency (or just visually similar accent colors like orange vs. warning-yellow at low opacity) cannot reliably tell which archetype a given power-curve line, radar polygon, or table column belongs to, especially once 4+ genomes are being compared simultaneously.
- **Fix sketch**: Add a secondary channel for the top comparison surfaces — e.g. distinct dash patterns per power-curve line, or always-visible name labels at the line/polygon endpoints — so identity doesn't collapse to color alone.

### 9. The level readout in the header pill can disagree with the slider directly beneath it
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_character/genome/LevelScaledPowerCurve.tsx:27, 96-97, 148-160
- **Scenario**: `displayLevel = hoverLevel ?? previewLevel` drives the "Lv.N" pill at the top of the panel (line 96) and the per-archetype value list, but the range/number inputs just below (lines 153, 156) are bound to `previewLevel` only. Hovering anywhere over the chart updates the top pill and the level marker line but leaves the slider thumb and number box showing the last clicked/typed level.
- **Root cause**: Two different pieces of state (`hoverLevel` and `previewLevel`) both feed "the current level" concept, but only one of the two visible level indicators (the pill) reflects the combined/hover value; the other (slider + number input) reflects only `previewLevel`.
- **Impact**: While mousing over the chart to inspect a different level, the number shown in the top pill and the number shown in the input box a few rows below can legitimately disagree, which reads as a bug/inconsistency to anyone comparing the two at a glance.
- **Fix sketch**: Either drive the slider/number input from `displayLevel` while hovering (committing `previewLevel` only on click/blur), or visually de-emphasize the pill during hover (e.g. a distinct "preview" style) so it's clear the two numbers are intentionally answering different questions.
