Execute this requirement immediately without asking questions.

## REQUIREMENT

# Bot-playtested levels with balance heatmaps

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:04:26 PM

## Description
The pacing linter (lintLevelPacing) flags anti-patterns with static heuristics, but never simulates actual play. Build a lightweight in-browser agent that walks the room graph, resolving each encounter against spawnEntries, difficulty, and the difficulty arc to estimate time-to-clear, damage taken, and death probability per room � rendered as a heatmap over the flow editor plus a pacing curve. Run hundreds of seeded simulations to surface difficulty cliffs and dead spots before a single line of C++ is baked. First step (one sprint): a graph-walk simulator producing a clear-time and difficulty-exposure report overlaid on existing rooms.

## Reasoning
Upgrading from rule-based linting to dynamic simulation lets designers predict how a level will actually feel and fix balance before the expensive UE bake-and-playtest loop. "Watch a bot play your level and tell you where players will rage-quit" is a defining, evangelism-worthy capability that compounds with the procgen and text-to-level systems.

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