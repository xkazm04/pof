Execute this requirement immediately without asking questions.

## REQUIREMENT

# Add focus-visible rings and ARIA to custom controls

## Metadata
- **Category**: code_quality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:58:35 AM

## Description
Keyboard and screen-reader users get no signal across this context: the PropertyInspector search uses focus:outline-none with no replacement ring, the HitboxWireframeViewer toggles are buttons with a custom switch but no role=switch or aria-checked, the narrative breadcrumb lacks aria-current, and the Playground preset dropdown has no aria-expanded, no keyboard navigation, and no outside-click close. Introduce a shared focus-visible:ring-2 ring accent/50 utility and add the missing semantics.

## Reasoning
These are concrete WCAG keyboard-operability and name-role-value failures on the primary tuning surface. A single shared focus utility plus targeted ARIA props fixes them everywhere and sets an accessible pattern the other unique-tabs can copy.

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