# UI Perfectionist — Procedural Generation & Rigging

> Context: Procedural Generation & Rigging (Visual Generation & Assets)
> Files read: 8
> Total: 7 — Critical: 0, High: 3, Medium: 3, Low: 1

## 1. Slider control inconsistency across sibling Views
- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx:278-432; src/components/modules/visual-gen/import-automation/ImportAutomationView.tsx:89-99
- **Scenario**: ImportAutomationView uses the shared `StyledSlider` primitive for the Scale parameter, while ProceduralEngineView renders 9+ raw `<input type="range" className="w-full" />` controls for terrain roughness, dungeon dimensions, room sizes, corridor width, vegetation area, etc. Two sibling Views in the same group ship two completely different range slider visual treatments side-by-side.
- **Root cause**: ProceduralEngineView was built without adopting the established `StyledSlider` component; the bare HTML range falls back to per-browser default chrome (no accent-color, no track styling, no value bubble).
- **Impact**: Native default sliders look unbranded next to the visual-gen accent treatment, and the "(value)" appended to each label compensates for what `StyledSlider` already shows. Migrating yields visual consistency and removes ~9 redundant value-in-label patterns.
- **Fix sketch**: Replace each `<input type="range">` block in GeneratorTab with `<StyledSlider min max step value onChange accentColor="var(--visual-gen)" label={...} />`. Drop the manual `(value)` suffix in the `<span>`-based label since StyledSlider renders the value. Keep the seed `<input type="number">` as is (different control class).

## 2. Selectable card pattern duplicated, not extracted
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx:243-256; src/components/modules/visual-gen/auto-rig/AutoRigView.tsx:78-84
- **Scenario**: Both Views render a "selectable accent card" with identical class signature: `text-left p-{3,4} rounded-lg border transition-colors` plus the conditional `border-[var(--visual-gen)] bg-[var(--visual-gen)]/10` vs `border-border hover:border-text-muted`. GeneratorTab uses it for the 3 generator buttons; RigPresetCard uses it as a wrapping div. The selected-state token pair is hardcoded in two places.
- **Root cause**: No shared `<SelectableAccentCard>` (or equivalent) primitive in `components/modules/visual-gen/` — each View reinvents the visual.
- **Impact**: If accent treatment changes (e.g., adds a ring, shifts opacity, tweaks padding), it must be edited in 2+ files; drift is near-certain. Also blocks reuse in any future visual-gen sibling View.
- **Fix sketch**: Extract `SelectableAccentCard` into `src/components/modules/visual-gen/_shared/` taking `{ selected, onSelect, accentVar, children }`. Replace both occurrences. Optional: take the accent var as a prop so other module groups can reuse with their own `--<group>` token.

## 3. Generator selector button has no focus-visible / keyboard cue
- **Severity**: High
- **Category**: Accessibility-as-polish / Polish
- **File**: src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx:243-256; auto-rig RigPresetCard inner button at AutoRigView.tsx:85-116
- **Scenario**: The generator-selector buttons and the RigPresetCard inner `<button>` rely solely on the `selected` border-color swap. There is no `focus-visible:` ring, no `outline`, and no hover indicator beyond the border color. Keyboard users tabbing through three generator cards or three rig preset cards see zero focus indication.
- **Root cause**: Buttons use `transition-colors` only; no `focus-visible` utilities applied; the parent `<div>` of the rig card holds the accent border, while the focusable child button inherits no ring.
- **Impact**: Fails WCAG 2.4.7 (Focus Visible) and is a real polish problem — power users navigating by keyboard cannot tell where focus is. Also affects screen-magnifier users.
- **Fix sketch**: Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--visual-gen)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-deep)]` to both card buttons. For the rig preset card's nested button, lift the focus ring to the visible card boundary by either making the wrapping div the button (preferred) or applying the ring to the inner button with `focus-visible:ring-inset`.

## 4. ImportAutomation toggle-pill style diverges from generator selector
- **Severity**: Medium
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/visual-gen/import-automation/ImportAutomationView.tsx:53-87, 134-153
- **Scenario**: ImportAutomation renders three different "pill / segmented" treatments for Source Format, Mesh Type, and Output tab — all use `bg-[var(--visual-gen)] text-white` for the active state and `text-text-muted border border-border` for inactive. Meanwhile the sibling generator selector in ProceduralEngineView uses an entirely different active-state convention (`border-[var(--visual-gen)] bg-[var(--visual-gen)]/10` with text-text). Two different "selected" idioms appear within the same module group.
- **Root cause**: No shared segmented-control / toggle-pill primitive. Each implementor chose their own active-state recipe.
- **Impact**: Users perceive inconsistent "selected" affordance language across sibling tabs in the same group; harder to learn the design system. Also: padding values vary (`px-2.5 py-1` vs `px-3 py-1.5` elsewhere) — magic numbers proliferate.
- **Fix sketch**: Create `<TogglePillGroup>` or `<SegmentedControl>` primitive accepting `options`, `value`, `onChange`, `accentVar`. Pick one canonical active-state (recommend the solid-fill pill since it is more affordance-clear). Replace both Format and Mesh Type groups, and the Import Script / DataAsset tabs.

## 5. Empty-preview placeholder shape inconsistent with generated-preview shape
- **Severity**: Medium
- **Category**: Polish / Responsive
- **File**: src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx:470-509
- **Scenario**: When a generator has no result yet, the Preview panel collapses to a single `<p className="text-xs text-text-muted py-8">Click Generate to create a terrain heightmap</p>`. After clicking Generate, the panel suddenly contains a 512x512 aspect-square canvas. The card jumps from ~60px tall to ~540px tall.
- **Root cause**: No skeleton/empty-state placeholder reserves the canvas footprint; the message is just inline text.
- **Impact**: Layout jumps after the first generation, the surrounding scroll position shifts, and the empty state feels half-finished compared to the polished bordered canvas. Three near-duplicate empty-state messages also drift from the same template.
- **Fix sketch**: Replace the three `<p>` placeholders with a single `<EmptyPreview message={...} />` component that renders a square dashed-border placeholder with the same `w-full max-w-[512px] aspect-square rounded-lg` shape so the panel size matches the post-generation state. Centralize the per-generator copy in a small map keyed by `activeGenerator`.

## 6. ExportFeedback and rig CreateResult use different success/error visual languages
- **Severity**: Medium
- **Category**: Visual Consistency / Design System
- **File**: src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx:137-164; src/components/modules/visual-gen/auto-rig/AutoRigView.tsx:132-143
- **Scenario**: ProceduralEngine `ExportFeedback` shows a tinted bg pill (`bg-emerald-500/5 rounded px-2 py-1.5`) with no icon. AutoRig's create-result shows an icon + text inline (`flex items-center gap-1 text-emerald-400`) with no bg. Both communicate "Blender-side action succeeded/failed" — one is a chip, the other is iconned text. The amber/red/emerald color trio is shared but the container shape is not.
- **Root cause**: Each component grew its own status-feedback affordance; no shared `<StatusBanner variant="success|error|pending">` primitive.
- **Impact**: Users can't pattern-match "Blender export succeeded" between the two views — one looks like a pill, the other looks like body text. Magic opacities (`/5` vs no bg) signal nothing semantic.
- **Fix sketch**: Add a `<StatusLine variant tone icon>` primitive in `_shared/`. Use it for ExportFeedback (variant="pending|success|error") and for the rig create-result block (variant="success|error"). Pick one container treatment — recommend the icon + tinted background combo so success/error/pending all read at the same hierarchy level.

## 7. Magic numbers in centered-content max-widths drift between siblings
- **Severity**: Low
- **Category**: Design System / Polish
- **File**: ProceduralEngineView.tsx:229 (`max-w-4xl`); AutoRigView.tsx:183 (`max-w-3xl`); ImportAutomationView.tsx:38 (`flex h-full`, no max-w)
- **Scenario**: Three sibling Views in the same module group use three different content-width strategies. Procedural Engine centers at `max-w-4xl`, Auto-Rig at `max-w-3xl`, Import Automation uses a fluid two-pane layout with no max width. There is no documented rationale.
- **Root cause**: Each View was authored without a project-level "module content width" token.
- **Impact**: On wide displays the three views feel inconsistent — Auto-Rig appears narrower than its sibling for no apparent reason. Future sibling Views will likely guess at yet another width.
- **Fix sketch**: Adopt a single `max-w-*` token per module-content variant (e.g., `max-w-form` ≈ 4xl, `max-w-split` for two-pane). Either standardize Procedural and Auto-Rig on the same width or document the difference. If Auto-Rig is intentionally narrower because it has fewer controls, encode that as a named variant rather than a magic number.
