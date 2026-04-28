# UI Perfectionist — Level Design

> Context: Level Design (Content Creation)
> Files read: 9
> Total: 8 — Critical: 0, High: 4, Medium: 3, Low: 1

## 1. Two cohabiting visual languages — neutral surface tokens vs. hard-coded "violet sci-fi"
- **Severity**: High
- **Category**: Visual Consistency · Design System
- **File**: src/components/modules/content/level-design/LevelFlowEditor.tsx:325-470, ProceduralLevelWizard.tsx:260-533, RoomDetailPanel.tsx:79-348, StreamingZonePlanner.tsx:260-820
- **Scenario**: Open the Layout > Flow tab and Difficulty/Sync tabs back-to-back. The flow editor, room detail, procedural wizard and streaming planner ship a self-contained "violet/emerald glassmorphism" theme — `bg-violet-900/40`, `border-violet-900/30`, `text-violet-100`, `bg-emerald-600/5 blur-[100px]`, `shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]`, raw `rgba(10,10,25,0.6)` panels — while the surrounding `LevelDesignView` (sidebar, tabs, narrative, sync, difficulty) uses the design-system tokens (`bg-surface-deep`, `border-border`, `text-text`, `MODULE_COLORS.content`). The accent prop is plumbed through but ignored inside these subviews. Switching tabs feels like crossing into a different product.
- **Root cause**: Each spatial subview was authored standalone with literal Tailwind violet/emerald arbitrary values, ignoring `accentColor`, theme tokens, and the project's `MODULE_COLORS.content` accent that the parent already passes in.
- **Impact**: Theme switches (light mode in particular) and other content-module accents will look broken; the module no longer reads as part of "Content Creation"; brand consistency is lost across half the surface.
- **Fix sketch**: Replace literal `violet-*` / `emerald-*` classes and `rgba(10,10,25,…)` strings with `accentColor` + `withOpacity` (already imported) and surface tokens (`bg-surface-deep`, `border-border`, `text-text`, `text-text-muted`). The nodes that should stay "blueprint" (flow editor canvas) should derive their tints from `accentColor`, not hard-coded violet. Keep the visual richness but parameterise it on the accent already passed through props.

## 2. Difficulty arc chart re-implements axis/grid/tooltip primitives instead of a shared chart kit
- **Severity**: High
- **Category**: Component Architecture · Design System
- **File**: src/components/modules/content/level-design/DifficultyArcChart.tsx:60-302
- **Scenario**: The chart hand-rolls grid lines, axis labels, smoothed cubic path, area-fill, tooltip rect, and hover glow inside one 300-line SVG block. Other modules in the project (looking at the imports of `STATUS_*`, `withOpacity`, etc.) clearly already share chart-color tokens, so similar charts likely exist elsewhere — yet none of those primitives are reused here.
- **Root cause**: There's no shared `<LineChart>` / `<AxisGrid>` / `<ChartTooltip>` primitive in `@/components/ui` being consumed; the component invents its own coordinate system (`padX`, `padY`, `padBottom`, `diffToY`).
- **Impact**: Future charts in Combat Balance, Loot Economy, Difficulty Tuning will diverge in axis style, tooltip shape and hover behaviour. Tooltip width is also hard-coded (`width={100}`), so labels like `"Boss Arena — Diff 5 — buildup"` overflow.
- **Fix sketch**: Extract `ChartGrid`, `ChartAxisY`, `SvgTooltip`, and a `<SmoothedLine points={…} />` primitive into `@/components/ui/charts/`. Replace inline SVG with these. Make tooltip width content-derived (use `<text>` measurement or flex via foreignObject). Have `DifficultyArcChart` only own the domain logic (target zone, pacing icons, ordering).

## 3. Toast in `LevelDesignView` re-implements a notification system instead of using `sonner`
- **Severity**: High
- **Category**: Design System · Component Architecture
- **File**: src/components/modules/content/level-design/LevelDesignView.tsx:161-205, 341-355
- **Scenario**: After a feature-matrix import, the view shows a bespoke absolute-positioned toast — local `rvToast` state, manual `setTimeout(3000)` dismissal, custom border/color via inline `style` (`STATUS_SUCCESS`/`STATUS_ERROR`), no stacking, no swipe-to-dismiss, no a11y role. The project already lists `sonner` in the stack.
- **Root cause**: `sonner`'s `toast.success()` / `toast.error()` was not used; the import-result UI was inlined.
- **Impact**: Inconsistent feedback across modules (other modules likely use `sonner`), no `aria-live` announcement, multiple imports clobber each other instead of stacking, and toast position differs from anywhere else in the app.
- **Fix sketch**: Delete the `rvToast` state, effect, and JSX. Replace the two `setRvToast({…})` call sites with `toast.success(\`Imported ${data.imported} features\`)` / `toast.error(err.error ?? 'Import failed')`. Confirm `<Toaster />` is mounted at the app root and remove the duplicated dismissal logic.

## 4. `LevelFlowEditor` reimplements graph node + wire primitives that already exist (or should) as a shared `FlowGraph`
- **Severity**: High
- **Category**: Component Architecture
- **File**: src/components/modules/content/level-design/LevelFlowEditor.tsx:280-707
- **Scenario**: Pan/zoom/wheel handling, node drag math, "click empty space to deselect", connection-mode cursor change, hover glow filters, dashed animated link, search-and-filter drawer over a graph, autolayout grid — all of these are implemented from scratch in 700 lines. The Brain/persona modules (per memory) already use graph editors, and the Streaming Zone planner has parallel link-mode UX. The project also has React Flow / R3F available.
- **Root cause**: There is no `FlowGraph` / `NodeCanvas` primitive abstracting pan, zoom, drag, lasso, link mode and hit-testing; each spatial editor invents its own.
- **Impact**: Streaming Zone's link mode and the flow editor's link mode behave subtly differently (different cancel affordances, different hover-target highlight). Bug fixes (e.g., panning while a modal is open) have to be applied N times. Adding keyboard nav or accessibility once will require N rewrites.
- **Fix sketch**: Extract `<FlowGraphCanvas>` to `@/components/ui/graph/` exposing `nodes`, `edges`, `renderNode`, `onMove`, `onConnect`, `selection`, `pan/zoom`. Migrate `LevelFlowEditor` and `StreamingZonePlanner` to share it. Consider adopting `@xyflow/react` if the team is open — it removes ~500 lines and gets keyboard a11y for free.

## 5. Wizard sections lack a shared `StepNav` / section primitive — section headers diverge
- **Severity**: Medium
- **Category**: Component Architecture · Visual Consistency
- **File**: src/components/modules/content/level-design/ProceduralLevelWizard.tsx:267-463
- **Scenario**: Algorithm, Output Topology, Size Parameters, Environmental Logic each repeat the same `<h4 className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest …">` pattern with slightly different border-bottom rules and wrapper backgrounds (one section uses `bg-black/40 p-4 rounded-xl border border-violet-900/30 shadow-inner`, another doesn't). There is no `<StepNav>` or stepper indicating progress through the configurator.
- **Root cause**: Sections were authored independently; no `WizardSection` / `StepHeader` / `StepNav` primitive exists, so divergence between section chrome accumulates.
- **Impact**: Visual rhythm is uneven, the user can't tell if this is a single-screen form or a stepped wizard, and the "wizard" naming doesn't match the actual flat-form behaviour.
- **Fix sketch**: Create `WizardSection({ icon, title, hint, children })` in `@/components/ui/wizard/`. Either commit to a single-form layout (rename to `ProceduralLevelForm`) or add a real `StepNav` with 1-Algorithm → 2-Topology → 3-Sizing → 4-Constraints → 5-Generate; expose `current` and per-step validity. Remove section-level shadow/background drift.

## 6. Missing empty/loading/error states for procedurally generated config and Blender failures
- **Severity**: Medium
- **Category**: Polish · Missing States
- **File**: src/components/modules/content/level-design/ProceduralLevelWizard.tsx:194-248, 525-530; LevelFlowEditor.tsx:466-470
- **Scenario**: After "Export to Blender" or "Blockout in Blender", the only success path is a one-liner `setBlenderResult({ message, isError })`. There's no progress indicator beyond a spinning border, no retry, no "open in Blender" CTA, no copy-error-to-clipboard, no truncation for multi-line errors. The flow editor's blender result banner uses different styling (`border-emerald-500/30 bg-emerald-500/10`) than the wizard's, and persists indefinitely with no dismiss button.
- **Root cause**: The result is treated as a transient string rather than a structured `{ status, message, retry, action }` and is rendered ad-hoc in each surface.
- **Impact**: Failed exports leave an unrecoverable, undismissible banner. Long error messages clip. Two surfaces with the same domain action have visibly different result UI.
- **Fix sketch**: Define a shared `<OperationResult variant="success|error" onDismiss onRetry>` (or route both through `sonner` per finding #3). Add a dismiss `X`. For success cases, expose a "Focus Blender window" link via the existing MCP store. Auto-collapse after 6s but keep an icon button to reopen.

## 7. Inline-style and magic-number drift: opacity literals, color literals, raw rgba
- **Severity**: Medium
- **Category**: Design System
- **File**: src/components/modules/content/level-design/ProceduralLevelWizard.tsx:292-475 (ProceduralLevelWizard uses `${alg.color}15` string concatenation), RoomDetailPanel.tsx:88, 120-123, 327-331; LevelFlowEditor.tsx:328-329, 461-462; StreamingZonePlanner.tsx:262, 380-382, 653
- **Scenario**: The codebase has `withOpacity()` + `OPACITY_15` / `OPACITY_30` etc. tokens, and `LevelDesignView` uses them correctly. But inside ProceduralLevelWizard, RoomDetailPanel and parts of StreamingZonePlanner there are dozens of string-concat hex+alpha literals (`backgroundColor: \`${alg.color}15\``, `boxShadow: '0 0 30px ${withOpacity(MODULE_COLORS.content, '30')}'` — note the *string* `'30'` which only works because of how the helper coincidentally accepts it), and raw `rgba(167,139,250,0.05)` blur literals duplicated in 4 files.
- **Root cause**: Authors mixed two systems — sometimes calling `withOpacity(color, OPACITY_15)`, sometimes concatenating `\`${color}15\``, sometimes raw rgba — with no lint rule preventing it.
- **Impact**: Theme refactors (e.g., introducing alpha-aware OKLCH) won't catch the string-concat sites; the `'30'` string passed to `withOpacity` is fragile if the helper signature ever changes.
- **Fix sketch**: Sweep ProceduralLevelWizard, RoomDetailPanel, StreamingZonePlanner: replace every `\`${color}NN\`` with `withOpacity(color, OPACITY_NN)`. Replace duplicated `rgba(167,139,250,0.05)` shadow literals with a shared token (e.g., `SHADOW_GLOW_VIOLET` exported from `chart-colors.ts`) or, better, derive the shadow from `accentColor` so it tracks the module accent. Consider an ESLint rule banning string-template concatenation onto color variables.

## 8. SVG charts/diagrams have no accessibility affordances or reduced-motion gating
- **Severity**: Low
- **Category**: Accessibility-as-Polish
- **File**: src/components/modules/content/level-design/DifficultyArcChart.tsx:147-298, LevelFlowEditor.tsx:473-705, StreamingZonePlanner.tsx:368-648
- **Scenario**: Three central SVG surfaces (difficulty arc, flow editor, streaming grid) have no `<title>` / `<desc>`, no `role="img"` / `aria-label`, no keyboard navigation, and animate `<animate stroke-dashoffset>` perpetually with no `prefers-reduced-motion` gating. The pulsing emerald banner on Cancel-Link and the perpetual radar ring on selected zones run indefinitely.
- **Root cause**: A11y/motion polish was not part of the initial pass; SVG primitives weren't extracted (see #2/#4) so a11y can't be added in one place.
- **Impact**: Screen-reader users can't perceive the difficulty curve at all. Users with vestibular disorders see continuous motion they can't disable. Fails an obvious WCAG sweep without being a hard regression.
- **Fix sketch**: Add `role="img"` + `aria-label` summaries (e.g., "Difficulty arc, 7 rooms, 2 outside target zone, peak room: Boss Arena diff 5"). Wrap `<animate>` elements in a `useReducedMotion()` check (Framer Motion exposes this) and short-circuit to static dashes. Make hover glows use CSS so they respect `prefers-reduced-motion: reduce` automatically.
