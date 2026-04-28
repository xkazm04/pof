# UI Perfectionist — Asset Generation & Pipeline

> Context: Asset Generation & Pipeline (Visual Generation & Assets)
> Files read: 13
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Sibling editor surfaces each fork their own page header pattern

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/visual-gen/asset-forge/AssetForgeView.tsx:10-23, src/components/modules/visual-gen/asset-browser/AssetBrowserView.tsx:10-23, src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:69-82, src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:103-110, 182-189, 275-282
- **Scenario**: Every sub-module Tab body opens with the same shape: a centered `<div className="text-center">` containing `<h2 className="text-base font-semibold text-text">` plus an `<p className="text-xs text-text-muted mt-1">` description. There are at least six copies (Forge, Browser, Pipeline, LOD, Mesh Opt, FBX). Each fork is identical down to the typography and `mt-1` rhythm but lives next to slightly drifted copies that no future edit will touch in lockstep.
- **Root cause**: No shared `TabHeader` / `SectionHeader` primitive lives in `modules/shared/`, so every author re-implemented the same layout inline.
- **Impact**: A single typography change (e.g. `text-base` -> `text-sm`, color token swap) requires editing six call sites and risks visual drift. New tabs added later will guess at the convention.
- **Fix sketch**: Extract `<TabHeader title description align="center" />` (or `<SectionHeader>`) co-located with `ReviewableModuleView`. Migrate the six call sites in one pass. Keep the `max-w-2xl mx-auto space-y-6` outer wrapper as a `<TabShell>` if it is also recurring (it is — see Forge/Pipeline/LOD/Mesh/FBX).

## 2. Blender Pipeline tabs duplicate a `Card + LabeledInput + PrimaryButton + connection warning` form three times

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:103-159, 161-254, 256-336
- **Scenario**: LODGenerationTab, MeshOptimizationTab, and FBXConversionTab each render `rounded-lg border border-border bg-surface-secondary p-4 space-y-3` containing the same `<label className="block text-xs font-medium text-text mb-1">` + `<input className="w-full bg-surface-tertiary border border-border rounded-lg px-3 py-1.5 text-xs ...">` pattern, the same `bg-[var(--visual-gen)] text-white hover:brightness-110 disabled:opacity-50` button, and the same `{!connected && <p className="text-xs text-amber-400">Connect to Blender MCP first.</p>}` notice. Roughly ~80 lines of structural HTML are repeated three times.
- **Root cause**: No `<FormField label>`, `<TextInput>`, `<PrimaryAction>`, `<MCPConnectionGate>` primitives exist for this surface, so each tab inlines the entire form.
- **Impact**: Input height/padding (`py-1.5`), button styling, focus ring (currently absent on inputs — no `focus:border-[var(--visual-gen)]` here, unlike GenerationPanel/BrowsePanel inputs), and the connection-warning copy will drift. Already inconsistent with the input focus treatment in GenerationPanel.tsx:163.
- **Fix sketch**: Add `<TextInput label hint focusAccent />` + `<PrimaryButton variant="visual-gen" loading icon>` + `<MCPDisconnectedHint />` primitives. Each tab becomes ~25 lines of declarative form. Backfill the missing focus border on tab inputs in the process so they match GenerationPanel.

## 3. The 'visual-gen primary button' is hand-rolled six different ways

- **Severity**: High
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:207-216, src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx:116-126, src/components/modules/visual-gen/asset-viewer/ViewerToolbar.tsx:66-73, src/components/modules/visual-gen/material-lab/MaterialLabView.tsx:58-69, src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:140-149, 235-244, 317-326
- **Scenario**: The "fill" CTA appears with diverging sizes and treatments: Forge submit uses `px-4 py-2.5 rounded-lg text-sm` with `disabled:opacity-40`; Browser search uses `px-3 py-2 rounded-lg text-sm` with `disabled:opacity-50`; Viewer Load Model uses `px-2.5 py-1.5 rounded text-xs`; Material Lab Send-to-Blender uses a *tinted* (`bg-[var(--visual-gen)]/10`) variant with `disabled:opacity-40`; Pipeline tabs use `px-3 py-1.5 rounded text-xs` with `disabled:opacity-50`. Hover is uniformly `hover:brightness-110` but radius (`rounded` vs `rounded-lg`), padding scale, font size, and disabled opacity all differ.
- **Root cause**: No `Button`/`PrimaryButton` primitive in this domain; each surface chose its own size token.
- **Impact**: The accent button is the dominant CTA in the entire Visual Generation cluster — six visual variants for the same semantic action makes the cluster feel un-designed and fights muscle memory.
- **Fix sketch**: Define `<Button variant="primary|tonal" size="sm|md" accent="visual-gen">` with three canonical sizes (sm 28px, md 36px, lg 44px) and one disabled-opacity (40%). Replace all six call sites. Material Lab's tinted version becomes `variant="tonal"`.

## 4. AssetCard is the only `Card` primitive — but the rest of the cluster reinvents card surfaces inline

- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/visual-gen/asset-browser/AssetCard.tsx:20, src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx:34, src/components/modules/visual-gen/blender-pipeline/ScriptRunner.tsx:33, src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:112, 191, 284, 50-63
- **Scenario**: There are at least four distinct "card" recipes: AssetCard uses `rounded-lg border border-border bg-surface/50 overflow-hidden group hover:border-[var(--visual-gen)]`; JobCard uses `rounded-lg border border-border bg-surface/50` (no hover, plus `p-3`); ScriptCard uses `rounded-lg border border-border bg-surface/50 overflow-hidden` (with internal divider); the Pipeline tab forms use `rounded-lg border border-border bg-surface-secondary p-4`; the ResultBlock uses `rounded bg-emerald-400/5 border border-emerald-400/20` (different border alpha, no `lg`). Background tokens drift between `bg-surface/50` and `bg-surface-secondary`.
- **Root cause**: No shared `<Card variant>` primitive exists in `modules/shared/` for this cluster.
- **Impact**: Border-color and background drift becomes visible when these cards stack on the same screen (e.g. Pipeline tab shows `bg-surface-secondary` form-card directly above a `bg-surface/50` ScriptCard — two different greys for the same elevation level). Also blocks consistent hover/focus polish.
- **Fix sketch**: Extract `<Card variant="default|inset|status-success|status-error" interactive?>`. Pick one elevation token between `bg-surface/50` and `bg-surface-secondary` and migrate. Promote the AssetCard's `hover:border-[var(--visual-gen)] focus-within:border-[var(--visual-gen)]` interactive treatment to the shared primitive.

## 5. Tab/segmented selector pattern is hand-rolled three different ways with magic-number heights

- **Severity**: Medium
- **Category**: Visual Consistency / Magic numbers
- **File**: src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx:75-98, 103-147, src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx:73-87, 89-104, src/components/modules/visual-gen/asset-viewer/ViewerToolbar.tsx:84-99, src/components/modules/visual-gen/material-lab/PBREditor.tsx:159-173
- **Scenario**: The "selected = visual-gen accent" idiom has three sizes: large pills (`px-3 py-2 rounded-lg`, with both border and tinted bg) in mode/source selectors; small chips (`px-2.5 py-1`) in category/preview-mesh tabs; tiny segments (`px-2 py-1 rounded` inside a `bg-surface rounded p-0.5` tray) in render-mode. The selected style is sometimes `border-[var(--visual-gen)] bg-[var(--visual-gen)]/10 text-[var(--visual-gen)]` and sometimes solid `bg-[var(--visual-gen)] text-white` for what reads as the same level of selection. PBREditor preset chips meanwhile use `border` only, no fill, when active.
- **Root cause**: Three independent authors implemented "active/inactive button" without a shared `<SegmentedControl>` / `<ChoiceChip>`.
- **Impact**: Users can't tell from styling alone which choices are "exclusive radio-like" vs "navigation-like". Same surface (BrowsePanel) shows two different "selected" treatments stacked vertically (filled chip for category, tinted-border pill for source).
- **Fix sketch**: Define two primitives: `<SegmentedControl items value onChange size>` (filled, mutually exclusive, used for sources/modes/render-mode/category) and `<Chip selected onClick>` (for free-form tags like PBR presets). Pick one selected treatment per primitive.

## 6. Toast/result feedback is implemented inline with diverging shapes — and BrowsePanel just swallows errors

- **Severity**: Medium
- **Category**: Missing states / Polish
- **File**: src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx:51-57, src/components/modules/visual-gen/asset-browser/useAssetBrowserStore.ts:67-93, src/components/modules/visual-gen/material-lab/MaterialLabView.tsx:71-83, src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx:47-65
- **Scenario**: BrowsePanel's `handleSearch` has a literal `catch { /* Silent fail */ }` and `searchSketchfab` / `importToBlender` in the store also have empty error branches — a network failure produces an unchanging "Searching..." state with no feedback. Material Lab inlines its own `success/error` banners using two ad-hoc `<div className="flex items-center gap-1.5 ...">` blocks. Pipeline tabs use a third shape (`ResultBlock` with `bg-emerald-400/5 border-emerald-400/20`). The codebase has `sonner` as a stack dependency yet none of these surfaces use it.
- **Root cause**: No shared toast/inline-result strategy was chosen for this cluster, and at least one path was implemented as `catch {}`.
- **Impact**: Real failures appear as silently stuck UI; success feedback shape varies across sibling tabs that the user toggles between in seconds.
- **Fix sketch**: Adopt `sonner` for transient success/error toasts uniformly, OR extract `<InlineResult kind="success|error">` and use it in all three places. Fix the `Silent fail` catches to surface the error via toast or return an error state into the store. Match the visual treatment to the same `Card variant="status-*"` from finding 4.

## 7. ScriptCard elapsed-time formatting drifts from JobCard's

- **Severity**: Medium
- **Category**: Visual Consistency / Polish
- **File**: src/components/modules/visual-gen/blender-pipeline/ScriptRunner.tsx:28-30, src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx:27-29
- **Scenario**: Both files render an elapsed-seconds counter for a long-running job, but ScriptRunner uses `(...).toFixed(1)` while running and `(...).toFixed(0)` only for current running mid-elapsed — actually it inverts: `completedAt ? toFixed(1) : toFixed(0)`. JobCard uses `Math.round(...)` for both. So the same UI element ("elapsed seconds" in a queue card) ticks as `12s` in Forge and `12.0s` (after completion) in Blender pipeline — and a mid-running ScriptCard shows `12s` too, then *gains* a decimal when it finishes.
- **Root cause**: Each queue rolled its own elapsed formatter; no `formatElapsed(ms)` helper exists.
- **Impact**: Minor but jarring — same card pattern, two different time conventions. The "decimal appears on completion" jump in ScriptCard reads like a bug.
- **Fix sketch**: Add `formatElapsedSeconds(startedAt, endedAt?)` shared util. Pick one format (`12s` or `12.4s`) and apply everywhere. Bonus: extract `<JobCard>` / `<QueueShell>` since GenerationQueue and ScriptRunner are 90% the same component (status icon, label, elapsed, output, X-remove, "Clear completed" footer).

## 8. ViewerToolbar accent-color contrast risk on tinted toggle background

- **Severity**: Low
- **Category**: Accessibility-as-polish
- **File**: src/components/modules/visual-gen/asset-viewer/ViewerToolbar.tsx:138-144
- **Scenario**: The toggle "active" state is `text-[var(--visual-gen)] bg-[var(--visual-gen)]/10`. With `--visual-gen` being a saturated accent, the foreground-on-10%-tinted-background contrast is borderline. The same pattern in GenerationPanel.tsx:80-82 also adds a border to disambiguate, but ViewerToolbar's version omits the border, making the "active" state read as a faint glow only.
- **Root cause**: Two sibling implementations of the same active-toggle idiom, one with border and one without.
- **Impact**: On bright displays the "Grid/Axes/Rotate" toggles barely register as active. Same idiom inside the same module cluster shouldn't have two visual strengths.
- **Fix sketch**: Either add a 1px `border border-[var(--visual-gen)]/40` to the active toggle in ViewerToolbar, or fold into the shared `<SegmentedControl>` from finding 5 with a documented "active" recipe. Verify contrast ratio of `var(--visual-gen)` on `bg-surface + var(--visual-gen)/10` is >= 4.5:1 against the surface token.
