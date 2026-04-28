# UI Perfectionist — Abilities & Progression

> Context: Abilities & Progression (Core Engine (aRPG))
> Files read: 19
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Two SVG-graph editors implement node/wire/pin primitives independently with subtly different visual rules
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/gas-blueprint/RelationshipWebEditor.tsx:107-200; src/components/modules/core-engine/unique-tabs/gas-blueprint/WiringGraphEditor.tsx:278-516
- **Scenario**: Both files render an SVG canvas with positioned attribute nodes, hover/select state, drag-to-create relationships, animated flow dots, and an `id="gas-arrow"`/`id="gas-flow-arrow"` marker. The two diverge on node sizing (70×20 vs 140×28 from `NODE_W_GRAPH`), label truncation length (10 vs 18 chars + ellipsis), pin radii, fill opacities (`OPACITY_10`/`OPACITY_20` vs `OPACITY_5`/`OPACITY_8`/`OPACITY_12`/`OPACITY_15`), and stroke widths — yet visually they read as the "same" graph metaphor inside one editor.
- **Root cause**: No shared `<GraphCanvas>`/`<GraphNode>`/`<GraphWire>` primitive. Each editor reinvents pin geometry, hover state, the animated `circle` + `<animateMotion>`, and the rubber-band drag overlay.
- **Impact**: Drift between the two graph views inside a single product surface (different node padding, different selection treatment, different arrowhead opacity from `OPACITY_40` vs `OPACITY_50`) — the user perceives the wiring graph and relationship web as two different editors instead of two views of one model.
- **Fix sketch**: Extract `gas-blueprint/_graph/{GraphCanvas, GraphNode, GraphWire, GraphPin, RubberBandLine}.tsx` taking `{ nodes, wires, onNodeDrag, onPinDrag, selection }`. Move the `<defs><marker>`, grid pattern, hover/select dimming math (lines 393-401 of WiringGraphEditor), and the bezier `wirePath` helper into the primitive. Both editors render different `nodes`/`wires` shapes against the same canvas, eliminating the two arrowhead markers and the two different node-truncation rules.

## 2. Code-output panel chrome is hand-rolled with hardcoded `#0d1117`/`#0a0a15` four times
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/progression/XpTableGenerator.tsx:288, 342-355; src/components/modules/core-engine/unique-tabs/progression/DRCodeGenerator.tsx:304-317; src/components/modules/core-engine/unique-tabs/gas-blueprint/CodePreview.tsx:64; src/components/modules/core-engine/unique-tabs/AbilityForge/CodeBlock.tsx:11-23
- **Scenario**: Five code/CSV/struct viewers each render a "filename header bar + scrollable pre" pattern, but with three different hex backgrounds (`#0d1117`, `#0a0a15`, `#060612` for the wiring canvas, plus `bg-zinc-950/50` in `CodeBlock`), three different border tokens (`border-border/30`, `border-border/40`, `border-zinc-800`), and three different copy-affordance positions. `AbilityForge/CodeBlock.tsx` is the only one that already abstracts this — the progression generators ignore it.
- **Root cause**: `CodeBlock` exists as a candidate primitive but only AbilityForge uses it. The progression and gas-blueprint authors hand-rolled equivalents with different magic colors.
- **Impact**: Three "near-identical" code panels visible in one tab look subtly different (background hue, border opacity), eroding the "one editor, many outputs" feel and leaking design-system tokens.
- **Fix sketch**: Promote `AbilityForge/CodeBlock.tsx` to `_shared/CodePanel.tsx` accepting `{ filename, code, accent, action }`. Pick one canvas color (e.g. `bg-surface-deep`) and one border. Replace the hand-rolled `pre` blocks in `XpTableGenerator` (line 342), `DRCodeGenerator` (line 304), and `CodePreview` (line 64). The hex `#0d1117`, `#0a0a15`, `#060612` should not appear in TSX.

## 3. Tab-pill button is reimplemented inline in three editors with the same structure
- **Severity**: High
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/progression/XpTableGenerator.tsx:264-284; src/components/modules/core-engine/unique-tabs/progression/DRCodeGenerator.tsx:279-298; src/components/modules/core-engine/unique-tabs/progression/DiminishingReturnsVisualizer.tsx:21-35
- **Scenario**: Three sibling files render a `flex gap-1` row of tab buttons. Each computes `backgroundColor: ${ACCENT}${OPACITY_15}` / `borderColor: ${ACCENT}${OPACITY_30}` / `color: ACCENT | text-muted` inline. Same className string (`"px-2.5 py-1.5 rounded-lg text-2xs font-mono font-bold transition-all border"`) repeated literally. The `DiminishingReturnsVisualizer` variant uses `px-3` and `text-xs` — same idea, slightly different sizing, no apparent reason.
- **Root cause**: No `<TabPill>` / `<SegmentedControl>` primitive in `_shared`. Each editor copies the pattern.
- **Impact**: Inconsistent padding (`px-2.5` vs `px-3`) and font size (`text-2xs` vs `text-xs`) across tabs in the same view (Progression page renders all three together), which looks like accidental drift.
- **Fix sketch**: Add `_shared/TabPill.tsx` (or `SegmentedTabs.tsx`) accepting `{ tabs: {id, label}[], value, onChange, accent }`. Standardize on one size. Replace all three sites; verify the rendered output is uniform.

## 4. Tag concatenation `${color}${OPACITY_X}` mixed with `withOpacity(color, OPACITY_X)` in the same file
- **Severity**: High
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/progression/XpTableGenerator.tsx:222, 276-278, 312, 326, 361-363, 373; src/components/modules/core-engine/unique-tabs/progression/DRCodeGenerator.tsx:214, 290-292; src/components/modules/core-engine/unique-tabs/gas-blueprint/WiringGraphEditor.tsx:423-424; src/components/modules/core-engine/unique-tabs/gas-blueprint/RelationshipWebEditor.tsx:167-169, 206
- **Scenario**: `XpTableGenerator` line 222 writes `borderColor: \`${STATUS_SUCCESS}${OPACITY_30}\`` (raw string concat — assumes `OPACITY_30` is a hex tail like `"4d"`), but lines 312 and 373 in the same file use `withOpacity(STATUS_WARNING, OPACITY_10)` (the helper). `DRCodeGenerator` mixes both. `WiringGraphEditor` line 423-424 uses string-template concat plus extra `${withOpacity(...)}` interpolation wrapped in `\`${...}\`` for no reason.
- **Root cause**: The opacity tokens were imported as both raw hex suffixes and as numeric inputs to a helper, depending on author. Both styles are tolerated by the codebase, so neither is canonical.
- **Impact**: When a designer changes `OPACITY_30` from `"4d"` to a number, half the surfaces break silently. The redundant `\`${withOpacity(...)}\`` wrappers are clutter and a tell that the author was unsure which API was correct.
- **Fix sketch**: Audit `chart-colors.ts` to expose only the `withOpacity(color, opacity)` helper (not raw suffix constants). Replace every `${color}${OPACITY_X}` site with `withOpacity(color, OPACITY_X)`. Drop redundant template-string wrappers like `\`${withOpacity(...)}\``. ESLint rule banning string concat against an `OPACITY_*` import would catch regressions.

## 5. `XpSourceBreakdown` renders the bar label twice, overlapping the percentage label
- **Severity**: Medium
- **Category**: polish
- **File**: src/components/modules/core-engine/unique-tabs/progression/XpSourceBreakdown.tsx:35-54
- **Scenario**: Each row shows `<span>{src.label}</span>` and `<span>{src.pct}%</span>` above the bar (lines 35-38), then renders the same label again *inside* the bar — `{src.label} - {src.pct}%` (line 52) — overlaid with a `drop-shadow-sm`. For "Monster Kills - 60%" the inner text crowds the bar; for the 10% segments ("Boss Kills", "Exploration") the text overflows the colored fill into the dark background.
- **Root cause**: Two attempts at the same affordance (header pair vs in-bar label) were both shipped. No design rule for "label inside vs outside bar" by width threshold.
- **Impact**: Information duplication on every row; the inner text becomes illegible at narrow widths and on the 10% bars. Drop-shadow against a colored fill at 70% opacity reads as muddy.
- **Fix sketch**: Pick one. If the bar must show its own label, drop the header row and gate the inner label on `pct >= 25` (use the header for narrow rows). Otherwise remove the inner `{src.label} - {src.pct}%` overlay entirely and let the header row carry the data.

## 6. Tag-rule SVG visualization uses a fixed `380` viewBox while the editor below is responsive
- **Severity**: Medium
- **Category**: responsive
- **File**: src/components/modules/core-engine/unique-tabs/gas-blueprint/TagRulesEditor.tsx:106-145
- **Scenario**: The visualization SVG sets `viewBox="0 0 380 ..."` with hardcoded x positions (rect at x=4 width=110, arrow x1=118 x2=168, target rect at x=172, conflict badge at x=290 width=80). The editable rule list below uses Tailwind responsive flex inputs. At narrow viewports the SVG scales but the editor list stays full-width, so they misalign; at wide viewports the SVG stretches the rule cards horizontally while text stays the same fontSize.
- **Root cause**: SVG was authored for a fixed canvas; layout tokens not propagated. Conflict badge truncates if `targetTag` is long because positions are absolute (no flex).
- **Impact**: Two parallel views of the same data (graph + list) drift apart at non-default widths. Conflict badge can clip off the right edge of the canvas at narrow widths.
- **Fix sketch**: Either (a) constrain SVG to `max-w-[380px]` matching the editor list intrinsic width, or (b) compute positions from a measured ref width using `useResizeObserver`. Move the conflict badge into a per-row HTML overlay aligned with each rule rect via `position: absolute` + computed top, eliminating the x=290 cliff.

## 7. Per-editor bespoke chrome (column headers, intro text, stat strip) instead of a panel-frame primitive
- **Severity**: Medium
- **Category**: component-architecture
- **File**: src/components/modules/core-engine/unique-tabs/gas-blueprint/WiringGraphEditor.tsx:280-291, 519-544; src/components/modules/core-engine/unique-tabs/gas-blueprint/RelationshipWebEditor.tsx:108-110; src/components/modules/core-engine/unique-tabs/gas-blueprint/TagRulesEditor.tsx:104-105
- **Scenario**: Each gas-blueprint sub-editor opens with `<div className="text-2xs text-text-muted">…</div>` instructional copy plus, optionally, a column-header row, and closes with a stats/legend bar. The wiring editor adds a "Reset Layout" button only when overrides exist; the relationship editor never offers reset; the tag-rules editor has no header row at all.
- **Root cause**: No `EditorPanelFrame` shell with slots for `{ instructions, headerRow, canvas, statsBar, actions }`. Each editor reinvents the chrome.
- **Impact**: When all three editors render in the same tab, the visual rhythm is uneven — different vertical spacings (`space-y-2` everywhere, but with/without the column header eats up to 28px of difference) and inconsistent affordances (only one editor lets you "Reset Layout"). The `AbilitySpellbook/constants.ts:65-93` pattern of identical `featureNames: []` placeholders for half the SECTIONS hints at rushed authoring.
- **Fix sketch**: Define `gas-blueprint/_chrome/EditorFrame.tsx` exporting `<EditorFrame title icon instructions actions stats>{canvas}</EditorFrame>`. Mandate every sub-editor uses it. Move "Reset Layout" semantics into a generic `actions` slot fed from each editor's local-override state.

## 8. Form-input styling string duplicated across every editor with no `<NumberField>` component
- **Severity**: Low
- **Category**: design-system
- **File**: src/components/modules/core-engine/unique-tabs/progression/XpTableGenerator.tsx:240-242, 247-249, 254-256; src/components/modules/core-engine/unique-tabs/progression/DRCodeGenerator.tsx:222-227, 231-236, 240-245; src/components/modules/core-engine/unique-tabs/gas-blueprint/TagRulesEditor.tsx:155-159, 180-184
- **Scenario**: The exact string `"flex-1 bg-surface-deep/50 border border-border/40 rounded px-2 py-1 text-2xs font-mono text-text text-right focus:outline-none focus:ring-1 focus:ring-amber-500/50"` (or its near-twin) appears 6+ times. The TagRulesEditor variant changes `bg-surface-deep/50` → `bg-surface-deep`, drops the focus ring, and adds conditional `borderColor` via inline style.
- **Root cause**: No `<NumberField label value onChange min max step />` or `<TagInput>` primitive in `_shared`. Each form is hand-rolled.
- **Impact**: Focus styles drift (some inputs have `focus:ring-1 focus:ring-amber-500/50`, others have only `focus:outline-none`), which is also an accessibility-as-polish regression — keyboard focus is invisible on the TagRulesEditor inputs.
- **Fix sketch**: Add `_shared/NumberField.tsx` and `_shared/TextField.tsx` with one canonical focus treatment (visible 1px ring in accent color, never `outline-none` without a replacement). Replace all 9+ occurrences. The `min`/`max`/`step` props become first-class instead of repeated attribute soup.
