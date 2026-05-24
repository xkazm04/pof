Execute this requirement immediately without asking questions.

## REQUIREMENT

# Import Blueprints directly from the UE project

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:05:19 PM

## Description
Today the only way to feed the transpiler is pasting raw JSON into a textarea or clicking Load Sample, which is the biggest friction point in the flow. Since projectStore already knows the active UE project path, add a Blueprint picker that scans the project Content directory for .uasset Blueprints and runs the UE commandlet export to produce the JSON automatically, then auto-loads it. For the diff tab, auto-resolve the matching existing C++ from the Source tree so users do not paste it by hand.

## Reasoning
Best-in-class importers (Postman, Figma, OpenAPI codegen) connect to the real source instead of asking for copy-paste, which is what users expect once a project is configured. The project path is already tracked, so this removes the single largest UX barrier to actually using the transpiler on real assets.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Gameplay Systems (Physics, Net, Save, Input, Blueprint)

**Description**: Domain views for physics, multiplayer/replication, save-load data schema, input mapping, and the blueprint-to-C++ transpiler that parses UE5 Blueprints and emits code.
**Related Files**:
- `src/components/modules/game-systems/PhysicsView.tsx`
- `src/components/modules/game-systems/MultiplayerView.tsx`
- `src/components/modules/game-systems/SaveLoadView.tsx`
- `src/components/modules/game-systems/InputView.tsx`
- `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/design.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/advanced/AutoSaveConfig.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/advanced/SerializationProfiler.tsx`
- `src/app/api/blueprint-transpiler/route.ts`
- `src/lib/blueprint-parser.ts`
- `src/hooks/useBlueprintTranspiler.ts`
- `src/types/blueprint.ts`

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