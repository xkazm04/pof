# Animation & Rigging — zen-perf scan
> Context: Visual Content Generation / Animation & Rigging
> Total: 5
> Severity: critical=0 high=1 medium=3 low=1

## 1. Quadratic reverse-edge scan inside the transition render loop (both graph canvases)
- **Severity**: high
- **Lens**: performance
- **Category**: O(n²) in render
- **File**: src/components/modules/content/animations/AnimationStateMachine.tsx:715 (and src/components/modules/content/animations/StateMachineEditor.tsx:830)
- **Scenario**: A scanned/bridge AnimBP or an edited state machine with many transitions re-renders on every hover, sim click, drag, or scan-diff tick.
- **Root cause**: For each edge, `displayTransitions.some((t) => t.from === to && t.to === from)` (and in the editor `transitions.some((r) => r.from === t.to && r.to === t.from)`) walks the entire transition list — nested inside `displayTransitions.map(...)` / `transitions.map(...)`. That is O(E²) per render. In `StateMachineEditor` the dragging handler (`handleCanvasMouseMove`, line 483) fires this whole re-render on every `mousemove`, so the quadratic scan runs at pointer-move frequency.
- **Impact**: A realistic combat state machine (15–30 states, 40–80 transitions) does thousands of comparisons per frame while dragging a node — visible jank on the canvas, wasted CPU, and battery drain. Grows worse the more the graph is built out (exactly when the tool is most used).
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Build a `Set<string>` of `"from->to"` keys once per `displayTransitions`/`transitions` change (via `useMemo`), then test `reverseExists` with `edgeKeySet.has(\`${to}->${from}\`)` — O(1) per edge, O(E) per render. The `transitionRuleMap` memo (AnimationStateMachine.tsx:336) already demonstrates the pattern; reuse it.

## 2. Duplicated Blender-NLA export + state taxonomy across the two state-machine components
- **Severity**: medium
- **Lens**: architecture
- **Category**: duplicated logic / DRY
- **File**: src/components/modules/content/animations/AnimationStateMachine.tsx:429 (and src/components/modules/content/animations/StateMachineEditor.tsx:357)
- **Scenario**: Any change to the NLA frame-layout convention (currently `frameDuration = 60` in one file, `30` in the other) or the state-type color map has to be made in two places, and they have already drifted.
- **Root cause**: `handleExportToBlenderNLA` and the `BlenderNLAExport` sub-component each independently map states → `nlaStateMachineScript({ armatureName: 'Armature', states })` and POST to `/api/blender-mcp/execute`. The `StateType` union, `STATE_TYPE_COLORS`, and `NODE_W`/`NODE_H` constants are also redeclared in both files (AnimationStateMachine.tsx:34/170-171 vs StateMachineEditor.tsx:55/352-353) with subtly different values (NODE_W 110 vs 120, NODE_H 46 vs 52, and a 5-member vs 4-member StateType).
- **Impact**: Drift bugs (the 30 vs 60 frame mismatch means the two exporters produce different NLA layouts for the same logical states), double maintenance, and confusion about which is canonical. Mirrors the already-extracted `computeEdgeGeometry` consolidation noted in graph-edges.ts.
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Extract `exportStatesToBlenderNLA(states, { frameDuration })` into a shared lib (next to `nlaStateMachineScript`) returning a `tryApiFetch` result; have both call sites use it. Move the shared `StateType`/`STATE_TYPE_COLORS` and node dimensions into one module (e.g. `lib/animation/state-graph-style.ts`) and import in both.

## 3. Fake 600 ms "AI processing" delay on a fully synchronous combo generator
- **Severity**: medium
- **Lens**: both
- **Category**: artificial latency / dead complexity
- **File**: src/components/modules/content/animations/AIComboChoreographer.tsx:636 (and the duplicate at line 646)
- **Scenario**: User types a combo description (or clicks a preset) and clicks Generate.
- **Root cause**: `generateCombo()` is pure, deterministic, and synchronous (parse keywords + seeded RNG, no network — confirmed lines 159-275). Yet `handleGenerate` and `handlePreset` wrap it in `setTimeout(..., 600)` purely to "Simulate AI processing delay", duplicating the same generate-and-set-state block twice.
- **Impact**: Every generation is needlessly delayed by 0.6 s, the result is gated behind a spinner that misrepresents a local computation as a remote call, and the logic is copy-pasted across two handlers (drift risk). Net negative UX for zero benefit.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Drop the `setTimeout`; compute synchronously (`startTransition` if you want non-blocking). Collapse both handlers into one `runGenerate(text)` so preset and manual paths share it. Keep `isGenerating` only if a real async step is added later.

## 4. Full 4-section C++ output regenerated even when the code panel is hidden
- **Severity**: medium
- **Lens**: performance
- **Category**: missing memoization gate
- **File**: src/components/modules/content/animations/StateMachineEditor.tsx:530
- **Scenario**: Editing states/transitions (typing a rule, dragging a node updates `x/y` on every mousemove) while the "View Code" panel is closed.
- **Root cause**: The `generatedCode` `useMemo` depends on `[states, transitions, codeTab]` but not `showCode`. Because node drag mutates `states` on every `mousemove` (line 488), the full string-building pipeline (`generateFullCppOutput` → enum + transition comment + ComputeAnimState + NativeUpdate flags + AnimBP setup, lines 267-295) runs on every pointer move regardless of whether the output is even visible. The `default` branch also rebuilds all four sections to show one tab.
- **Impact**: Heavy string concatenation (multiple `[...states].sort()` + per-transition `states.find()` lookups, themselves O(S·T)) on every drag frame, throwing away the result when `showCode` is false. Compounds finding #1's drag-time cost.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Short-circuit: `const generatedCode = useMemo(() => showCode ? (...switch...) : '', [showCode, states, transitions, codeTab])`. Optionally precompute a `stateMap`-based lookup for the codegen `states.find(...)` calls (the component already has `stateMap` at line 418).

## 5. Diff-against-previous-scan compares stale name sets after layout, missing renamed/moved states
- **Severity**: low
- **Lens**: architecture
- **Category**: correctness / unclear flow
- **File**: src/components/modules/content/animations/AnimationStateMachine.tsx:268
- **Scenario**: User rescans a project after renaming a state or after the bridge becomes connected.
- **Root cause**: The "new state" diff keys off `scanned-${name}` membership (lines 269-280), but `newStateIds`/`modifiedTransitions` are only ever applied to the scanned-data display path; when `useBridgeData` is true the bridge states (`scanned-${t.from}`, line 239) reuse the same id namespace yet the diff was computed against `prevScanRef` (filesystem scan), so a bridge render can mark unrelated nodes as "new" (glow filter, line 888) or never clear them except via the 5 s timer. The diff also treats a pure rename as remove+add with no modified-state signal.
- **Impact**: Occasional misleading green "new state" glow on bridge data and no visual hint for renames — cosmetic, low frequency, self-clears after 5 s. Flagged for clarity of the dual-source (scan vs bridge) flow rather than severe cost.
- **Effort**: 3 · **Value**: 3
- **Fix sketch**: Scope the diff to the active data source: store `prevDisplaySource` alongside `prevScanRef` and skip/reset diff state when the source flips between bridge and scan. Or move diff computation into the `displayStates` memo so it always reflects what is actually rendered.

---
_Scope note: the scoped path `src/components/modules/visual-gen/auto-rig/index.ts` does not exist; the real neighbor `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx` was read instead (no top-5-worthy findings — it is clean, with `MAX_BONE_COUNT` already hoisted to module scope and small static preset rendering). `montage-analysis.ts` / `montage-prompt.ts` are pure and consumed only by tests (no render-path recompute). `animations.ts` is shared framer-motion variants (no findings). `mixamo-db.ts` re-runs `CREATE TABLE IF NOT EXISTS` on every call via `ensureMixamoTable()` (minor; only 2 call sites, both low-frequency import events) — noted but below the top 5._
