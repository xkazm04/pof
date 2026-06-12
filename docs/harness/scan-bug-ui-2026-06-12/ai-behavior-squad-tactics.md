# AI Behavior & Squad Tactics — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Enter key bypasses the in-flight guard — duplicate test suites on double/held Enter
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:75`
- **Scenario**: User types a suite name and presses Enter twice (or holds Enter — key auto-repeat) while the POST is still in flight. Both inputs wire `onKeyDown` → `handleCreateSuite()` (lines 226, 234, 303, 311). The Create button is disabled by `isCreating`, but `handleCreateSuite` itself only checks `if (!name) return;` — it never checks `isCreating`. The name isn't cleared until after the first `await createSuite(...)` resolves, so every repeat fires another `create-suite` POST.
- **Root cause**: The double-submission guard lives only on the button's `disabled` prop; the keyboard submission path calls the handler directly, and the handler assumes it can't re-enter while `isCreating` is true.
- **Impact**: Duplicate suites (held Enter on a slow network can create dozens), each triggering a full `mutate` → refetch round-trip — a self-inflicted request storm and a polluted suite list the user must clean up by hand.
- **Fix sketch**: First line of `handleCreateSuite`: `if (isCreating) return;` (and add `isCreating` to the deps). Optionally also gate the `onKeyDown` handlers, but the handler-level guard covers all entry points.

## 2. Failed suite creation silently wipes the user's input — mutate swallows the error, handler clears anyway
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:79` (root in `src/hooks/useCRUD.ts:75-84`)
- **Scenario**: User fills in "Enemy AI Combat Tests" + a target class and clicks Create while the API errors (server restart, validation reject, network drop). `useCRUD.mutate` catches the throw, logs `console.error`, and returns `null` — it never sets the hook's `error` state (that state is only written by `refetch`). `handleCreateSuite` ignores the return value and unconditionally runs `setNewSuiteName(''); setNewTargetClass('');`.
- **Root cause**: The handler assumes `await createSuite(...)` resolving means success, but the hook's contract is "resolves with `null` on failure" — failure and success are indistinguishable on the unchecked happy path, and no UI surface renders mutation errors.
- **Impact**: Success theater: the form clears as if it worked, no error appears anywhere, no suite appears in the list, and the typed name/target class are lost. The same unchecked-`null` pattern affects `deleteSuite`/`createScenario` callers.
- **Fix sketch**: In `handleCreateSuite`, branch on the result: `const suite = await createSuite(...); if (!suite) { setIsCreating(false); /* show inline error, keep inputs */ return; }` and only clear inputs on success. Longer term, have `useCRUD.mutate` expose a mutation error (state or thrown) instead of silently returning `null`.

## 3. Pillar cover model uses `w` as block radius but renders it as diameter — "covered" points float in open ground
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/game-systems/TacticalCoverAnalysis.tsx:100` (render at line 389)
- **Scenario**: User looks at points near Pillar A/B/C. `isPointBehindObstacle` treats a pillar's `w` as its blocking radius (`blockRadius = obs.w`, +30 slack → Pillar A blocks within 75 UU of the LOS line), matching the interface comment "for pillars: radius" (line 39). But the SVG draws the pillar with `r={sw / 2}` — half that, treating `w` as a diameter (~22.5 UU). Points up to ~3.3× the drawn pillar radius away are classified covered (0.7–1.0 score, green, LOS trace lines drawn) while visually sitting in open ground beside a small dot.
- **Root cause**: The same field is interpreted as radius by the cover math and as width/diameter by the renderer; nothing ties the two interpretations together, so the model and the picture disagree silently.
- **Impact**: Wrong results in the headline output: covered counts, heatmap arcs, and the "best position" glow all derive from the inflated 75 UU block zone, making the visualization look broken/arbitrary around pillars — the exact geometry the tool exists to explain.
- **Fix sketch**: Pick one convention. Either render pillars with `r={sw}` (w = radius, matching the comment and the math), or change the math to `blockRadius = obs.w * 0.5` for pillars. Add a `pillarRadius(obs)` helper used by both the trace check and the `<circle>` so they can't diverge again.

## 4. Copy-to-clipboard failure is an unhandled rejection — user pastes stale clipboard contents into UE5
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/game-systems/multiplayer/ReplicationScaffoldPanel.tsx:63-68`
- **Scenario**: User clicks "Copy" on the generated `GetLifetimeReplicatedProps()` block while the document isn't focused (clicked through from another window) or clipboard permission is denied. `navigator.clipboard.writeText` rejects; `copyCode` has no try/catch, and the `onClick` doesn't handle the rejected promise.
- **Root cause**: The handler assumes `writeText` always resolves. On rejection the "Copied" state correctly never shows, but no failure feedback shows either — the click just silently does nothing, plus an unhandled promise rejection in the console.
- **Impact**: A user who half-notices the missing "Copied" tick pastes whatever was previously on the clipboard (e.g., the *last* Blueprint's boilerplate) into their UE5 source — adjacent to the known stale-result hazard from the 06-09 report. Low likelihood, real consequence.
- **Fix sketch**: Wrap in try/catch: on failure set a transient `copyFailed` state and render "Copy failed — select & copy manually" on the button. Reuse the same pattern as the success feedback timeout.

## UI findings

## 5. Suite deletion is instant, unconfirmed, and irreversible — one misclick destroys all scenarios
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:265-271`
- **Scenario**: The trash button sits in the suite header next to nothing else interactive; clicking it fires `deleteSuite(activeSuite.id)` immediately. No confirmation dialog, no undo, no toast. A suite with a dozen authored scenarios (descriptions, expected behaviors, test results) vanishes on a single misclick. The boolean failure return is also ignored, so a failed delete looks identical to a successful one.
- **Root cause**: Destructive action wired directly to its mutation with no friction step, diverging from the standard "confirm destructive action" pattern; no mutation feedback channel exists (see finding 2).
- **Impact**: Permanent loss of hand-authored test scenarios from one stray click — the highest-stakes interaction in the view has the least protection.
- **Fix sketch**: Add a lightweight confirm (two-stage button: first click turns it red with "Delete suite?", auto-reverts after 3 s — pattern already used elsewhere in the app for destructive chips), and check the boolean result to surface failures.

## 6. Drag-to-rotate forward vector is pointer-only — keyboard and AT users cannot drive the core control
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/FlankAngleHeatmap.tsx:243-254` (same pattern in `SquadChoreographyEditor.tsx:463-473`)
- **Scenario**: The forward direction — the single input that changes every flank score, heatmap arc, and squad allocation — is set only by dragging an SVG `<circle>` with a pointer. The handle has no `tabindex`, no `role`, no `aria-label`, and no keyboard handler; the SVG itself is unannotated. The "Forward 359°" readout in the params panel is read-only.
- **Root cause**: `useDragAngle` only implements pointer math; neither consumer adds a focusable/keyboard alternative, so the interaction model has exactly one modality.
- **Impact**: Keyboard-only and assistive-tech users cannot change the forward direction at all — both visualizers degrade to static images, and the "drag to rotate" hint text describes an action they can't perform.
- **Fix sketch**: Make the handle focusable (`tabIndex={0}`, `role="slider"`, `aria-label="Target forward direction"`, `aria-valuenow={forwardDeg}`) with ArrowLeft/ArrowRight rotating ±5°; wire it through a small extension of `useDragAngle` so both consumers get it at once. A visible number input next to the "Forward" readout works too.

## 7. Drag releases the moment the cursor exits the SVG — no pointer capture on the shared drag hook
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/hooks/useDragAngle.ts:46-55` (symptom in FlankAngleHeatmap and SquadChoreographyEditor)
- **Scenario**: User grabs the cyan handle (which sits at 0.85× of the draw radius, near the SVG border) and sweeps in an arc. Any fast movement overshoots the SVG bounds; `onPointerLeave` is wired to `onPointerUp`, so the drag silently ends mid-gesture and the handle stops following. The user must re-acquire the small 10 px handle, often repeatedly.
- **Root cause**: The hook tracks `isDragging` state but never calls `setPointerCapture` on pointer-down, so move/up events stop arriving once the pointer leaves the element; the `onPointerLeave` cancel is a workaround for stuck-drag that institutionalizes the truncation.
- **Impact**: Janky, frustrating rotation interaction in both tactical visualizers — precisely the "drag to watch scores update in real-time" experience the hint text advertises.
- **Fix sketch**: In `onPointerDown(e)`, call `e.currentTarget.setPointerCapture(e.pointerId)` (change the signature to accept the event); drop the `onPointerLeave` wiring in consumers. Moves and releases then arrive even outside the SVG, and stuck-drag is impossible.

## 8. Squad member hover tooltip clips off the canvas — missing the side-flip its sibling visualizers use
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/game-systems/SquadChoreographyEditor.tsx:563-588`
- **Scenario**: Hovering a squad member on the east side of the formation (e.g., a Support at max range, screen x ≈ 312 of a 380-wide viewBox) renders the 90 px-wide tooltip at `sx + 12` — up to ~34 px of it, including the flank/score text, is cut off by the SVG edge. Members near the bottom clip vertically the same way.
- **Root cause**: TacticalCoverAnalysis (line 533) and FlankAngleHeatmap (line 342) both flip the tooltip to the inner side via `sx + (sx > SVG_CENTER ? -90 : 10)`; SquadChoreographyEditor re-implemented the tooltip without that guard — the third hand-rolled copy of the same rect+text pattern.
- **Impact**: The most informative hover detail (flank angle, distance, score) is unreadable for roughly half the formation positions, and the three visualizers behave inconsistently.
- **Fix sketch**: Apply the same flip: `x = sx + (sx > SVG_CENTER ? -102 : 12)`, `y = sy + (sy > SVG_CENTER ? -40 : 10)`. Better: extract a shared `<SvgHoverTooltip cx cy width height lines>` in `components/ui/svg/` and use it in all three visualizers.

## 9. Create-suite form rendered twice and bound to the same state — typing mirrors across two visible inputs
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:221-251` (duplicate at 298-328)
- **Scenario**: Whenever no suite is selected (including first load, since `activeSuiteId` starts `null` even when suites exist), both the sidebar footer form and the main empty-state form are visible simultaneously — and both bind `value={newSuiteName}` / `value={newTargetClass}`. Typing in the center hero form live-mirrors the text into the small sidebar inputs (and vice versa), which reads as a glitch.
- **Root cause**: The name/class/button trio was copy-pasted (~30 lines, identical styles and handlers) instead of extracted, and both copies share one state pair with no awareness that they can be on screen together.
- **Impact**: Visible state mirroring looks broken and doubles the Enter-key submission surface (see finding 1); two divergence-prone copies of identical JSX (already drifting: `w-full` vs `w-64`, placeholder text).
- **Fix sketch**: Extract a `<CreateSuiteForm size="compact"|"hero">` component. Hide the sidebar copy while the empty state is showing (`activeSuite == null`), or auto-select the first suite on load so the empty state only appears when there are truly no suites.
