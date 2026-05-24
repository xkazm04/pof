Execute this requirement immediately without asking questions.

## REQUIREMENT

# Self-healing UE-readiness gate for every asset

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:39:04 PM

## Description
Before any asset reaches Unreal, an autonomous QA agent inspects it for poly budget, non-manifold geometry, UV overlap, missing materials, naming conventions, and collision, auto-fixes issues with existing scripts, and certifies it UE5-ready against the project GDD and perf budget. This eliminates the entire class of imported-but-broken assets that currently surface only inside the editor. First sprint step: an Asset Health Check that runs one Blender introspection script (poly count, manifold check, UV bounds) on a named object via execute_code plus getObjectInfo and renders a pass/fail report card.

## Reasoning
Predictive quality gating means problems are anticipated and resolved before they ever cost editor time, which is transformational for solo and non-technical builders. Certified-ready assets remove fear from the pipeline and make the tool feel trustworthy and magical. It leverages execute_code and getObjectInfo that already exist, so the first step is low-risk.

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