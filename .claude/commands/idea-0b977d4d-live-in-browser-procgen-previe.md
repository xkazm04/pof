Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live in-browser procgen preview canvas

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:12:42 PM

## Description
Add a 2D canvas in ProceduralLevelWizard that runs the BSP/cellular/WFC/Perlin algorithm in TypeScript and renders the generated grid instantly, using the same seed and FRandomStream-equivalent logic the UE codegen targets. The grid-building helper already exists for the Blender export (dungeonToGeometryScript) and can be generalized. Designers see the layout, room count, and connectivity before dispatching the expensive CLI C++ generation task.

## Reasoning
Tools like World Machine, Gaea, and Watabou's One Page Dungeon prove that an instant live preview is the single biggest accelerator for procgen iteration. Today every parameter tweak requires a full round-trip to the UE editor to see any result, which kills the tight feedback loop procedural design depends on. A pure-client preview turns minutes-per-iteration into milliseconds.

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