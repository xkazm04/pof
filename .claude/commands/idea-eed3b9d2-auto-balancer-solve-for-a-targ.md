Execute this requirement immediately without asking questions.

## REQUIREMENT

# Auto-balancer: solve for a target difficulty curve

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:07:40 PM

## Description
Designers currently nudge stats by hand and re-run sweeps to chase breakpoints. Invert the loop: let the designer declare the desired feel (e.g. 70% survival every level, 8-15s TTK, no trivial zones) and have an optimizer search the tuning multipliers and PLAYER_LEVEL_SCALING space � using runPredictiveBalance as the objective � to output the exact constants that hit the target. First sprint: a gradient-free hill-climb over the existing TuningOverrides multipliers that minimizes deviation from a target survival curve and surfaces the best-found tuning as a one-click apply.

## Reasoning
This converts balancing from days of manual trial-and-error into a stated intent that the machine solves � a genuinely magical 10x workflow that only this tool, with its formula model already in code, can offer. It compounds with the live simulator already present and is a story-worthy capability designers will tell peers about.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: GAS Abilities, Damage & Balance

**Description**: Gameplay Ability System authoring: ability spellbook, ability forge (AI generation), GAS blueprint editor with C++ codegen, and the balance simulator that sweeps damage formulas across levels. Generates UE5 GameplayEffect/GameplayAbility code.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook/data.ts`
- `src/components/modules/core-engine/unique-tabs/AbilitySpellbook/abilities/DamageCalcSection.tsx`
- `src/components/modules/core-engine/unique-tabs/AbilityForge/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AbilityForge/ForgeResult.tsx`
- `src/components/modules/core-engine/unique-tabs/GASBlueprintEditor/index.tsx`
- `src/components/modules/core-engine/unique-tabs/GASBlueprintEditor/codegen.ts`
- `src/components/modules/core-engine/unique-tabs/GASBlueprintEditor/templates.ts`
- `src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/index.tsx`
- `src/components/modules/core-engine/unique-tabs/GASBalanceSimulator/simulation.ts`
- `src/lib/gas-codegen.ts`
- `src/lib/combat/gas-balance-presets.ts`
- `src/lib/combat/predictive-balance.ts`
- `src/lib/combat/histogram.ts`
- `src/app/api/agents/forge-ability/route.ts`
- `src/types/gas-balance-simulator.ts`

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