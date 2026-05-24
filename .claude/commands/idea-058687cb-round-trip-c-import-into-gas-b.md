Execute this requirement immediately without asking questions.

## REQUIREMENT

# Round-trip C++ import into GAS Blueprint Editor

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:34:08 PM

## Description
The GAS Blueprint Editor is write-only: it emits AttributeSet.h/GameplayTags.h/Effects.cpp from seed data but cannot read the real project, so it drifts from ground truth. The Spellbook already parses the live UE source via useUE5SourceSync (attributes, tags, abilities); reuse that parser to hydrate the editor from the actual UARPGAttributeSet and tag rules, so designers edit reality and regenerate diffs against committed code.

## Reasoning
Prisma db-pull introspection and Unreal Blueprint reflection succeed because round-trip editing keeps the visual model and the source in sync. A one-directional generator is abandoned the moment hand-written C++ diverges from the seed. Importing real source makes the editor trustworthy for an existing codebase rather than only greenfield scaffolding.

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