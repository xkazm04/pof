Execute this requirement immediately without asking questions.

## REQUIREMENT

# Difficulty topology map: a god-view of game balance

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:07:57 PM

## Description
The level sweep and heatmap currently read as flat tables and discrete cells. Render the entire balance space � player level x encounter type x build � as one explorable continuous terrain where valleys are trivial zones, cliffs are difficulty spikes, and crit/armor breakpoints glow as ridgelines. Designers fly over the whole games difficulty topology and instantly see where it breaks. First sprint: replace the discrete heatmap grid in the predictive-balance view with an interpolated contour surface so survival gradients and spikes are visible at a glance.

## Reasoning
Turning numbers into a landscape lets anyone perceive the shape of an entire games difficulty in seconds � a workflow-revolutionizing, screenshot-worthy experience that makes balance legible and shareable. It builds directly on the heatmap data the simulator already produces, so the first contour step is a self-contained, high-impact visual upgrade.

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