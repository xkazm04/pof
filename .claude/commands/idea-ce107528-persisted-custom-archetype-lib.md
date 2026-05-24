Execute this requirement immediately without asking questions.

## REQUIREMENT

# Persisted custom archetype library with codegen

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:28:34 PM

## Description
The ArchetypeBuilder lets users craft stats, abilities, BT preset, and elite modifiers, but the result is ephemeral local state with no save path. Add an SQLite-backed archetype library (mirroring ai-testing-db: a bestiary_archetypes table, an /api/bestiary-archetypes route, and a useBestiaryArchetypes hook) with Save/Load/tag/duplicate, plus a Promote button that emits a full UE5 data-table row + GameplayEffect + BT assignment via the existing codegen path. Saved customs appear alongside the static ARCHETYPES in the catalog.

## Reasoning
Homebrew creators in D&D Beyond and Pathfinder, and preset libraries across creative tools, prove that a build-then-save-and-reuse loop is what turns a one-off tweaker into a daily-use asset pipeline. Right now the builder is a dead-end, so designer effort is thrown away every session. Persisting customs and wiring them to codegen closes the loop from idea to shippable UE5 enemy.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Enemy Bestiary & AI Behavior

**Description**: Enemy archetype builder, behavior-tree flowcharts, perception/aggro tuning, encounter difficulty, and the AI testing sandbox that runs simulated playtests. Backed by ai-testing DB + useAITesting.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/index.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/ai-logic/AILogicTab.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/ai-logic/BTFlowchart.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/ai-logic/PerceptionConeViz.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/archetypes/ArchetypesTab.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/archetypes/ArchetypeBuilder.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/archetypes/CodegenModal.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/encounters/EncountersTab.tsx`
- `src/components/modules/core-engine/unique-tabs/EnemyBestiary/encounters/TacticsMap.tsx`
- `src/components/modules/game-systems/AITestingSandbox.tsx`
- `src/components/modules/game-systems/PatrolPointsDistribution.tsx`
- `src/app/api/ai-testing/route.ts`
- `src/lib/ai-testing-db.ts`
- `src/hooks/useAITesting.ts`
- `src/types/ai-testing.ts`
- `src/types/squad-tactics.ts`

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