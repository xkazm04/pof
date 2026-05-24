Execute this requirement immediately without asking questions.

## REQUIREMENT

# One-click Send to Unreal asset export

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 11:50:05 AM

## Description
exportSceneScript currently writes FBX/GLB to an arbitrary path with no game conventions. Add a Send to UE5 action (Quixel Bridges signature Send to Unreal feature) that reads the active UE project path from projectStore and exports the selected/generated object straight into the projects Content import folder with game-ready settings: correct scale, SM_/SK_ prefixes, smoothing groups, and an optional Draco/LOD chain. Push further by emitting an event-bus message so the app can prompt or trigger the UE import once the file lands.

## Reasoning
This app is explicitly a UE5 dev assistant, yet the Blender pipeline dead-ends at a generic file on disk that the user must hand-copy. Quixel Bridge proved that the export-to-engine bridge is the single feature that makes an asset tool indispensable. It closes the loop from generation to in-engine asset and uniquely leverages the apps existing UE project context.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Blender MCP Integration

**Description**: Direct TCP integration with Blender via MCP: connection bar, viewport preview, scene/object manipulation, screenshot, mesh generation+import, and asset download. Routed through lib/blender-mcp/service and blenderMCPStore.
**Related Files**:
- `src/components/blender-mcp/BlenderConnectionBar.tsx`
- `src/components/blender-mcp/ViewportPreview.tsx`
- `src/lib/blender-mcp/service.ts`
- `src/lib/blender-mcp/escape.ts`
- `src/lib/blender-mcp/types.ts`
- `src/app/api/blender-mcp/route.ts`
- `src/app/api/blender-mcp/execute/route.ts`
- `src/app/api/blender-mcp/generate/route.ts`
- `src/app/api/blender-mcp/generate/status/route.ts`
- `src/app/api/blender-mcp/generate/import/route.ts`
- `src/app/api/blender-mcp/scene/route.ts`
- `src/app/api/blender-mcp/object/route.ts`
- `src/app/api/blender-mcp/screenshot/route.ts`
- `src/app/api/blender-mcp/assets/route.ts`
- `src/app/api/blender-mcp/assets/download/route.ts`
- `src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx`
- `src/components/modules/visual-gen/blender-pipeline/BlenderSetup.tsx`
- `src/stores/blenderMCPStore.ts`

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