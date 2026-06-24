# Spec: Batched modularization of oversized `.tsx` files

**Date:** 2026-06-24
**Status:** Approved (design) — pending implementation plan
**Branch:** `vibeman/animation-reality-ledger`

## Problem

The codebase has **120 `.tsx` files exceeding 300 LOC** (out of 1,142 total). The
largest are 1,000–1,658 LOC (`PromptEvolutionView` 1,658, `StateMachineEditor` 1,557,
`FeatureMatrix` 1,509, `RoadmapChecklist` 1,455, `unique-tabs/_shared` 1,322, …). Large
files are harder to read, review, and edit reliably, and they bury cohesive
sub-components, hooks, and helpers inside a single module.

## Objective

Split every `.tsx` currently > 300 LOC so that **each resulting file is ≤ 300 LOC**, via
**pure, behavior-identical refactoring**. No feature work, no bug fixes, no dependency
changes. `npm run validate` (typecheck + lint + test) stays green after every batch.

### Success criteria

- Every file in the inventory below is reduced to ≤ 300 LOC, or split into a folder
  whose every file is ≤ 300 LOC.
- `npm run validate` is green at the end of every batch (equal-or-better than baseline).
- Public import paths are unchanged — no consumer outside a refactored folder changes.
- Extracted code is *moved, not rewritten* (diffs show relocation, not logic edits).

### Out of scope

- Behavior changes, bug fixes, "light improvements" (the user chose strict behavior-identical).
- New dependencies.
- Files already ≤ 300 LOC (unless an extraction naturally produces them).
- Deep redesign of component APIs or data flow.

## Approach

### The modularization kit (per-file recipe)

These files share a shape: a **main exported component**, several **sibling
sub-components** (local `function X(...)`), and **module-level config maps / types**.
That makes decomposition mechanical. For a file `Foo.tsx`:

1. **Promote to a folder.** `Foo.tsx` → `Foo/index.tsx`. Because TS/Next resolve
   `@/.../Foo` to `Foo/index.tsx`, **no external consumer import changes**.
2. **Extract config/constants** (color maps, option lists, status configs) → `Foo/constants.ts`.
3. **Extract shared types/interfaces** → `Foo/types.ts` (fold into `constants.ts` if tiny).
4. **Extract each sibling sub-component** → `Foo/<SubComponent>.tsx` (PascalCase, one per
   file; group only tiny, tightly-coupled ones — e.g. a card + its row).
5. **Extract pure helpers** (formatters, computations, non-React functions) → `Foo/helpers.ts`.
6. **If the main component is still > 300 LOC**, lift its stateful logic into
   `Foo/useFoo.ts` hook(s) and large JSX regions into sub-components until
   `index.tsx` ≤ 300.
7. **`index.tsx` becomes a thin orchestrator**: imports + top-level wiring.

This matches the **already-established folder-component convention** in the repo
(verified against `core-engine/sub_combat/combos/`: `index.tsx` + `AbilityChip.tsx` +
`TimelineBlock.tsx` + `CooldownOverlapChart.tsx` + `helpers.ts` + `design.tsx`).

### Conventions (honored, not introduced)

- **Imports:** within the new folder use `./Sibling` (single-level relative — the repo's
  folder-components already do this; the "no relative imports" rule targets `../../`
  parent traversal). Cross-folder imports stay `@/`.
- `logger` from `@/lib/logger`, never raw `console.*`.
- No hardcoded hex — `@/lib/chart-colors` / CSS vars.
- Timing constants from `UI_TIMEOUTS` in `@/lib/constants`.
- Reuse the Shared Component Manifest (CLAUDE.md) — never duplicate a shared primitive
  while extracting.
- Component filenames PascalCase; pure-module filenames `helpers.ts` / `constants.ts` /
  `types.ts`; folder mirrors the existing UI hierarchy position.

### Import-stability guarantee

Promoting `Foo.tsx` → `Foo/index.tsx` keeps `@/.../Foo` resolving. If a directory already
contains a `Foo/` folder name clash (rare), fall back to keeping `Foo.tsx` and adding
co-located sibling files in the same directory instead of a subfolder. Either way, **no
edit to any importing file**.

## Verification (safety contract)

- **Baseline:** `npm run validate` must be green before work starts. Any pre-existing
  failure is recorded here and **excluded** from the per-batch gate (we do not fix
  unrelated breakage as part of this effort).
  - Baseline result: _recorded at execution start in the implementation plan._
- **Per-batch gate:** `npm run validate` passes, equal-or-better than baseline.
- **Why this is sufficient for a pure refactor:** moving code (not editing it) means
  `tsc --noEmit` catches the overwhelming majority of structural breakage; the existing
  test subset guards runtime behavior; for files without tests, a diff review confirms
  extracted blocks are relocated verbatim.
- **One commit per batch** → trivially bisectable and revertable.

## Batching plan

Batch **by directory/area** (extracted shared pieces stay local; tests are organized by
area). Order: largest-impact areas first. **Checkpoint with the user between areas.**
`evaluator/` (33 files) is sub-split into smaller waves.

| Batch | Area | Files |
|-------|------|-------|
| B1 | `evaluator/` wave 1 (≥ 800 LOC) | CombatSimulatorView, EconomySimulatorView, AggregateQualityDashboard, PostProcessStudioView, NexusView, DeepEvalResults, ProjectHealthDashboard, CrashAnalyzerView, PatternLibraryView, HolisticHealthView, LocalizationPipelineView, PromptEvolutionView |
| B2 | `evaluator/` wave 2 (500–800) | AssetScoutView, UnifiedSummaryView, CalendarRoadmapView, PerformanceProfilingView, CrossModuleFeatureDashboard, WeeklyDigestView, AssetCodeOracleView, DependencyGraph, GDDComplianceView, ProjectWrappedView, CodebaseArcheologistView, GameDesignDocView |
| B3 | `evaluator/` wave 3 (300–500) | WorkflowOrchestratorView, CrossModuleOverlapPanel, SessionAnalyticsDashboard, EvaluatorModule, FeatureConstellation, PromptVersionTimeline, BatchReviewPanel, BuildHealthDashboard, CrashTimeMachine |
| B4 | `shared/` | FeatureMatrix, RoadmapChecklist, ReviewableModuleView |
| B5 | `content/animations/` | StateMachineEditor, AnimationStateMachine, AIComboChoreographer, AnimationChecklist |
| B6 | `content/audio/` | AudioScenePainter, AudioView, AudioEventCatalog, SpatialAudioGeneratorPanel, AudioPropertyPanel |
| B7 | `content/ui-hud/` | MenuFlowDiagram, HudThemeEditor, DamageNumberPhysicsSimulator, InventoryGridDesigner, LowHealthPulse |
| B8 | `content/level-design/` | LevelDesignView, StreamingZonePlanner, ProceduralLevelWizard, LevelFlowEditor, RoomDetailPanel, LevelDesignSpatialDiagram |
| B9 | `content/materials/` + `content/models/` | MaterialStyleTransfer, MaterialPatternCatalog, PostProcessStackBuilder, MaterialParameterConfigurator, AssetInventory |
| B10 | `game-systems/` wave 1 | SquadChoreographyEditor, TacticalCoverAnalysis, blueprint-transpiler/BlueprintTranspilerView, AITestingSandbox, BuildHistoryDashboard, EQSComponentInventory, CookProgress |
| B11 | `game-systems/` wave 2 | BuildConfigSelector, FlankAngleHeatmap, DialogueView, EQSPipelineDiagram, AttackRingVisualizer, AIBehaviorView, PatrolPointsDistribution |
| B12 | `core-engine/` | unique-tabs/_shared, PlanMatrixMap, ScanTab, ImplementationPlan, TelemetryEvolution, sub_loot/affix/AffixRollSimulator, ModuleShell, dzin-panels/AttributesPanel, dzin-panels/TagAuditPanel |
| B13 | `core-engine/sub_*` internals + orphans | sub_progression/_internals/{DRCodeGenerator, EncounterTTKSimulator, XpTableGenerator}, sub_ability/blueprint/_orphan/{SimulationSandbox, WiringGraphEditor, EffectTimelineEditor} |
| B14 | `project-setup/` | TestHarnessPanel, BidirectionalStateSyncPanel, BridgeEndpointHealth, LiveStateSyncPanel, PathBrowser, BlueprintInspector |
| B15 | `game-director/` | RegressionTrackerView, SessionDetail, FindingsExplorer, HealthTrendChart, NewSessionPanel |
| B16 | `layout/` + `cli/` | TopBar, SidebarL2, ActivityFeedPanel, GlobalSearchPanel, ModuleRenderer, cli/TerminalOutput |
| B17 | `visual-gen/` + misc | ProceduralEngineView, AssetInspector, material-lab/AdvancedTexturePanel, blender-pipeline/BlenderPipelineView, auto-rig/AutoRigView, bridge-doctor/BridgeDoctor, harness/HarnessRunHistory, layout-lab/Baseline, shared/ScalableSelector, app/prototype/page |
| B18 (optional) | Test files | `__tests__/dzin/batch4-panel-density`, `__tests__/dzin/batch5-enemy-world-panels`, `__tests__/components/game-systems/CookProgress.test` — split by `describe` block; lower priority, different decomposition (test files are not components). |

(Counts: B1–B17 cover the 117 component files; B18 covers the 3 oversized test files.)

## Risks & mitigations

- **Hidden runtime coupling** (a moved sub-component relied on closure scope of the
  parent). *Mitigation:* sub-components here take explicit props already; any that close
  over parent state are lifted as hooks, not as components. Typecheck + tests catch
  signature breaks.
- **`react-hooks` / purity lint rules** (the repo enforces several — see memory notes on
  `set-state-in-effect`, `purity`). *Mitigation:* extractions preserve hook order and
  effect bodies verbatim; lint runs in the per-batch gate.
- **Circular imports** when splitting (constants ↔ component). *Mitigation:* constants and
  types files import nothing from the component; one-directional dependency.
- **Scale/duration.** 120 files is many turns. *Mitigation:* directory-batched, gated,
  committed, with user checkpoints between areas; the implementation plan enumerates each
  batch as an independently-shippable unit.
