Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live co-tuning bridge to a running UE5 PIE session

## Metadata
- **Category**: functionality
- **Effort**: Unknown (9/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:04:48 PM

## Description
Build a two-way bridge (via the existing PillarsOfFortuneBridge) so dragging a TuningOverrides slider or editing dodge frame data instantly pushes the values into a live Play-In-Editor session, while real combat events stream back onto the choreography/dodge timelines. What-you-tune-is-what-you-play: the designer feels the change in-engine within a frame instead of re-cooking and relaunching.

## Reasoning
The biggest gap in this tooling is the leap from abstract sliders to actual in-engine feel; eliminating the export-rebuild-playtest cycle collapses iteration from minutes to milliseconds. This is the kind of seamless loop that makes designers fall in love with a tool and tell their peers. It builds on a bridge that already exists, turning a debug channel into a live design surface.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Combat Choreography & Action Maps

**Description**: Authoring and balancing of melee combat: combat action maps, combo chains, dodge timelines, choreography editor with UE5 export, and the damage pipeline diagram. Users tune frame data, attack lanes, and DPS, then export to the UE5 GAS combat code.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/CombatActionMap/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CombatActionMap/data.ts`
- `src/components/modules/core-engine/unique-tabs/ComboChainBuilder/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ComboChainBuilder/design.tsx`
- `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CombatChoreographyEditor/ue5-export.ts`
- `src/components/modules/core-engine/unique-tabs/DodgeTimelineEditor/index.tsx`
- `src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/index.tsx`
- `src/components/modules/core-engine/unique-tabs/DamagePipelineDiagram/pipeline-data.ts`
- `src/components/modules/core-engine/dzin-panels/DamageCalcPanel.tsx`
- `src/lib/combat/choreography-sim.ts`
- `src/lib/combat/simulation-engine.ts`
- `src/lib/combat/definitions.ts`
- `src/app/api/combat-simulator/route.ts`
- `src/stores/combatSimulatorStore.ts`
- `src/types/combat-simulator.ts`

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