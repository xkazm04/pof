Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live in-browser procgen preview engine

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:04:00 PM

## Description
Today the ProceduralLevelWizard fires a CLI prompt that bakes C++ in UE5 with zero visual feedback � designers tweak sliders blind. Build deterministic TypeScript reimplementations of all four algorithms (BSP, WFC, Cellular, Perlin) that share the exact FRandomStream seed semantics of the generated C++, rendering the actual layout to a canvas at 60fps as sliders move. PoF becomes the only tool where you visually dial in a procgen layout AND get matching, seed-identical UE5 C++. First step (one sprint): implement BSP in TS with a canvas preview wired to the existing wizard sliders and seed field.

## Reasoning
An instant see-it-as-you-build loop collapses the design-bake-inspect cycle from minutes to milliseconds and turns guesswork into deliberate authoring � the signature capability that would make designers choose PoF over hand-coding. Seed-matched preview-to-engine parity is a deep competitive moat no generic level tool offers.

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