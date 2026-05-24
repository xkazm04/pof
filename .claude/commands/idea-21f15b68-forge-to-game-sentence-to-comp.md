Execute this requirement immediately without asking questions.

## REQUIREMENT

# Forge-to-game: sentence to compiled, balanced ability

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:07:45 PM

## Description
AbilityForge stops at generated C++ text. Close the loop end to end: describe an ability in English, generate the GA_* class, write it into the UE project Source tree, trigger Live Coding hot-reload, then feed the ForgedAbility stats through the balance simulator and report whether it fits the existing power budget � all in one flow. First sprint: add a power-budget step in ForgeResult that runs the forged stats through the simulator and flags over/under-tuned abilities against the COMBO_ABILITIES curve before any file is written.

## Reasoning
Speak an ability into existence and watch it land in-game, pre-balanced, in under a minute � that is the kind of legendary capability that defines a category and attracts both users and talent. The power-budget check alone immediately stops the forge from emitting wildly mis-tuned abilities, turning a demo toy into a trustworthy authoring tool.

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