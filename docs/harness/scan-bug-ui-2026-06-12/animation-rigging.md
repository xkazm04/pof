# Animation & Rigging — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

Audit scope: the `animation-rigging` context — AnimationsView, AnimationStateMachine, StateMachineEditor, AIComboChoreographer, AnimationChecklist, MixamoImport, plus the animation libs (montage-analysis, montage-prompt, animations, mixamo-db, rig-presets, animation-checklist prompt) and the coupled `state-machine-validator`, `graph-edges`, and `scan-animbp` route. `src/components/modules/visual-gen/auto-rig/index.ts` still does not exist on disk (stale scope path, unchanged since 2026-06-09).

Regression check on commit a47ba57 (duplicate-state-name linting): the new rule 6 in `state-machine-validator.ts:179-198` is correctly implemented — trim-keyed grouping, error severity, focusable stateIds, node badges render. No regression found; finding #1 below is an adjacent gap the new rule does not cover.

## Bug findings (new since 2026-06-09)

## 1. Non-identifier state names (spaces, empty, leading digit) pass the linter clean and silently generate uncompilable C++
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/content/animations/StateMachineEditor.tsx:1239` (free-text Name input) / `:129-168` (codegen); validator gap at `src/lib/state-machine-validator.ts:179-198`
- **Scenario**: A designer renames a state to a natural display label — "Hit React", "2HandAttack", or clears the field to retype and exports/copies. The linter shows zero findings (the a47ba57 rule only checks *duplicate* names), and Export produces the `.cpp` as authoritative.
- **Root cause**: Every state `name` is emitted verbatim as a C++ enumerator (`generateEnumCode` pushes `\t${s.name},`) and as `return EARPGAnimState::${s.name};`, plus into derived flag identifiers (`bCan${from.name}To${to.name}` in `generateNativeUpdateTransitionFlags`). The design assumes names are valid C++ identifiers, but the input is unvalidated free text and rule 6 only catches name *collisions*, not name *syntax*. An empty name even emits a bare `\t,` enumerator.
- **Impact**: Same failure class as the fixed duplicate-name bug: the export reports success but fails the UE5 build (`error: expected identifier`), surfacing only deep in the engine compile. "Hit React" is the single most likely rename a designer makes.
- **Fix sketch**: Add an `invalid-state-name` error rule next to rule 6: `/^[A-Za-z_]\w*$/.test(name)` (and non-empty after trim). Optionally sanitize in codegen (strip/underscore invalid chars) as a second line of defense, and apply the same check to the free-text `flag` field used in `if (${s.flag})`.

## 2. Setup Guide completion is written to the persisted store but read from ephemeral local state — progress visually resets to 0/6 on remount
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/modules/content/animations/AnimationsView.tsx:30` (local `completedSteps`) / `:49-56` (`handleMarkComplete`)
- **Scenario**: A user expands Setup Guide steps and clicks "Verify Complete" on several, navigates to another module (or reloads the app), then returns to Animations → Setup Guide. Progress shows 0/6 and all checkmarks are gone.
- **Root cause**: `handleMarkComplete` dual-writes — it adds the step id to a local `useState<Set<string>>` AND calls `setChecklistItem('animations', stepId, true)`, which persists to localStorage (`pof-modules` partialize) and the project-progress DB. But `AnimationChecklist` only ever renders the local set, which initializes empty on every mount; the persisted truth in `checklistProgress['animations']` (which AnimationStateMachine in the same file *does* read for state nodes) is never read back for steps.
- **Impact**: Split-brain state — user-visible progress loss on every remount despite the data being durably stored; users re-verify steps or distrust the tracker. The store also accumulates permanently-true `step-*` entries the UI can never reflect.
- **Fix sketch**: Drop the local set and derive it: `const progress = useModuleStore((s) => s.checklistProgress['animations'] ?? EMPTY); const completedSteps = useMemo(() => new Set(ANIMATION_STEPS.filter((s) => progress[s.id]).map((s) => s.id)), [progress]);` — `handleMarkComplete` then only calls `setChecklistItem`.

## 3. MixamoImport watched-folder default is frozen at mount — project switch (or late store hydration) dispatches the pipeline against the wrong project
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/content/animations/MixamoImport.tsx:40-44`
- **Scenario**: The Mixamo Import tab is open for project A (folder shows `A\MixamoIncoming`). The user switches the active project to B in the app header, drops FBX files into B's incoming folder, and clicks "Run Import Pipeline". Variant: the tab mounts before `projectStore` hydrates → folder is the bare relative string `MixamoIncoming`.
- **Root cause**: `defaultDir` is derived from `projectPath` during render, but is only consumed as the `useState(defaultDir)` *initializer* — which runs once. The component subscribes to `projectPath` (it re-renders on switch) yet `importDir` keeps the stale value, and nothing distinguishes "user-edited path" from "stale derived default".
- **Impact**: The pipeline is executed against the previous project's directory (importing/retargeting into the wrong project) or a CWD-relative path, with the failure mode owned entirely by the CLI run — the form looks correct at a glance.
- **Fix sketch**: Track whether the user edited the field (`dirtyRef`); add a `useEffect` on `projectPath` that resets `importDir` to the new `defaultDir` when not dirty. Same treatment is cheap insurance for `targetSkeleton` if it ever becomes project-derived.

## 4. Combo code "Copy" shows "Copied!" even when the clipboard write fails (and leaks an unhandled rejection)
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/content/animations/AIComboChoreographer.tsx:653-657`
- **Scenario**: User opens the UE5 Header / JSON preview modal and clicks Copy while the document isn't focused (e.g. DevTools focused, or click-through from another window), or clipboard permission is denied. `writeText` rejects.
- **Root cause**: `handleCopy` calls `navigator.clipboard.writeText(text)` fire-and-forget — no `await`, no `.catch` — then unconditionally sets `copied = true`. The sibling `StateMachineEditor.handleCopy` (line 539-547) correctly awaits inside try/catch and only flips state on success, so the file set has two divergent behaviors for the identical action.
- **Impact**: Success theater — the button confirms "Copied!" while the clipboard still holds the previous content; the user pastes stale/wrong C++ into their project. Plus an unhandled promise rejection in the console.
- **Fix sketch**: Mirror the StateMachineEditor pattern: `try { await navigator.clipboard.writeText(text); setCopied(true); } catch { logger.warn('Clipboard copy failed'); }` — or extract one shared `useCopyToClipboard` hook for both components.

## 5. "Entry" indicator labels an arbitrary state as the entry point in scanned/bridge mode
- **Severity**: Low
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/content/animations/AnimationStateMachine.tsx:943-959`
- **Scenario**: User scans the project (or connects the bridge) and the graph re-lays out. The "Entry →" arrow attaches to `displayStates[0]` — whichever state name happened to be inserted first into the scan's `Set` (regex match order across source files) or the bridge's flattened state set. That can be `Death` or `Attacking`.
- **Root cause**: The fallback graph hard-codes Idle first so `displayStates[0]` is correct by construction, and the code assumes that invariant holds for all data sources. Scanned/bridge data has no entry-state concept, and unlike `StateMachineEditor` (which anchors the entry arrow on `isDefault ?? states[0]`), there is no heuristic here at all.
- **Impact**: The diagram asserts wrong information — a designer reading "Entry → Attacking" reasonably concludes their AnimBP starts in the wrong state and "fixes" something that isn't broken. Misleads exactly the workflow (auditing a scanned machine) the feature exists for.
- **Fix sketch**: Pick the entry heuristically: prefer a locomotion-typed state, else a name matching /idle|locomotion/i, else hide the indicator for scanned/bridge sources (only render it when the data source actually knows the entry).

## UI findings

## 6. StateMachineEditor canvas nodes are mouse-only divs — selecting states and completing a "Draw Arrow" is impossible from the keyboard
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/animations/StateMachineEditor.tsx:909-935`
- **Scenario**: A keyboard user tabs through the editor. Toolbar buttons and the Priority Cascade list focus fine, but the canvas state nodes are plain `<div onClick>` — no `tabIndex`, no role, no Enter/Space handling. After pressing "Draw Arrow" they cannot click a target node, so transition creation is fully mouse-gated; the sibling `AnimationStateMachine` renders its nodes as real `<button>`s.
- **Root cause**: Drag support was implemented on a div and click/select semantics were bolted onto it instead of starting from a focusable button (the pattern already proven in `AnimationStateMachine.tsx:868`).
- **Impact**: Core editor interactions (select target state, finish drawing a transition) are excluded from keyboard and assistive-tech users; also no focus ring means even mouse users get weaker affordance of the selected node.
- **Fix sketch**: Render nodes as `<button type="button">` with the existing onClick; keep `onMouseDown` for dragging. Add `aria-pressed={isSelected}` and let the existing cyan selection style double as the focus-visible style. While there, give "Drawing..." mode an `aria-live` hint.

## 7. Editor header toolbar (8 buttons) has no wrap or collapse — actions clip off-screen at narrow widths
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/content/animations/StateMachineEditor.tsx:614-735`
- **Scenario**: Below ~1100px (exactly the widths where the main grid already collapses to one column at `<xl`), the single-row `flex items-center justify-between` header must fit the title block plus Snapshot/Diff/Add State/Draw Arrow/View Code/Export/NLA Export/Reset. Nothing wraps, so buttons overflow the container and Export/Reset become unreachable.
- **Root cause**: Both the outer header and the inner button row lack `flex-wrap`; every action is a top-level peer with a full text label, with no priority tiering for small viewports.
- **Impact**: Primary actions (Export, Reset) silently disappear on laptop-width windows / split-screen, which is a common layout for a companion app sitting next to UE5.
- **Fix sketch**: Add `flex-wrap gap-y-2` to the header and button group as the minimal fix; better, tier the actions — keep Add State / Draw Arrow / Export visible and fold Snapshot/Diff/NLA/Reset into an overflow menu under `Settings2`.

## 8. Animation panels hand-roll their chrome with hard-coded hex colors instead of SchematicPanel/design tokens
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/content/animations/AnimationChecklist.tsx:299-341` (also `StateMachineEditor.tsx:1510`)
- **Scenario**: The Setup Guide tab paints its own panel: `bg-[#03030a]`, `bg-[#0a0a1e]`, literal `violet-900/40` borders, inline `#e2e8f0` text (StepCard line 444), and a bespoke grid/glow background — while the adjacent State Machine and Combo Designer tabs build the identical look from `SchematicPanel` + `chart-colors` tokens. `CodeOutputPanel` likewise hard-codes `bg-[#0a0a1a]`.
- **Root cause**: AnimationChecklist predates the SchematicPanel extraction and was never migrated; the duplicated chrome (header icon tile, grid overlay, corner glow) is copy-paste of what SchematicPanel now owns.
- **Impact**: Theme drift — any palette/token change (or a future light theme) updates three tabs and leaves the fourth visibly off; ~40 lines of duplicated background/header JSX to maintain.
- **Fix sketch**: Wrap the checklist in `<SchematicPanel accent={ACCENT_VIOLET}>` like its siblings, replace literal hexes with `var(--text)`/token constants, and give CodeOutputPanel `bg-surface-deep` (or a shared `tone="code"`).

## 9. Async results (Blender exports, scan errors) render silently — no `role="status"`/aria-live and no dismiss
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/animations/AnimationStateMachine.tsx:571-575` (also `:598-603`, `AIComboChoreographer.tsx:893-897`)
- **Scenario**: A user triggers "Export to Blender NLA" or "Preview in Blender"; seconds later a result banner appears (or an error). Screen-reader users hear nothing — the banner is a plain div. The banner also has no dismiss affordance and persists until the next export, so a stale "Exported 6 states" message keeps asserting success long after the user changed the graph.
- **Root cause**: The success/error banner pattern was added per-call-site without the live-region semantics that `ComboParseFeedback` (same context, `AIComboChoreographer.tsx:586`) already demonstrates with `role="status"`.
- **Impact**: A11y gap on every async operation in the module, plus stale success messaging that misrepresents current state.
- **Fix sketch**: Extract one `<ResultBanner result={..} onDismiss={..}>` with `role="status"` (errors: `role="alert"`), an X button, and optional auto-clear; reuse across both components — three call sites collapse into one.

## 10. Hover-only transition rule labels use a fixed 8%-wide rect — long rules overflow the badge and are unreachable on touch/keyboard
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/animations/AnimationStateMachine.tsx:793-818`
- **Scenario**: Hovering an edge whose rule is e.g. `bIsAttacking == false && !bIsFullBodyMontage` shows the rule centered on the edge — but the background `<rect>` is hard-coded `width="8%" height="6%"`, so the 40+-char monospace string spills past the badge onto nodes and other edges, becoming illegible. On touch devices and keyboard there is no way to reveal rules at all; the editor canvas next door truncates rules at 30 chars instead, a third inconsistent treatment.
- **Root cause**: SVG `<rect>` cannot auto-size to its sibling `<text>`; the placeholder constant was never replaced with measured/estimated text width.
- **Impact**: The one piece of semantic data on edges (the transition condition) is unreadable exactly when it is long enough to matter, and undiscoverable without a mouse.
- **Fix sketch**: Estimate width from `ruleText.length * 0.62em` (monospace) or measure via `getComputedTextLength`, and clamp+ellipsize with a `<title>` for the full text. Longer term, render the label as an HTML overlay (like the sim path bar) so it can also be triggered by focus on a focusable edge hit-area.
