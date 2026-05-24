Execute this requirement immediately without asking questions.

## REQUIREMENT

# Text-to-World: describe a level, generate it whole

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:34:19 PM

## Description
Unify the procedural engine (terrain.ts, dungeon.ts, vegetation.ts), asset browser, and import-automation behind a single natural-language World Brief input. A creator types "a fog-bound ruined fortress with three arenas" and the system maps phrases to generator configs, auto-selects CC0 assets, and emits a UE5 import bundle. First step (one sprint): a deterministic keyword-to-config mapper that drives the existing generators from one text box, no LLM required for v1.

## Reasoning
Today each generator is a separate slider panel demanding domain knowledge (Diamond-Square, BSP, Poisson). Collapsing all six visual-gen sub-modules into one plain-language prompt makes world-building feel magical and accessible to non-technical users, and becomes the products signature, story-worthy capability.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Asset Forge, Rigging & Procedural Worlds

**Description**: Browses/views generated 3D assets, auto-rigs skeletal meshes, composes and exports scenes, runs import automation, and procedurally generates dungeons/terrain/vegetation with UE5 import templates.
**Related Files**:
- `src/components/modules/visual-gen/asset-browser/AssetBrowserView.tsx`
- `src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx`
- `src/components/modules/visual-gen/asset-viewer/AssetViewerView.tsx`
- `src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx`
- `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx`
- `src/components/modules/visual-gen/import-automation/ImportAutomationView.tsx`
- `src/components/modules/visual-gen/scene-composer/SceneComposerView.tsx`
- `src/components/modules/visual-gen/scene-composer/SceneExporter.tsx`
- `src/components/modules/visual-gen/scene-composer/SceneTree.tsx`
- `src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx`
- `src/lib/visual-gen/generators/dungeon.ts`
- `src/lib/visual-gen/generators/terrain.ts`
- `src/lib/visual-gen/generators/vegetation.ts`
- `src/lib/visual-gen/rig-presets.ts`
- `src/lib/visual-gen/ue5-import-templates.ts`
- `src/app/api/visual-gen/browse/route.ts`
- `src/app/api/visual-gen/blender/detect/route.ts`

**Post-Implementation**: After completing this requirement, evaluate if the context description or file paths need updates. Use the appropriate API/DB query to update the context if architectural changes were made.

## Recommended Skills

- **compact-ui-design**: Use `.claude/skills/compact-ui-design.md` for high-quality UI design references and patterns

## Notes

This requirement was generated from an AI-evaluated project idea. No specific goal is associated with this idea.

## DURING IMPLEMENTATION

- Use `get_memory` MCP tool when you encounter unfamiliar code or need context about patterns/files
- Use `report_progress` MCP tool at each major phase (analyzing, planning, implementing, testing, validating)
- Use `get_related_tasks` MCP tool before modifying shared files to check for parallel task conflicts

## AFTER IMPLEMENTATION

1. Log your implementation using the `log_implementation` MCP tool with:
   - requirementName: the requirement filename (without .md)
   - title: 2-6 word summary
   - overview: 1-2 paragraphs describing what was done
   - category: one of feature/bugfix/refactor/performance/security/infrastructure/ui/docs/test
   - patternsApplied: comma-separated patterns used (e.g. "repository pattern, debounce, memoization")

2. Check for test scenario using `check_test_scenario` MCP tool
   - If hasScenario is true, call `capture_screenshot` tool
   - If hasScenario is false, skip screenshot

3. Verify: `npx tsc --noEmit` (fix any type errors)

Begin implementation now.