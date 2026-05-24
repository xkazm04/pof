# Phase 9 · Fold Evaluator + Game Director + Game Systems · Audit

> **Status:** Audit-only in this session. Execution happens incrementally as Phase 10 enhancement batches once we have time for each individual surface.

**Why audit, not execute:** The spec's migration safety policy keeps the legacy shell at `/` reachable through Phase 11. Deleting Evaluator/GameDirector/GameSystems modules now breaks that contract. The actual fold-in (migrating each useful sub-view into a Mission Control panel) is enhancement work; each migration deserves its own bite-sized plan with TDD. Phase 9's deliverable for this session: this audit document.

## Modules to fold INTO Mission Control panels (Phase 10b batches)

| Today | Becomes (Mission Control panel) | Phase 10 anchor idea(s) |
|---|---|---|
| `evaluator/UnifiedSummaryView` | "Insights" panel — correlation engine output | 4e8d7fda (anticipatory copilot), 8603d0d6 (fragility radar) |
| `evaluator/ProjectHealthDashboard` (radar) | Folded INTO CatalogRollupCard as a hover-detail view | (already covered by existing CatalogRollupCard) |
| `evaluator/AggregateQualityDashboard` | "Quality" panel — per-module heatmap | f0f6e2e3 (self-healing FM) |
| `evaluator/CrossModuleFeatureDashboard` | Folded INTO existing per-catalog dependency graph (Phase 10) | 2c4da945 (critical path DAG) |
| `game-director/DirectorOverview` | "Playtests" panel | (kept, slim panel) |
| `game-director/FindingsExplorer` | Folded INTO ActivityFeedCard as type='playtest-finding' | (extends activityFeedStore) |
| `game-systems/BuildHistoryDashboard` | Folded INTO Live State (BuildHistoryCard panel) | 21cea6d3 (cook forecaster), 0a08d250 (gated pipeline) |
| `evaluator/CalendarRoadmapView` | "Roadmap" panel | e1d1b89b (milestone bundles), 925151c6 (playable-by forecast) |
| `evaluator/WorkflowOrchestratorView` | Folded INTO CLI Rail (P4b — orchestrated dispatch UI) | ef237c77 (multi-agent DAG) |
| `evaluator/PostProcessStudioView` | Out of scope — deleted in P12 cutover | f8eef459 (PP Studio sliders → DROP-STUB) |
| `evaluator/LocalizationPipelineView` | Out of scope — deleted in P12 cutover | (localization OOS per backlog) |
| `evaluator/CrashAnalyzerView` | Folded INTO Live State CrashWatchtower (P6b) | fff73bb0, a23c6e6d, 15defbed |
| `evaluator/AssetCodeOracleView` | Folded INTO Entity Inspector (oracle panel per entity) | (P10 enhancement) |
| `evaluator/AssetScoutView` | Folded INTO Catalog Hub (`+ new` action) | (P10 enhancement) |
| `evaluator/CodebaseArcheologistView` | Out of scope — deleted in P12 cutover | (no replacement) |
| `evaluator/GDDComplianceView` | Folded INTO Catalog Hub overall progress | f0797199 (bidirectional GDD) |
| `evaluator/GameDesignDocView` | Folded INTO Catalogs L1 (GDD-as-catalog) | (P10 enhancement) |
| `evaluator/WeeklyDigestView` | Folded INTO ActivityFeedCard (weekly rollup mode) | (P10 enhancement) |
| `game-systems/MultiplayerView` | Out of scope — deleted in P12 (multiplayer OOS per backlog) | — |
| `game-systems/PlatformProfileCard` | Folded INTO Live State (platform badge) | (P10 enhancement) |
| `game-systems/blueprint-transpiler/*` | Out of scope — deleted in P12 (BP transpiler OOS) | d837be49 (DROP-STUB) |

## Modules to delete outright (Phase 12 cutover)

These have no Mission Control replacement and were marked DROP-STUB during backlog cleanup:

- `evaluator/PostProcessStudioView` + `postProcessStudioStore`
- `evaluator/LocalizationPipelineView`
- `evaluator/CodebaseArcheologistView`
- `game-systems/MultiplayerView`
- `game-systems/blueprint-transpiler/`
- `core-engine/sub_polish/` (audit) — surface absorbed by Catalog Hub
- `core-engine/sub_debug/` (audit) — DebugDashboard panels DROP-STUB per backlog

## Audit deliverable

The above table IS the deliverable. No code changes. When a future session migrates a specific evaluator view, it consults this table to know which Mission Control panel it becomes and which P10 idea it implements.

## Tag

`ecw-phase-9-audit-complete` — distinguishes from a hypothetical full P9 execution.
