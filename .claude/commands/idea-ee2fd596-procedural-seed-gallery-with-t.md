Execute this requirement immediately without asking questions.

## REQUIREMENT

# Procedural seed gallery with thumbnail variations

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 11:46:38 AM

## Description
ProceduralEngineView generates a single result for a single seed, forcing users to re-roll one at a time to find a good layout. Add a Generate Variations action that runs the active generator (terrain/dungeon/vegetation) across N seeds and renders a grid of small canvas thumbnails, letting the user click the best one to promote it to the main preview and export it. The seeded mulberry32 generators are deterministic and fast, so a 9-up grid is cheap.

## Reasoning
Variation grids are the proven UX of procedural tools (Gaea quick-looks, dungeon roguelikes, Midjourney-style grids) because comparing options beats blind re-rolling. It directly addresses the single-seed bottleneck, makes the engine feel exploratory rather than trial-and-error, and reuses the existing canvas preview renderers with minimal new code.

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

Use Claude Code skills as appropriate for implementation guidance. Check `.claude/skills/` directory for available skills.

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