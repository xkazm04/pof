Execute this requirement immediately without asking questions.

## REQUIREMENT

# Pacing curve with auto-balance suggestions

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:01:50 PM

## Description
Add a Pacing tab to ZoneMap/index.tsx that charts combat-min / exploration-min / dialogue-min per zone along the critical path, using data already in ZONE_PLAYTIME + CRITICAL_PATH. Detect difficulty spikes >40% over the rolling average and surface remediation cards ("insert puzzle room", "split combat segment") sourced from the existing room types in level-design.

## Reasoning
Celestes public chapter-pacing graphs, Hades biome flow charts, and Naughty Dogs level beat sheets all rely on per-segment pacing visualizations because rhythm is what separates a good ARPG from a grindy one. The app already has all the input data (playtime + density + difficulty) but no curve view. One step further: tie suggestions to the existing CollapsibleGroup pattern so designers can apply them inline.

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