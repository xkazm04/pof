Execute this requirement immediately without asking questions.

## REQUIREMENT

# Procedural zone-graph generator with seed gallery

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/26/2026, 8:05:18 PM

## Description
procgen-db.ts only logs a roomCount and seed after the fact; there is no actual generator. Add a real zone-graph generator that takes parameters (zone count, branchiness, difficulty curve, topology archetype like linear or hub-and-spoke or metroidvania) and a seed, emits a candidate set of ZoneRecord nodes and ZoneEdge connections, and renders them in the existing MapCanvas. Every candidate is auto-validated through zone-analysis.ts, and designers can reroll the seed and pin favorites into a seed gallery.

## Reasoning
Web procgen tools such as Azgaar Fantasy Map Generator and Watabou one-page dungeon won audiences with instant reroll plus a save-your-favorites gallery. Wiring real generation into the existing canvas and linter turns a dead logging table into a fast ideation loop, and auto-linting each candidate guarantees the output is already progression-valid. It directly fulfills the procgen half of this context that is currently unimplemented.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: World, Quests & Procgen

**Description**: Design world zones, map topology and playtime budgets, plus procedural generation and AI quest generation. Spans the sub_world module, world/quest libs, and the quest-generation API.
**Related Files**:
- `src/components/modules/core-engine/sub_world/index.tsx`
- `src/components/modules/core-engine/sub_world/density/DensityLevelGroup.tsx`
- `src/components/modules/core-engine/sub_world/map/FeatureList.tsx`
- `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx`
- `src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx`
- `src/components/modules/core-engine/sub_world/map/TopologyGraph.tsx`
- `src/components/modules/core-engine/sub_world/playtime/PlaytimeBreakdownTable.tsx`
- `src/components/modules/core-engine/sub_world/playtime/PlaytimeEstimator.tsx`
- `src/lib/world/zone-analysis.ts`
- `src/lib/world/zone-prompt.ts`
- `src/lib/quest-generator.ts`
- `src/lib/procgen-db.ts`
- `src/lib/scatter-db.ts`
- `src/types/procgen.ts`
- `src/types/quest-generation.ts`
- `src/app/api/quest-generation/route.ts`

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