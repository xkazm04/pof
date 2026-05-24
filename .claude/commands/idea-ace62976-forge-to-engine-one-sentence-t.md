Execute this requirement immediately without asking questions.

## REQUIREMENT

# Forge-to-Engine: one sentence to UE-ready asset

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:38:37 PM

## Description
Turn a single plain-language intent (make a weathered iron longsword ready for my ARPG) into a fully game-ready Unreal asset, autonomously. A new orchestrated CLITask drives the entire Blender MCP chain end to end: generate via Hyper3D/Hunyuan3D, import to Blender, run optimize-mesh and generate-lods scripts, UV/material, export GLB via export-scene, then emit the UE5 importer from ue5-import-templates. First sprint step: add an AssetPipeline task type in cli-task.ts that sequences the existing scripts in src/lib/blender-mcp/scripts/ behind one prompt input, executed through /api/blender-mcp/execute.

## Reasoning
Today every stage is a separate manual tab and UE import is copy-paste boilerplate, so a non-technical user cannot ship an asset alone. Collapsing the whole chain into one conversational intent is the signature, story-worthy capability that makes the tool legendary and directly serves the Globalization goal. It compounds: every pipeline run becomes a reusable template.

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