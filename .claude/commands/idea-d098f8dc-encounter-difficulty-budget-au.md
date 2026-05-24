Execute this requirement immediately without asking questions.

## REQUIREMENT

# Encounter difficulty budget & auto-balancer

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:29:00 PM

## Description
The Difficulty Curve and Wave Choreographer present static data with no notion of whether a wave is fair. Assign each archetype (and each elite modifier) a threat score, then show a per-wave budget gauge that sums spawned threat against a target budget derived from the wave tier and player level, color-coded green/amber/red. Add a one-click Auto-fill to budget that picks an archetype mix hitting a target threat, and a Rebalance hint when a wave is over/under budget.

## Reasoning
D&D's encounter XP budget / Challenge Rating math and roguelike encounter generators proved that quantifying threat against a target is how designers keep difficulty curves intentional instead of vibes-based. Pushing it further with auto-fill and rebalance hints turns the choreographer from a viewer into a balancing assistant. It reuses the existing archetype stats and wave model, so the data is already present.

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