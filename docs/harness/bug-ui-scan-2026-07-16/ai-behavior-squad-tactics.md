# AI Behavior & Squad Tactics — Bug + UI Scan

> Total: 10

## Bug findings

### 1. Delete Suite races an in-flight test run and has no confirmation
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/AIBehaviorView/SandboxTab.tsx:182 (delete button), src/components/modules/game-systems/AIBehaviorView/index.tsx:157-168 (run dispatch), :78-89 (bulk status update on completion)
- **Scenario**: Click "Run Tests" on a suite, then immediately click the trash icon on that same suite while the CLI test run is still executing. Neither the delete button nor the suite-switch buttons check `isAnyRunning`, and `deleteSuite` has no confirm step.
- **Root cause**: `handleRunTests` snapshots `runningIdsRef.current = activeSuite.scenarios.map(s => s.id)` at dispatch time and, on failure, later calls `bulkUpdateScenarioStatus(runningIdsRef.current, 'error', …)` unconditionally — with no check that the suite (or those scenario ids) still exist, and no guard preventing deletion mid-run.
- **Impact**: A misclick permanently deletes an entire suite with zero confirmation; if a run is in flight, the later failure path fires a PUT against scenario ids that no longer exist server-side, silently swallowed with no error surfaced.
- **Fix sketch**: Disable delete/suite-switch controls while `isAnyRunning` is true for the active suite; add a confirm step before `deleteSuite`; re-derive the "still exists" id set from current store state before the bulk status update instead of the dispatch-time snapshot.

### 2. Drag-to-rotate silently ends when the pointer exits the small SVG
- **Severity**: High
- **Category**: bug
- **File**: src/hooks/useDragAngle.ts:43-57, consumed by src/components/modules/game-systems/SquadChoreographyEditor/FormationView.tsx:53-55 and src/components/modules/game-systems/FlankAngleHeatmap/HeatmapSvg.tsx:40-49
- **Scenario**: Press the drag handle in either the Squad Choreography formation-angle control or the Flank Angle Heatmap, then move the mouse briskly toward the target angle. The SVG canvas is only ~360-380px; a fast drag easily overshoots its bounds.
- **Root cause**: `onPointerLeave` is wired to `onPointerUp`, ending the drag, and `onPointerDown` never calls `setPointerCapture` — pointer tracking is strictly scoped to staying inside the element, unlike a native slider or most drag widgets.
- **Impact**: Dragging silently stops the instant the cursor exits the SVG, with no visual cue; the user must re-grab the handle to continue, which reads as a broken/laggy control on a primary interaction of both editors.
- **Fix sketch**: Call `e.currentTarget.setPointerCapture(e.pointerId)` on pointerdown and track moves/up via the captured pointer (or a window-level listener) instead of relying on `onPointerLeave`.

### 3. Pillar cover-occlusion radius is double the rendered pillar size
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis/helpers.ts:38 (vs. rendering at CoverObstacles.tsx:25)
- **Scenario**: A cover point sits just outside a pillar's visibly-drawn circle (e.g. `pillar-2`, radius 25). The tool still scores it "covered" by that pillar.
- **Root cause**: `const blockRadius = obs.type === 'pillar' ? obs.w : Math.max(obs.w, obs.h) * 0.5;` — for pillars this uses the full `obs.w` as the blocking radius, while `CoverObstacles.tsx` draws pillars with `r={sw / 2}` (i.e. `w` is a diameter everywhere else, including the `wall`/`elevation` branch of this same ternary which correctly applies `* 0.5`).
- **Impact**: The occlusion math and the on-screen diagram disagree by 2x for every pillar; since this tool exists specifically to teach how EQS cover-position occlusion works, a user trusting the diagram draws the wrong conclusion about real cover geometry.
- **Fix sketch**: `obs.type === 'pillar' ? obs.w * 0.5 : Math.max(obs.w, obs.h) * 0.5`.

### 4. CoverCheckDistance is displayed as a controlling parameter but has zero effect
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis/CoverSidePanel.tsx:63 (label + "Geometry trace" description), helpers.ts:66-108 (`generateCoverPoints` signature, no `coverCheck` param), :5-64 (`isPointBehindObstacle`, no distance-gate parameter)
- **Scenario**: A user reads the "Generator Params" panel, sees `CoverCheckDist … Geometry trace`, and assumes changing/regenerating reflects this value in the cover computation.
- **Root cause**: `coverCheck`/`DEFAULT_COVER_CHECK` is threaded through the hook and displayed in the UI but never passed into `generateCoverPoints` or `isPointBehindObstacle` — it plays no role in the actual occlusion math.
- **Impact**: Classic success theater — a parameter presented as load-bearing for the algorithm's accuracy silently does nothing, misleading anyone using this as an EQS reference for real UE5 tuning.
- **Fix sketch**: Thread `coverCheck` into `isPointBehindObstacle`'s obstacle-distance gate (e.g. bound `perpDist`/`dirLen` checks by it), or relabel the field as illustrative-only.

### 5. Patrol boundary circles and coverage stats are computed from raw, unclamped radius constants
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/game-systems/PatrolPointsDistribution/helpers.ts:19-20 (clamp inside `generatePatrolPoints`), index.tsx:32-34, 93-114 (boundary circles), :227-281 (labels + Coverage Analysis text)
- **Scenario**: `EQS_PATROL_POINTS` (in the shared `eqs-defaults.ts`) is edited to an inverted/degenerate range — e.g. `maxRadius` less than `minRadius` — a plausible slip since these values are hand-maintained to mirror C++ engine defaults.
- **Root cause**: `generatePatrolPoints` clamps internally (`minR = Math.max(minRadius, 0); maxR = Math.max(maxRadius, minR + 1)`), but `index.tsx` draws the boundary rings, "MinRadius"/"MaxRadius" labels, and the Coverage Analysis area/density math directly from the raw unclamped constants — never from the clamped values that actually drove point placement.
- **Impact**: A degenerate config silently produces points in a tiny clamped annulus while the diagram still shows the original (wrong) boundary circles and a confidently-printed but incorrect coverage figure — no error or warning anywhere in the path.
- **Fix sketch**: Export the clamped `{minR, maxR}` from `generatePatrolPoints` and derive all rendering/labels/coverage math in `index.tsx` from that single clamped source; optionally `console.warn` when clamping actually changes the input.

## UI findings

### 6. "Best Positions" panel unmounts entirely on hover, causing layout jitter
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/TacticalCoverAnalysis/CoverSidePanel.tsx:141-178
- **Scenario**: Hover any point in the Tactical Cover diagram. The whole "Best Positions" section (title + 5 score bars) disappears from the side panel, then snaps back the instant the mouse leaves.
- **Root cause**: `{hoveredPoint === null && ( ... )}` unmounts the block rather than replacing/dimming its content, and nothing else fills the vacated space.
- **Impact**: Every exploratory hover over the diagram — the primary interaction of this module — causes the panel to visibly shrink and jump, reading as a rendering bug rather than intentional UX. The sibling Flank Angle Heatmap's side panel keeps its score list static regardless of hover, so this is also an inconsistency within the same context.
- **Fix sketch**: Keep the section mounted at all times; either dim/gray it while a point is hovered, or swap in inline hover detail without removing the block.

### 7. Squad member hover tooltip clips off-canvas near the east edge
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/SquadChoreographyEditor/SquadMemberGlyph.tsx:74-101 (tooltip anchor at `x={sx + 12}`, width 90), index.tsx:51 (`scale = DRAW_RADIUS / (maxDist * 1.15)`)
- **Scenario**: A squad member is positioned east of center in the formation view (a common layout for flanking formations). Hovering it should show flank-angle/distance/score text.
- **Root cause**: The tooltip is unconditionally anchored to the right of the member dot with no boundary check. Members can be placed up to `sx ≈ 312` in a 380px-wide viewBox, pushing the tooltip's right edge to ≈414px — well past the visible canvas.
- **Impact**: For members near the east edge, the tooltip text is partially or fully clipped/invisible, hiding exactly the information a designer is hovering to see.
- **Fix sketch**: Flip the tooltip to render left of the dot (`x = sx - 102`) when `sx > SVG_SIZE - 110`.

### 8. `transition-all`/`transition-colors` declared with no hover state actually wired
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/game-systems/PatrolPointsDistribution/index.tsx:52-65 (Regenerate button), src/components/modules/game-systems/AttackRingVisualizer/AttackRingControls.tsx:84-96 (bGenerateInnerRing toggle)
- **Scenario**: Hover the "Regenerate" button in Patrol Points, or the inner-ring toggle in Attack Ring Visualizer.
- **Root cause**: Both declare a `transition-all`/`transition-colors` class, but their background/border/text color is driven entirely by an inline `style={{...}}` bound to component state — there is no `hover:` class or `onMouseEnter`/`onMouseLeave` handler backing it, so nothing actually changes on hover.
- **Impact**: Zero hover affordance on these interactive controls, inconsistent with sibling controls in the same file tree that do implement working hover states (e.g. `EQSComponentInventory/ComponentCard.tsx:59` `hover:bg-white/3 transition-colors`, `AttackRingVisualizer/index.tsx:79` `hover:text-text transition-colors`).
- **Fix sketch**: Add matching `hover:` background/opacity variants, or drive a small hover-state flag into the inline `style` the same way the active/toggled state is already handled.

### 9. Drag-to-rotate handle has no keyboard alternative
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/FlankAngleHeatmap/HeatmapSvg.tsx:124-136 (drag handle `<circle onPointerDown=...>`), same pattern in SquadChoreographyEditor/FormationView.tsx's angle handle
- **Scenario**: A keyboard-only user tries to explore flank-angle scoring at an angle other than the default.
- **Root cause**: The only way to change `forwardAngle` is a pointer drag via `useDragAngle`; the handle has no `tabIndex`, `role="slider"`, or arrow-key handler. Only the separate "Reset" button is keyboard-reachable.
- **Impact**: WCAG 2.1.1 (keyboard operable) gap — the primary control of this view is entirely unusable without a mouse/touch pointer.
- **Fix sketch**: Make the handle focusable with `role="slider"` and `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, and wire arrow-key presses to call the same `onAngleChange` the drag uses.

### 10. Duplicated "create suite" form markup instead of a shared subcomponent
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/game-systems/AIBehaviorView/SandboxTab.tsx:137-167 (sidebar-footer variant) vs. :213-244 (empty-state variant)
- **Scenario**: A future change to the create-suite form (e.g. adding a field, changing validation messaging, or restyling the button) is made in one location.
- **Root cause**: The two variants are hand copy-pasted — identical Tailwind classes, the same two inputs, and the same button styling/logic — rather than extracted into one parameterized subcomponent.
- **Impact**: The two forms will silently diverge over time as edits land in only one copy, a maintenance/consistency risk for a component-architecture context that otherwise reuses shared UI pieces well.
- **Fix sketch**: Extract a `CreateSuiteForm` subcomponent taking `variant: 'sidebar' | 'empty-state'` (or just size/layout props) and use it in both places.
