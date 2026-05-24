Execute this requirement immediately without asking questions.

## REQUIREMENT

# Conversational text-to-level director

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:04:14 PM

## Description
The narrative textarea already turns prose into C++, but the visual graph, difficulty arc, spawns, and procgen config still must be built by hand. Build a text-to-level pipeline: a designer types or speaks a plain-language brief ("a sunken crypt, ~12 rooms, rising dread, a mid-boss ambush, a hidden treasure vault") and Claude returns a fully-populated, validated RoomNode[]/RoomConnection[]/difficultyArc/spawnEntries proposal plus a matching ProceduralLevelConfig � dropped straight into the flow editor for refinement. First step (one sprint): an /api/level-design/from-narrative route that parses a brief into a schema-validated room graph and populates the editor.

## Reasoning
This makes level authoring accessible to anyone who can describe what they want � no UE5 or graph-editing skill required � turning a specialist tool into a mainstream creative one and directly advancing the Globalization goal. "Describe a dungeon, watch it build itself" is the kind of magical, story-worthy moment that earns word-of-mouth and defines the product.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Level Design & Procedural Generation

**Description**: Level flow editor, procedural dungeon wizard, biome scatter, and streaming-zone planner. Procgen and scatter results are persisted and synced to UE5 via dedicated DBs.
**Related Files**:
- `src/components/modules/content/level-design/LevelDesignView.tsx`
- `src/components/modules/content/level-design/LevelFlowEditor.tsx`
- `src/components/modules/content/level-design/ProceduralLevelWizard.tsx`
- `src/components/modules/content/level-design/ProcGenDungeonPanel.tsx`
- `src/components/modules/content/level-design/BiomeScatterPanel.tsx`
- `src/components/modules/content/level-design/StreamingZonePlanner.tsx`
- `src/components/modules/content/level-design/RoomDetailPanel.tsx`
- `src/components/modules/content/level-design/SyncStatusPanel.tsx`
- `src/lib/level-design-db.ts`
- `src/lib/procgen-db.ts`
- `src/lib/scatter-db.ts`
- `src/lib/prompts/level-design.ts`
- `src/app/api/level-design/route.ts`
- `src/app/api/level-design/procgen-result/route.ts`
- `src/app/api/level-design/scatter-result/route.ts`
- `src/types/level-design.ts`
- `src/types/procgen.ts`

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