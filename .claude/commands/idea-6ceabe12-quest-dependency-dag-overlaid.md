Execute this requirement immediately without asking questions.

## REQUIREMENT

# Quest dependency DAG overlaid on zone topology

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:01:34 PM

## Description
Render a directed graph of prerequisite relationships between generated quests, then overlay it on the existing TopologyGraph so each quest sits over its giverRoomId. Detect orphans, dead-ends, and quests gated by zones outside the player level filter. Build on react-flow or reuse the SVG renderer already in ZoneMap/map/TopologyGraph.tsx; persist a dependsOn[] field on GeneratedQuest.

## Reasoning
Skyrim Creation Kit, articy:draft, and FFXIVs main-scenario tree all expose quest hierarchies because narrative designers need to spot bottlenecks and unreachable content before playtest. The current generator emits a flat array with no inter-quest links. One step further: cross-reference with the level-filter slider already in ZoneMap/index.tsx to flag quests no player can reach at the current level.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Quests & Zone Mapping

**Description**: Zone map topology with POI/encounter density, playtime estimation, travel progression, and the quest generator that produces quest definitions for the world.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/ZoneMap/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/map/MapCanvas.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/map/TopologyGraph.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/map/FeatureList.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/density/DensityLevelGroup.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/playtime/PlaytimeEstimator.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/travel/TravelProgressionGroup.tsx`
- `src/components/modules/core-engine/unique-tabs/ZoneMap/travel/PoiEncountersGroup.tsx`
- `src/app/api/quest-generation/route.ts`
- `src/lib/quest-generator.ts`
- `src/types/quest-generation.ts`

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