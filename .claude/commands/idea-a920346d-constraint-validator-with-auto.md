Execute this requirement immediately without asking questions.

## REQUIREMENT

# Constraint validator with auto-suggest fix

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 3:50:31 PM

## Description
Add a Constraints panel below PropertyInspector where designers declare gameplay invariants in plain language ("dodge must clear a 0.5s attack with 0.1s margin", "3 consecutive dodges must fit in starting stamina", "sprint exhausts stamina in under 8s"). The engine evaluates each constraint against the active FeelProfile and shows pass/fail chips; when failing, it computes the minimum-delta parameter change to satisfy it and offers a one-click apply (similar to how axe-core proposes accessibility fixes). Constraints live in a JSON file per character archetype.

## Reasoning
Tuning currently optimizes for "vibes" but ARPGs ship with hard playability requirements (boss telegraph readability, stamina economy). Linear, JIRA, and accessibility scanners proved that surfacing constraint violations inline turns guesswork into a checklist. The auto-suggest fix is the one-step-further enhancement � most validators only flag problems; here the math is invertible because the profile values are continuous, so we can deterministically compute a fix.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Character Blueprint & Feel Tuning

**Description**: Designs the player character: blueprint property inspector, movement/dodge trajectory, hitbox wireframe, camera profiles, and the feel optimizer/playground for tuning responsiveness. Backed by characterBlueprintStore.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/data.ts`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/movement/MovementOverview.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/movement/DodgeTrajectorySection.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/PropertyInspector.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/HitboxWireframeViewer.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterBlueprint/overview/ClassHierarchy.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterFeelOptimizer/ComparisonPanel.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterFeelPlayground/index.tsx`
- `src/components/modules/core-engine/unique-tabs/CharacterFeelPlayground/ValueRow.tsx`
- `src/lib/character-feel-optimizer.ts`
- `src/stores/characterBlueprintStore.ts`

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