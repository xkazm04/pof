Execute this requirement immediately without asking questions.

## REQUIREMENT

# Dramatic tension curve: model fight feel, not just balance

## Metadata
- **Category**: ui
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:04:54 PM

## Description
Go beyond survival/DPS and model the emotional pacing of an encounter. Extend the existing 2s damage-bucket analysis in choreography-sim.ts into a continuous tension curve � intensity build, release valleys, comeback windows, near-death spikes � rendered as a dramatic arc overlaid on the timeline. Annotate dead zones, anticlimactic finishes and flat pacing so designers can sculpt a fight like a story beat sheet.

## Reasoning
Numbers tell you a fight is survivable; they do not tell you it is fun. Visualizing the dramatic arc gives every designer � technical or not � an intuitive read on whether an encounter rises, breathes and climaxes, which is what players actually remember. The bucketed damage timeline already computed for alerts is the raw signal, so the first version is a visualization layer on existing data.

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