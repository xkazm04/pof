# UI Perfectionist — Animation & Audio

> Context: Animation & Audio (Content Creation)
> Files read: 11
> Total: 9 — Critical: 0, High: 4, Medium: 4, Low: 1

## 1. Two parallel state-machine canvases drift apart with duplicated SVG/node primitives
- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: src/components/modules/content/animations/AnimationStateMachine.tsx:686-1002, src/components/modules/content/animations/StateMachineEditor.tsx:746-957
- **Scenario**: Both components render a percent-positioned canvas with absolutely-placed state nodes, an SVG layer with `<marker>` arrowheads, perpendicular-offset edges for bidirectional pairs, hit-area lines, "Entry" indicator and a bottom-right legend. Node sizes (`NODE_W=110/H=46` vs `NODE_W=120/H=52`), edge offsets (`edgeOffset=8`), arrow marker geometry, and rule-label rendering are all hand-coded twice with subtly different numbers and accents (ANIM_ACCENT vs EDITOR_ACCENT).
- **Root cause**: Two views were authored independently around the same mental model (state nodes + transitions on a 0–100% canvas) without extracting a shared graph primitive.
- **Impact**: Bug fixes to edge math (e.g. perpOffset, label clipping at length>30) must be applied twice; the two screens now look "almost the same" — same legend layout, same arrowhead, but different node dimensions, padding, type-strip width, and rule-label position. Users perceive this as a polish bug when navigating between them.
- **Fix sketch**: Extract `<StateGraphCanvas>` taking `nodes: { id, x, y, label, color, badge?, sublabel? }[]`, `edges: { from, to, rule?, variant }[]`, plus `selection` and `onNodeClick`/`onEdgeClick`. Move arrow markers, edge geometry, perp-offset, hit-area line, label clipping, entry indicator, and legend slot inside it. Make NODE_W/NODE_H, edgeOffset, perpOffset constants on the shared component. Both views become thin wrappers passing data + a custom node renderer.

## 2. AudioEventCatalog and SpatialAudioGeneratorPanel hardcode a parallel "cyber/blue" theme outside the design system
- **Severity**: High
- **Category**: Design System / Visual Consistency
- **File**: src/components/modules/content/audio/AudioEventCatalog.tsx:185-360, src/components/modules/content/audio/SpatialAudioGeneratorPanel.tsx:103-340, src/components/modules/content/audio/AudioPipelineDiagram.tsx:82-296
- **Scenario**: Three audio-tab panels are saturated with literal Tailwind classes (`bg-blue-900/40`, `text-blue-200`, `border-blue-500/50`, `text-emerald-400`, `bg-amber-950/20`) and inline `rgba(59,130,246,…)` strings, plus uppercase-mono "TOTAL_NODES", "EXECUTE GENERATION PROTOCOL", "INITIALIZE_HERE" copy. Sibling audio surfaces (AudioCodeGenPanel, AudioPropertyPanel, AudioView shell) use tokenized `MODULE_COLORS.content`, `withOpacity`, `text-text`, `border-border`, sentence-case labels.
- **Root cause**: These three panels were authored as a "cinematic" set without going through the existing `chart-colors`/`MODULE_COLORS` tokens or the shared SurfaceCard primitive, so they fork both the palette and the voice.
- **Impact**: Theme switching (any future light mode or accent change) won't touch them; copy-tone whiplash inside one tab strip ("Code Gen" panel uses normal labels, "Events" tab shouts "BUILD_AUDIO_MANAGER_NODE"); duplicated styling state to keep in sync.
- **Fix sketch**: Replace literal `blue-*`/`emerald-*`/`amber-*` classes with `withOpacity(MODULE_COLORS.content, OPACITY_*)` and `STATUS_*` tokens. Wrap the three panels in `SurfaceCard` like `AudioCodeGenPanel` does. Normalize copy to sentence case and remove the "_NODE", "_PROTOCOL", "_GROUP" suffixes — keep one mono-uppercase moment per panel (the heading), not 30. Lift the cyber treatment, if intentional, into a single `<TerminalPanel>` primitive with one canonical token recipe.

## 3. AudioPropertyPanel's preset/mode pill grid is reimplemented per-control
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/content/audio/AudioPropertyPanel.tsx:73-123, 191-209
- **Scenario**: ZonePropertyPanel renders REVERB_PRESETS (10 items) as wrap-pill buttons, OCCLUSION_MODES (5 items) as flex-1 segmented buttons, and EmitterPropertyPanel renders EMITTER_TYPES (5 items) as wrap-pills — each with its own copy of the "active vs inactive bg/border/text" branching, and crucially, two of them apply the active style with `bg-border-bright text-text` (a hard token swap that loses the accent), while the events catalog and StateMachineEditor use `withOpacity(accent, 15)` for selection. Same UX intent, three implementations.
- **Root cause**: No shared `<Segmented>` / `<PillGroup>` primitive in `@/components/ui`, so each panel inlines the active/inactive ternary.
- **Impact**: The Audio tab's selected-preset state visually differs from selected states everywhere else in the same module (StateMachineEditor priority pills, AudioEventCatalog category filters). Adding a new reverb preset means hand-editing markup; theming the active state requires N edits.
- **Fix sketch**: Extract `<PillGroup options={[{value,label,color?}]} value onChange variant="wrap"|"segmented" accent={MODULE_COLORS.content} />` rendering a single button style: `border + withOpacity(accent, 15) bg / accent fg` when active, `border + transparent bg / text-muted fg` when inactive. Replace REVERB_PRESETS, OCCLUSION_MODES, EMITTER_TYPES, the priority and spatial pickers in AudioEventCatalog, and StateMachineEditor's STATE_TYPE_OPTIONS with it.

## 4. Code-output panel + copy-button + filename header is duplicated across animation and audio codegen
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/content/animations/StateMachineEditor.tsx:1321-1393, src/components/modules/content/animations/AIComboChoreographer.tsx:843-884, src/components/modules/content/audio/AudioCodeGenPanel.tsx:148-232
- **Scenario**: Three places implement "header (icon + title + tab/filename) → copy button with `Copy/Check` swap and 1.5–2s timeout → `<pre>` with `font-mono text-2xs leading-relaxed overflow-auto max-h-[400-500px]`". The copy timeout uses a literal `1500` in AIComboChoreographer, `2000` in StateMachineEditor, and `UI_TIMEOUTS.copyFeedback` in AudioCodeGenPanel. Modal vs inline shells differ; the underlying primitive is identical.
- **Root cause**: No `<CodeBlock>` or `<CopyableCode>` shared component.
- **Impact**: Copy-feedback duration is inconsistent across the same module; styling drifts (one uses `border-border/40`, another `border-border/50`); the `<pre>` whitespace handling, scroll height cap, and font-size are independently tweakable per place.
- **Fix sketch**: Introduce `<CodeBlock title icon code language? maxHeight? onCopyTimeoutMs={UI_TIMEOUTS.copyFeedback}>` that renders the header, copy button (Copy ↔ Check swap), and `<pre>`. Optional `<CodeTabs tabs={[{id,label,code}]}>` wrapper for StateMachineEditor's full/enum/compute/setup case. Normalize all sites on `UI_TIMEOUTS.copyFeedback`.

## 5. Magic-number opacity literals leak everywhere — `${color}40`, `${color}0A`, `${color}80` instead of OPACITY tokens
- **Severity**: Medium
- **Category**: Design System / Polish
- **File**: src/components/modules/content/animations/StateMachineEditor.tsx:438-470, 808-870, src/components/modules/content/animations/AnimationStateMachine.tsx:472-517, 700-722, 893-925
- **Scenario**: Despite `OPACITY_*` constants being imported in both files, large blocks still hand-roll `${color}40`, `${color}0A`, `${color}50`, `${color}80`, `${color}15`, `${color}20`, `${color}60` directly into `borderColor`/`boxShadow`/`backgroundColor` strings. Same component then uses the proper `withOpacity(ACCENT, OPACITY_15)` token elsewhere in the same render. AnimationChecklist.tsx:528 even has a literal `withOpacity(typeColor, '70')`.
- **Root cause**: Incremental refactor toward the tokens didn't finish; new code copies neighboring lines.
- **Impact**: Three sources of truth for "the same green-tinted hover background"; future palette tweaks (e.g. raise minimum contrast) miss the literal-suffix call sites; `0A` (~4%) and `08` (~3%) are visually indistinguishable but inconsistent.
- **Fix sketch**: One-pass codemod: replace `${color}<2-hex>` patterns with `withOpacity(color, OPACITY_xx)` choosing the nearest defined token. Add a lint rule (eslint regex on string templates inside style props) to catch new offenders. Consolidate the small set actually used in visual recipes into named scales (e.g. `BORDER_SUBTLE=20`, `BG_TINT=15`, `BG_TINT_BOLD=20`, `GLOW_INNER=10`).

## 6. AnimationChecklist header uses retro CRT chrome that nothing else in the module shares
- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/content/animations/AnimationChecklist.tsx:312-344, 484-501
- **Scenario**: The checklist header renders `INTEGRATION_CHECKLIST.sys` in `font-mono uppercase tracking-widest` with `textShadow`, a 100px blur-glow corner, and a 32px grid background overlay — heavy chrome. Sibling tabs (StateMachine, AIComboChoreographer, ReviewableModuleView shell, AudioView header) use sentence-case `text-sm font-semibold`. Each step card then re-applies the same mono-uppercase treatment to titles + an `OK`/`Auto`/`Code` badge.
- **Root cause**: One-off "hero" treatment applied to a single subtab without coordinating with the others.
- **Impact**: Switching from "Setup Guide" to "State Machine" or "Combos" inside the same Animations view feels like navigating between two products. Title hierarchy (`text-sm font-bold tracking-widest uppercase` for h3, `text-[11px] uppercase` for body) is inverted compared to the rest of the app.
- **Fix sketch**: Demote the header to the standard module pattern: a `<SectionLabel icon={Workflow} label="Setup Guide" color={ACCENT} />` plus a normal `<NeonBar>` progress strip. Keep the 32px grid background only if AnimationStateMachine and StateMachineEditor adopt the same canvas treatment (they already render `linear-gradient(${accent} 1px, transparent 1px)` 32px grids — confirm and centralize as `<SchematicBackground accent />`). Remove `font-mono uppercase` from step titles; reserve mono for the `details[]` ordered list.

## 7. Property-panel field grid is reimplemented in StateMachineEditor instead of reusing AudioPropertyPanel's `Field`/`SliderField`
- **Severity**: Medium
- **Category**: Component Architecture
- **File**: src/components/modules/content/animations/StateMachineEditor.tsx:1070-1151, src/components/modules/content/audio/AudioPropertyPanel.tsx:251-283
- **Scenario**: AudioPropertyPanel exports private helpers `Field`, `SliderField`, `ActionButton` for "uppercase-tracked label + input" rows. StateMachineEditor's StatePropertyEditor and TransitionPropertyEditor open-code the same recipe — `<label className="text-2xs font-bold text-text-muted uppercase tracking-wider mb-1 block">` followed by an input with `bg-surface border border-border rounded text-xs font-mono`. Subtle drift: audio uses `font-semibold`, animations uses `font-bold`; audio has a `font-mono` toggle on body via `field-input`, animations spreads `font-mono` per-input.
- **Root cause**: `Field`/`SliderField` weren't promoted to a shared module location.
- **Impact**: Two places to maintain the form-row visual recipe; inputs in the state-editor sidebar have different label weight than the same-shape inputs in the audio property sidebar.
- **Fix sketch**: Move `Field`, `SliderField`, `ActionButton` into `@/components/ui/form` (or a sibling `_shared.tsx`). Normalize on `font-semibold` for the label (it's the existing convention in CSS class `field-input`). StateMachineEditor's StateProperty/TransitionProperty editors collapse to `<Field label="Name"><input className="field-input" /></Field>` rows.

## 8. AnimationStateMachine status copy mixes "RUNTIME / BRIDGE / SCANNED FROM PROJECT // CLICK TO IMPLEMENT" in one breath
- **Severity**: Medium
- **Category**: Polish / Information Hierarchy
- **File**: src/components/modules/content/animations/AnimationStateMachine.tsx:488-505
- **Scenario**: The header h3 contains the title + a `RUNTIME` chip + a conditional `BRIDGE` chip, then a subtitle that string-concatenates `${count}/${total} states${useBridgeData ? ' // LIVE FROM BRIDGE' : hasScannedData ? ' // SCANNED FROM PROJECT' : ' // CLICK TO IMPLEMENT'}`. In sim mode it swaps to `"Click a state to begin tracing"`. The result is two chips + a triple-fork sentence + an icon, all `font-mono uppercase tracking-widest`, and the chip says "RUNTIME" even when the actual data is fallback or bridge.
- **Root cause**: Status was added incrementally; "RUNTIME" became decorative rather than informative.
- **Impact**: Users can't quickly tell which data source is active — the always-on RUNTIME chip implies live data even on the FALLBACK_STATES path. The slash-slash separator and triple ternary are hard to scan at the small text size.
- **Fix sketch**: Replace the static RUNTIME chip with a single `<DataSourceBadge source={'bridge'|'scanned'|'fallback'|'sim'} />` whose color and label come from a single config map (`bridge → green BRIDGE`, `scanned → teal SCANNED`, `fallback → muted DEMO`, `sim → orange SIM`). Subtitle becomes plain `{count}/{total} states`. Remove the `// SEPARATOR // STYLE`. Same badge can show in StateMachineEditor's `EDITOR` slot for symmetry.

## 9. AudioPipelineDiagram active state has no responsive-narrow handling and `NODE_W` magic number leaks
- **Severity**: Low
- **Category**: Responsive
- **File**: src/components/modules/content/audio/AudioPipelineDiagram.tsx:82-262, src/components/modules/content/animations/AnimationStateMachine.tsx:166-167, src/components/modules/content/animations/StateMachineEditor.tsx:343
- **Scenario**: AudioPipelineDiagram is fixed `max-w-md mx-auto` with three vertically-stacked layer cards that each carry a 12-row icon, two columns of body, and a right-edge action stack divided by a 1px border. At narrow widths (< 380px, e.g. side panel collapsed), the right action column squeezes the description text into 4-line wraps and the locked-prereq pill overflows. AnimationStateMachine's `NODE_W=110, NODE_H=46` and StateMachineEditor's `NODE_W=120, NODE_H=52` are both pixel constants placed onto a percent-positioned canvas, so on small canvas heights (the `displayStates.length > 8 ? 450 : 350` in AnimationStateMachine) nodes overlap noticeably.
- **Root cause**: The pipeline card was designed for the empty-state center column at one width; the canvas node sizes were tuned for the typical 800×400 viewport.
- **Impact**: The pipeline diagram looks correct only at the empty-state width. The state-machine canvas overlaps when it has many states or a short container.
- **Fix sketch**: Add a `@container` query (Tailwind `@container` plugin) on the pipeline card so the right action column collapses to icon-only under ~340px and the description switches to single-line truncation. For canvases, scale node size with canvas height (`NODE_W = clamp(80, canvasH * 0.28, 130)`) or compute via ResizeObserver. Centralize the constants in the shared `<StateGraphCanvas>` proposed in finding 1.
