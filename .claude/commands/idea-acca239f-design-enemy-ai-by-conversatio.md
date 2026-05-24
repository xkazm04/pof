Execute this requirement immediately without asking questions.

## REQUIREMENT

# Design enemy AI by conversation, not C++

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:22:26 PM

## Description
Make the read-only BTFlowchart editable through plain language: a designer says "when the player heals, interrupt and rush them" and the system synthesizes or edits behavior-tree nodes live, explains each node in human terms, validates the change against the AI test sandbox, and round-trips to UE. Pairs every node with an auto-generated plain-English summary so the tree is legible to anyone.

## Reasoning
This removes the entire skill barrier of behavior-tree authoring and turns AI design into a conversation, the kind of workflow revolution users tell their friends about. It is a direct, high-leverage answer to the Globalization goal of being understandable by non-technical users.

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