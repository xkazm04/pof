# Animation & Rigging — Bug + UI Scan

> Total: 9

> Note on scope: the task listed `AnimationStateMachine.tsx`, `AnimationChecklist.tsx`, `AIComboChoreographer.tsx`, `StateMachineEditor.tsx` and `auto-rig/index.ts` as single files. On `master` each of these has already been refactored into a folder of the same name containing an `index.tsx`/`index.ts` plus sub-files (e.g. `AnimationStateMachine/index.tsx` + `useAnimationStateMachine.ts`, `helpers.ts`, `types.ts`, `constants.ts`, `StateMachine{Header,Diagram,Nodes,Edges,Details}.tsx`). `visual-gen/auto-rig/index.ts` does not exist at all — the real component is `visual-gen/auto-rig/AutoRigView/index.tsx` (a `.tsx`, one directory deeper). All files in every one of these folders, plus the two shared files (`shared/state-machine-shared.ts`, `shared/NotifyGlyphs.tsx`), were read in full; findings below cite the real paths.

## Bug findings

### 1. Deleting all states in the Visual State Machine Editor crashes code generation
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/content/animations/StateMachineEditor/codegen.ts:19-24
- **Scenario**: Open the Combo/State Machine tab's "Visual State Machine Editor", select each of the 5 default states in turn and click the trash icon in `StatePropertyEditor` until `states` is empty (`removeState` in `useStateMachineEditor.ts:68-75` happily filters down to `[]`, there is no minimum-state guard anywhere in the editor). Then either click "Export" in the toolbar, or toggle "View Code" (defaults to the "Full Output" tab).
- **Root cause**: `generateComputeAnimState` (codegen.ts:19-24) does `const defaultState = sorted.find((s) => s.isDefault) ?? sorted[sorted.length - 1];`. With `states = []`, `sorted = []`, so `defaultState` is `undefined`, and the very next line (`defaultState.name`) throws a `TypeError`. `handleExport` (useStateMachineEditor.ts:184-193) calls `generateFullCppOutput(states, transitions)` directly and unconditionally, and the `generatedCode` memo (useStateMachineEditor.ts:160-172) calls the same function tree whenever `showCode` is true — neither path guards against an empty state list.
- **Impact**: Two independent, easily-discoverable click paths (Export button; View Code toggle) throw an unhandled exception. The Export path throws synchronously inside a `button onClick` handler (silent failure — nothing happens visibly, no error surfaced to the user, browser console only); the View Code path throws inside a render-phase `useMemo`, which typically unmounts the whole editor to React's nearest error boundary (if any) — i.e. it can white-screen the tab.
- **Fix sketch**: In `generateComputeAnimState`, `generateEnumCode`, `generateAnimBPSetup` and `generateFullCppOutput`, treat an empty `states` array as a first-class case (early-return a "// No states defined" comment block) instead of assuming at least one element. Additionally, disable the "Export" and "View Code" controls in `EditorToolbar.tsx` when `states.length === 0`, and/or prevent `removeState` from dropping the last remaining state.

### 2. Concurrent "Create in Blender" clicks across rig presets clobber each other's loading state
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/visual-gen/auto-rig/AutoRigView/index.tsx:16-47
- **Scenario**: With Blender connected, click "Create in Blender" on the UE5 Mannequin preset card, and — while that `tryApiFetch` is still in flight — click "Create in Blender" on a different preset card (nothing disables the second card's button; `isCreating` is only true for the preset matching the single `creatingPresetId` state).
- **Root cause**: `creatingPresetId` is a single scalar (`useState<string | null>`), not per-preset. The second click overwrites `creatingPresetId` to the new preset's id, so the first request's spinner disappears from its own card (looks finished when it isn't) while now showing on the second card too. When either `await tryApiFetch` resolves, its `finally`-equivalent (`setCreatingPresetId(null)` at the end of `handleCreateInBlender`) unconditionally clears the *current* `creatingPresetId`, regardless of which of the two in-flight requests actually finished — so whichever request settles first can prematurely clear the spinner for a request that is still running.
- **Impact**: A user firing off two rig creations in quick succession sees an incorrect/absent loading indicator on one of the two cards, and cannot tell whether that preset's Blender armature creation actually succeeded until (if ever) a stray, mistimed result message appears on the wrong card.
- **Fix sketch**: Track in-flight state as a `Set<string>` of preset ids (or a `Record<string, boolean>`) instead of a single `creatingPresetId`, so each card's own request lifecycle is independent.

### 3. Montage "assigned" badge can silently show stale data once live Bridge data takes over
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/animations/AnimationStateMachine/useAnimationStateMachine.ts:103-134
- **Scenario**: Scan the project (populating `scanResult` with `hasMontage` flags per state name), then connect the Blender/Editor bridge so `useBridgeData` becomes true and `displayStates` switches to bridge-sourced states. If any bridge state shares a name with a previously-scanned state (e.g. `Attacking` in both), it is displayed with the same `id = scanned-Attacking`.
- **Root cause**: `montageSet` (line 103-108) is built purely from `scanResult.states` (the last static scan), independent of whether `useBridgeData` is currently true. `stateNodes` (line 126-134) then does `hasMontage: montageSet.has(state.id)` against whichever `displayStates` are showing — bridge or scan — because both code paths intentionally reuse the identical `scanned-<name>` id scheme (see the comment in `useManifest`'s bridge branch: "bridge doesn't convey montage-per-state info", `stateArr` sets `hasMontage: false` at the source but that's discarded — `montageSet` re-derives it from the stale scan instead).
- **Impact**: The purple "Sparkles" montage badge and "(montage assigned)" tooltip can be shown on a live, bridge-driven state purely because an old, unrelated scan once saw a same-named state with a montage — misleading the user about the *current* live project state (a classic stale-data / success-theater UI signal).
- **Fix sketch**: Gate `montageSet` (or its consumption in `stateNodes`) on `!useBridgeData`, mirroring how the scan-metadata footer already does `{scanResult && !simMode && ...}` for other scan-only UI.

## UI findings

### 4. Two unreconciled visual languages within one feature
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/animations/AnimationStateMachine/StateMachineHeader.tsx:41-131 vs src/components/modules/content/animations/StateMachineEditor/EditorToolbar.tsx:31-155
- **Scenario**: Open the "State Machine" tab (heavy violet cyberpunk HUD: `bg-violet-950/50`, `font-mono uppercase tracking-widest`, `textShadow`/`boxShadow` glows, `STATE_MACHINE.graph` labels) then scroll to its embedded `StateMachineEditor` (plain `SurfaceCard`/`rounded-lg` neutral toolbar, no glow/mono-caps styling) — both are reachable from the same context and sit close together conceptually (they edit the same state-machine domain).
- **Root cause**: `AnimationStateMachine`/`AnimationChecklist` were styled with a bespoke "schematic/terminal" theme (`ANIM_ACCENT`, glow shadows, uppercase tracking) while `StateMachineEditor` and `AIComboChoreographer` use the app's default `SurfaceCard`/token-based design system — the two never got a shared visual pass despite being sibling views of the same feature.
- **Impact**: Users bounce between a "sci-fi HUD" reading experience and a "standard SaaS panel" reading experience within seconds, inside what should read as one coherent tool; new contributors adding features to either file have no clear signal which style to match.
- **Fix sketch**: Pick one visual language for the Animation & Rigging feature (likely the app-standard `SurfaceCard` token system, since it's used by 3 of 4 files) and restyle the outlier, or intentionally document the schematic look as a deliberate "advanced/graph" visual mode with a shared wrapper component.

### 5. Hardcoded color literal breaks token consistency in the code panel
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/animations/StateMachineEditor/CodeOutputPanel.tsx:30
- **Scenario**: Toggle "View Code" in the State Machine Editor — the code panel wrapper uses `bg-[#0a0a1a]` while every sibling panel in the same folder (`WarningsPanel.tsx:43`, `PropertyPanel.tsx`'s panels, `TransitionList.tsx:22`) uses the `bg-surface-deep` design token.
- **Root cause**: A one-off hardcoded hex color instead of the shared token.
- **Impact**: The code panel doesn't respond to whatever the app's `--surface-deep` custom property does across themes (e.g. a future light-theme variant, or any future re-tuning of the dark palette), so it can silently drift out of sync with its own siblings and with dark/light theme switching.
- **Fix sketch**: Replace `bg-[#0a0a1a]` with `bg-surface-deep` (or a dedicated `--code-surface` token if the panel is meant to always stay darker than the rest of the UI).

### 6. "Create in Blender" gives no reason for being disabled
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/visual-gen/auto-rig/AutoRigView/RigPresetCard.tsx:66-77
- **Scenario**: With Blender disconnected, every rig preset card's "Create in Blender" button renders `disabled` with the same dimmed style as when a creation is already in progress — no `title`/tooltip explains why.
- **Root cause**: The button has no `title` attribute at all, unlike its sibling "Export to Blender NLA" (`StateMachineHeader.tsx:119` — `title={!blenderConnected ? 'Connect to Blender first' : '...'}`) and "Preview in Blender" (`AIComboChoreographer/index.tsx:223` — same pattern) buttons elsewhere in this same feature.
- **Impact**: A first-time user who hasn't connected Blender sees a permanently-greyed button with zero explanation, and has to guess (or hunt for the `BlenderConnectionBar` above) rather than being told directly why the action is unavailable — an established, working pattern exists two files away and simply wasn't applied here.
- **Fix sketch**: Add `title={!connected ? 'Connect to Blender first' : 'Create this rig's armature in Blender'}` to match the established convention.

### 7. Transition rule labels are mouse-hover-only, with no touch/keyboard equivalent
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/animations/AnimationStateMachine/StateMachineEdges.tsx:126-137, 174-201
- **Scenario**: On a touch device (or navigating by keyboard only), a transition's rule text (e.g. `Speed > Threshold`) is only revealed via `onMouseEnter`/`onMouseLeave` on an invisible 15px-wide hit-target `<line>` — there is no tap or focus equivalent.
- **Root cause**: The hover-reveal pattern was built mouse-first; the hit-target `<line>` isn't a focusable/tabbable element and has no `onClick`/`onTouchStart` fallback.
- **Impact**: On the app's touch/tablet or keyboard-only usage paths, transition rules (a core piece of information for understanding the state machine) are effectively unreachable — same gap exists in `EditorCanvas.tsx`'s rule labels, which are permanently truncated to 30 chars with no way to see the full text at all on any input method.
- **Fix sketch**: Add a tap/click toggle (persisting the "hovered" transition until tapped again or another is tapped) in addition to the existing hover behavior, and consider a `title` element inside the SVG `<line>`/`<text>` group as a low-effort native fallback.

### 8. Bone-mapping table header scrolls away with its own data
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/visual-gen/auto-rig/AutoRigView/index.tsx:120-129
- **Scenario**: Select a rig preset with a long `mixamoMapping` list; the "Mixamo Bone" / "{Preset} Bone" header row sits inside the same `grid grid-cols-2 ... max-h-48 overflow-y-auto` scroll container as the data rows, so scrolling down to see later bone mappings scrolls the column headers out of view.
- **Root cause**: Header and body rows are siblings in one scrollable grid rather than a header-fixed/body-scrollable layout.
- **Impact**: For skeletons with many bones (the higher end of `MAX_BONE_COUNT`), users lose the column labels exactly when they need them most (deep in a long mapping list), undermining the table's readability.
- **Fix sketch**: Make the header row `sticky top-0` with a solid background (matching the panel's `bg-*` so scrolled rows don't show through), or move it outside the scrollable region entirely.

### 9. Editor "Reset" button has no confirmation for a destructive action
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/animations/StateMachineEditor/EditorToolbar.tsx:145-152
- **Scenario**: A user who has spent time adding/wiring several custom states and transitions in the Visual State Machine Editor clicks the small icon-only "Reset" button (no confirming dialog) and instantly loses all unsaved edits back to the 5 default states — `handleReset` (useStateMachineEditor.ts:197-205) fires immediately on click.
- **Root cause**: `onClick={handleReset}` wired directly with no intermediate confirm step, unlike how "destructive" actions are commonly gated elsewhere in the app (e.g. delete-with-confirm patterns).
- **Impact**: A single mis-click (the button is a small icon crammed at the end of a dense toolbar row, easy to fat-finger next to Export/NLA-Export) silently discards all in-progress editor work with no undo.
- **Fix sketch**: Gate the reset behind a native `confirm()` (consistent with the codebase's lightweight-dialog style elsewhere) or a two-step "confirm" hover state, and/or wire it through the existing snapshot/diff mechanism so a reset can be undone.
