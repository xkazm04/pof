# UI Perfectionist — AI Behavior & Tactics

> Context: AI Behavior & Tactics (Game Systems)
> Files read: 9 (8 components + chart-colors lib + cross-references to FlowGraph/DamagePipelineDiagram for prior-art comparison)
> Total: 9 — Critical: 1, High: 4, Medium: 3, Low: 1

> Note on the brief's premise: The "heatmaps each ship their own colour scale" smell is real and severe — `flankColor`, `coverColor`, and a third copy of `flankColor` in SquadChoreographyEditor all hand-roll RGB lerps while `heatmapScale(t)` already lives in `src/lib/chart-colors.ts:248-264`. The "EQS pipeline diagram uses a custom flow-graph that already exists in other contexts" claim is partially true: `FlowGraph.tsx` (ScreenFlowMap) and `DamagePipelineFlow` are radial/edge-based — neither matches EQSPipelineDiagram's linear arrow-card flow, so this finding is recast as "pipeline-card chip primitive duplicated 4× across this context" rather than the flow-graph. The "testing sandbox lacks empty/loading states" claim is half-correct: there *is* a loading branch and an empty branch, but they regress in the regenerate-while-result-exists path.

## 1. Mountain icon positioned with `x`/`y` props inside an SVG — broken visual placement

- **Severity**: Critical
- **Category**: Polish / Bug
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis.tsx:451-455
- **Scenario**: Inside the obstacles `<g>`, the elevation marker renders `<Mountain className="w-2.5 h-2.5" x={sx - 5} y={sy - 5} style={{ color: ACCENT_ORANGE }} />`. Lucide's `<Mountain>` is itself a self-contained `<svg viewBox=...>` element; `x`/`y` props on a nested `<svg>` are positional in SVG but Tailwind's `w-2.5 h-2.5` (10px) sizing is applied via `width`/`height` attributes on that nested svg — meanwhile the React component does not forward arbitrary HTML attributes like `x`/`y` to the root `<svg>` predictably across lucide-react versions. The icon either renders at (0,0) of the parent SVG, vanishes off-canvas, or stacks at the parent origin rather than at `(sx - 5, sy - 5)`.
- **Root cause**: Lucide icons are designed for HTML/CSS positioning, not for being slotted as native SVG children. The `style={{ color: ACCENT_ORANGE }}` (CSS) won't reach `currentColor` strokes inside the nested svg without a `stroke` prop forwarded.
- **Impact**: The two elevation obstacles ("Ledge", "Stairway") are missing their visual signifier — the rect outline is the only cue. In the demo screenshot referenced by harness scenarios this looks like a styling bug, undermining the whole tactical-cover narrative.
- **Fix sketch**: Replace with a native `<g transform={`translate(${sx - 5}, ${sy - 5})`}>` wrapping a hand-authored 3-triangle mountain `<path>`, OR use a `<foreignObject x={sx - 5} y={sy - 5} width={10} height={10}>` containing the lucide component. Better: define a shared `<SvgIcon name="mountain" />` primitive in `src/components/ui/svg/` so future map glyphs aren't ad hoc.

## 2. Three independent RGB-lerp heatmap ramps ignore central `heatmapScale()`

- **Severity**: High
- **Category**: Design System / Color-scale Drift
- **File**: src/components/modules/game-systems/FlankAngleHeatmap.tsx:24-41 vs. TacticalCoverAnalysis.tsx:169-184 vs. SquadChoreographyEditor.tsx:58-72
- **Scenario**: `flankColor(angleDeg)` linearly interpolates `rgb(255,68,68) → rgb(234,179,8) → rgb(34,197,94)`. `coverColor(score)` does its own `rgb(248,113,113) → rgb(251,191,36) → rgb(74,222,128)`. SquadChoreographyEditor copy-pastes the entire flankColor function verbatim (line 58-72) instead of importing it. None of the three reference `STATUS_ERROR / STATUS_WARNING / STATUS_SUCCESS` (which would give the project's actual red/amber/green tokens) and none use `heatmapScale(t)` from `chart-colors.ts:248`. The result: three different reds for "bad" (`#FF4444`, `#F87171`, `#FF4444`), three different greens for "good" (`#22C55E`, `#4ADE80`, `#22C55E`), and the central canonical scale (`HEATMAP_STEP_1..5`, slate→teal→emerald) is completely orphaned.
- **Root cause**: No shared `divergingScale(t, mode: 'red-green' | 'red-amber-green')` helper. Each author wrote what they needed and the next author copy-pasted (literally, in Squad's case).
- **Impact**: A user viewing FlankAngle and TacticalCover side-by-side cannot rely on color memory — "good" reads as two different greens. Squad's flank arc stripe (line 504-510) and the FlankAngle reference circle disagree by 3 RGB values per channel despite measuring the *same physical quantity*. Theme changes (e.g. dark→light) miss all three.
- **Fix sketch**: Add `tacticalScale(t: number, kind: 'flank' | 'cover'): string` to `chart-colors.ts` returning a hex from canonical tokens (`STATUS_ERROR → STATUS_WARNING → STATUS_SUCCESS` for both, since the semantic ramp is identical). Replace all three local helpers with one import. Consider whether the `heatmapScale()` slate-emerald ramp should also be unified — but tactical scoring is genuinely red-amber-green so a second named ramp is warranted, just not three.

## 3. Pipeline-step chip primitive reimplemented 4× with subtle drift

- **Severity**: High
- **Category**: Component Architecture / Visual Consistency
- **File**: EQSPipelineDiagram.tsx:289-306 + 376-388, EQSComponentInventory.tsx:395-419, AITestingSandbox.tsx:92-107, SquadChoreographyEditor.tsx:701-716 + 736-742
- **Scenario**: The same "colored chip with name + tone-15 background + tone-30 border + optional cost/kind suffix" pattern is hand-built four times in this context alone. Drift inventory: EQSPipelineDiagram step badge uses `OPACITY_15` for bg + `30` literal for border; EQSComponentInventory kind badge uses `OPACITY_15` + `25` literal for parent border; AITestingSandbox pass/fail badges use `15` literal + `30` literal (not via `OPACITY_*`); Squad pipeline flow chips use `OPACITY_10` + `30` literal. So the same chip ranges from 10%-15% bg opacity and 25%-30% border opacity depending on author — readers perceive different "importance" purely from the styling accident.
- **Root cause**: No `<TonedChip color tone="solid|soft|outline" size>` in `src/components/ui/`. The brief's "spot inconsistencies" target — every consumer hand-builds `text-2xs px-1.5 py-0.5 rounded` and picks an opacity by feel.
- **Impact**: Pipeline visual language fragments across what should be the one most cohesive context (these are all "EQS step" representations). Cost badges in EQSPipelineDiagram and EQSComponentInventory should be visually identical — they aren't (different border opacity).
- **Fix sketch**: Extract `<TonedChip color={c} tone="soft" {...}>` primitive. Standardize on `OPACITY_15` for bg and `OPACITY_30` for border (the most common combo, used in both EQS files). Add `kind` and `cost` as composable child slots so AITestingSandbox's pass/fail counter and EQSPipelineDiagram's "Cost: High" reuse the same shell.

## 4. AITestingSandbox loses loading feedback when regenerating with stale results

- **Severity**: High
- **Category**: Polish / Missing States
- **File**: src/components/modules/game-systems/AITestingSandbox.tsx:111-137 (toolbar buttons) + AIBehaviorView.tsx:149-159 (sandbox tab loading branch)
- **Scenario**: Three issues stack: (1) The sandbox-tab loading branch (AIBehaviorView.tsx:149-154) only renders when `isLoading` is true *and there's nothing else to render* — it's the initial-fetch case. Once a suite is loaded and the user clicks "Run Tests" or "Generate All Tests", the only feedback is a 12px spinner *inside* the toolbar button (line 121, 135). The scenario list, the suite sidebar's pass/fail counts, and the per-scenario status dots are all stale until the CLI session completes — typically 15-60s for a generate run. (2) There is no skeleton, dimming, or pointer-events-none overlay on the scenario list during a run. (3) The empty-suite hero state (AIBehaviorView.tsx:288-330) duplicates the form fields that already exist in the sidebar (lines 222-251) — same input names, same handlers, same validation — so on a fresh project the user sees the form twice with no indication they're connected.
- **Root cause**: `isGenerating` is threaded only into the buttons that fired the request, not lifted to a list-level overlay. The empty hero was authored independently of the sidebar form.
- **Impact**: Users repeatedly click "Generate All Tests" thinking nothing happened; the second click is harmless but confusing. On the empty hero, users fill the centered form, see results render in the sidebar list, and the centered form does not clear or transition out.
- **Fix sketch**: (1) During `isGenerating`, render a `<div className="absolute inset-0 bg-surface-deep/40 backdrop-blur-[1px] pointer-events-none flex items-center justify-center"><Loader2 ... /> Generating tests…</div>` overlay on the scenario list. (2) On the empty hero, replace the duplicate form with a single `<EmptyState icon={FlaskConical} title body action={<Button onClick={focusSidebarInput}>Create Suite</Button>} />` that focuses the existing sidebar input — one form, one source of truth. (3) Move the existing `Loader2` from inside each button to a single header-level "Generating…" pill.

## 5. SVG drawing primitives (arcPath, ring generation, draggable arrow handle) duplicated across 4 files

- **Severity**: High
- **Category**: Component Architecture
- **File**: arcPath: FlankAngleHeatmap.tsx:116-143 ≡ TacticalCoverAnalysis.tsx:188-206; draggable forward arrow + handle: FlankAngleHeatmap.tsx:298-334 ≈ SquadChoreographyEditor.tsx:415-456; gradient-legend rect: FlankAngleHeatmap.tsx:451-465 ≈ TacticalCoverAnalysis.tsx:618-632; degree markings: FlankAngleHeatmap.tsx:278-296 ≈ TacticalCoverAnalysis.tsx:635-651 ≈ SquadChoreographyEditor.tsx:396-413; ring generation loop: AttackRingVisualizer.tsx:47-74 ≈ FlankAngleHeatmap.tsx:73-88
- **Scenario**: `arcPath(cx, cy, innerR, outerR, startAngle, endAngle)` is implemented twice byte-for-byte (only whitespace differs). The "draggable cyan forward arrow with marker, drag handle circle, and Forward label" is built three times with subtle differences in `arrowLen` (0.85 vs 0.7 vs 0.85), handle radius (10/10/10 — coincidence not contract), and pointer-down semantics (the handle vs the whole svg). The horizontal gradient legend with "0° Front / 180° Behind" labels is duplicated. Compass tick marks (8-point in Flank, 4-point in Cover, N/E/S/W in Squad) all live as inline arrays.
- **Root cause**: No `src/components/ui/svg/` primitive directory. Each diagram is treated as a one-off illustration rather than as instances of a shared "annular tactical diagram" component family.
- **Impact**: Bug fixes (e.g. the `largeArc` calculation when `endAngle - startAngle > Math.PI`) must be applied 2× and stay in sync. The Flank handle is at 0.85 of the radius, Squad's is at 0.7 — users dragging across the two diagrams perceive different "reach" even though the conceptual handle is identical.
- **Fix sketch**: Extract to `src/components/ui/svg/`: `annularArcPath()`, `<DraggableForwardArrow value={radians} onChange color={ACCENT_CYAN} radius={DRAW_RADIUS * 0.8} />`, `<GradientLegend leftLabel rightLabel scale={tacticalScale} />`, `<CompassTicks count={8} radius outerOffset={16} />`, `<AnnularRingPoints n radius scale color renderPoint />`. Even a partial extraction (just `arcPath` + `DraggableForwardArrow`) eliminates ~120 lines of dup.

## 6. AttackRingVisualizer is the structural outlier — different shell, raw rgba grid, no header strip

- **Severity**: Medium
- **Category**: Visual Consistency
- **File**: src/components/modules/game-systems/AttackRingVisualizer.tsx:79-99 (shell) + 119-125 (raw grid colors) vs. FlankAngleHeatmap.tsx:202-232, TacticalCoverAnalysis.tsx:282-311, PatrolPointsDistribution.tsx:73-102, SquadChoreographyEditor.tsx:150-193
- **Scenario**: Five tactical diagrams live side-by-side. Four of them (Flank, Cover, Patrol, Squad) wrap a `<SurfaceCard className="p-0 overflow-hidden">` with an internal header strip: icon-in-tinted-rounded-square + bold title + monospace subtitle + right-aligned action button. AttackRingVisualizer instead uses `<div className="p-4 space-y-3"><SurfaceCard level={2} className="p-3 relative overflow-hidden">` (line 79-80) with an inline header that stacks differently (icon + title in a flex without the rounded-square treatment, and a `blur-3xl` glow blob behind it). The grid lines use `rgba(255,255,255,0.04)` and `rgba(255,255,255,0.06)` literals (line 119-125, 274, 300) rather than `var(--border)` like its siblings. Distance label colors switch between `ACCENT_CYAN` (this file) and `ACCENT_VIOLET` (Patrol, Flank).
- **Root cause**: AttackRingVisualizer was authored before the other four (or in a different sprint) and the shell convention was never retrofitted. Raw white-alpha literals instead of the design-token `var(--border)` indicate a pre-token authoring date.
- **Impact**: When the user navigates the AI Behavior tab between diagrams, the "card chrome" jumps — different padding, different header treatment, a glow that the others don't have. The raw white-alpha grids will not respect a future light-theme switch; siblings will.
- **Fix sketch**: Conform AttackRingVisualizer to the four-sibling shell: `<SurfaceCard className="p-0 overflow-hidden">` + matching header strip (icon-square, title, subtitle, reset button on the right). Replace `rgba(255,255,255,0.04)` with `var(--border)` on grid lines, `rgba(255,255,255,0.06)` with `var(--border)` on crosshair. Drop the `blur-3xl` accent blob — none of the siblings have it. Or, alternately, propose adopting the blob across all five if that's the intended new convention; pick one.

## 7. AITestingSandbox suite sidebar uses fixed `w-56` with no responsive collapse

- **Severity**: Medium
- **Category**: Responsive
- **File**: src/components/modules/game-systems/AIBehaviorView.tsx:163-252 (the sandbox `extraTab.render`)
- **Scenario**: The sandbox tab content is a horizontal flex with a fixed `w-56` (224px) suite sidebar on the left and the `AITestingSandbox` taking `flex-1 min-w-0` on the right. There is no media-query collapse, no toggle, and no min-width below which the sidebar yields. At ~720px container width, the AITestingSandbox scenario rows truncate aggressively (the inline timeout input + "timeout: Xs" string + delete trash icon all collide in `ScenarioCard` lines 415-433). The pass/fail/draft summary row at line 175-187 wraps awkwardly because the badges use `text-2xs` with no `flex-wrap`. The empty hero at line 289-330 is unaffected because it's centered, but as soon as the user creates a suite the layout snaps to the constrained two-column.
- **Root cause**: Mobile-style breakpoints (`sm:`, `md:`) are used in the sibling diagrams (`flex-col sm:flex-row`) but the sandbox shell never adopted them.
- **Impact**: On half-width windows or split-pane editor users (a likely audience for an AI testing sandbox in a dev tool), the scenario list becomes unreadable. The suite sidebar and content panel both demand horizontal space neither has.
- **Fix sketch**: Wrap the layout: `<div className="flex flex-col md:flex-row h-full">` with the sidebar `w-full md:w-56 md:flex-shrink-0 border-b md:border-b-0 md:border-r`. Add `flex-wrap` to the summary badges row. Below 640px, consider hiding the per-suite stats (pass/fail/draft counts) behind a clickable "Show stats" disclosure since they're the densest content.

## 8. AIBehaviorView uses raw hex `text-[#4ade80]` / `text-[#f87171]` while the file already imports STATUS_SUCCESS / STATUS_ERROR

- **Severity**: Medium
- **Category**: Design System / Magic Numbers
- **File**: src/components/modules/game-systems/AIBehaviorView.tsx:177-186, 266-271
- **Scenario**: The same file imports `MODULE_COLORS, STATUS_SUCCESS` (line 16). It then renders summary badges with arbitrary Tailwind hex literals: `<span className="text-2xs text-[#4ade80]">{summary.passedCount} passed</span>` (line 178) and `<span className="text-2xs text-[#f87171]">{summary.failedCount} failed</span>` (line 181). The trash button at line 267 uses `hover:text-[#f87171] hover:bg-[#f8717110]` — same color, expressed differently. AITestingSandbox.tsx already correctly uses `STATUS_SUCCESS` and `STATUS_ERROR` for the *same conceptual badges* (line 95-103). The two files render visually identical badges via two completely different color paths.
- **Root cause**: Author copy-pasted the badge layout but inlined the colors. Tailwind 4 arbitrary-value-color works which masks the smell at runtime.
- **Impact**: Theme changes (or a future re-tuning of `STATUS_SUCCESS`) will skip these spots. Since AITestingSandbox's matching badges *do* use the tokens, the AIBehaviorView sidebar and the sandbox toolbar will visibly drift after any token tweak.
- **Fix sketch**: Replace `text-[#4ade80]` with `style={{ color: STATUS_SUCCESS }}`, `text-[#f87171]` with `style={{ color: STATUS_ERROR }}`, and `hover:bg-[#f8717110]` with `hover:bg-[color:STATUS_ERROR/10]` — or, ideally, build the same tonal-chip primitive from finding 3 and use it on both surfaces. Add an ESLint rule (`no-restricted-syntax` against `/text-\[#[0-9a-f]{3,8}\]/i` in className strings) to catch future regressions.

## 9. SquadChoreographyEditor codegen pre block lacks copy button, language label, and theming

- **Severity**: Low
- **Category**: Polish
- **File**: src/components/modules/game-systems/SquadChoreographyEditor.tsx:928-932
- **Scenario**: The "UE5 C++ Preview" tab generates ~115 lines of header-file C++ and renders it inside `<pre className="p-4 text-2xs font-mono text-text leading-relaxed whitespace-pre">{code}</pre>`. There is no copy-to-clipboard button, no syntax highlight, no language label ("C++"), and no scroll affordance even though the parent has `overflow-x-auto`. Compare to other code-display surfaces in the project (e.g. DamagePipelineDiagram surrounding panels which use `BlueprintPanel` chrome). The user's most likely action — copy the generated header into UE5 — has no UI affordance.
- **Root cause**: This view was added to demonstrate composition but the "user actually uses this" UX wasn't designed.
- **Impact**: Users select-all-copy with the keyboard or screenshot it. Either way the carefully-generated `${config.flankWeight.toFixed(2)}f` interpolations are wasted because friction is high.
- **Fix sketch**: Add a header-aligned `<button onClick={() => navigator.clipboard.writeText(code)}><Copy /> Copy</button>` next to the existing "Formation" pill. Add a `<span className="text-2xs font-mono">UARPGSquadDirector.h</span>` filename label. Wrap the `<pre>` in a `bg-surface-deep` panel with a subtle left-border accent (`border-l-2 border-l-[ACCENT]/40`) so it visually reads as a code block, not a transcript. Optional: drop in `prism-react-renderer` or the project's existing highlight setup if one exists.
