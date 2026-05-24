Execute this requirement immediately without asking questions.

## REQUIREMENT

# Balance regression baselines with drift alerts

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:34:08 PM

## Description
When a designer changes a damage formula, preset, or attribute scaling, there is no way to know whether overall balance silently shifted. Let users pin a scenario run as a baseline, then on any later re-run highlight drift (e.g. "TTK +34%, survival -18pp vs baseline") with severity badges, mirroring the diff mode the GAS codegen tab already offers. Persist baselines alongside the scenario library and compute deltas against the stored SimResults.

## Reasoning
Snapshot testing (Jest), visual regression (Chromatic), and CI baselines all exist because humans cannot eyeball whether a change broke something subtle. Combat tuning is exactly this class of problem: a small formula tweak can quietly wreck early-game survival. Baselines turn balancing into a safe, reviewable process instead of guesswork.

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