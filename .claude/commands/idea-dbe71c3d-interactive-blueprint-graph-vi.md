Execute this requirement immediately without asking questions.

## REQUIREMENT

# Interactive Blueprint Graph Visualizer with Code Map

## Metadata
- **Category**: ui
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:52:01 PM

## Description
Render the parsed BlueprintAsset as an interactive node-graph canvas in the browser, reusing each node posX and posY coordinates, shown side-by-side with the generated C++. Clicking a node highlights the exact C++ lines it produced, and clicking C++ highlights the source node. First sprint step: render parsed nodes as absolutely-positioned cards from their existing coordinates with pin connection lines.

## Reasoning
The current paste-JSON-and-read-text experience is opaque and intimidating. A visual graph with live node-to-code mapping makes transpilation legible, demo-able, and story-worthy, and helps non-technical users understand what their Blueprints become.

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