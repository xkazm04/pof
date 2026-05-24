Execute this requirement immediately without asking questions.

## REQUIREMENT

# Frame-data timeline for dodge i-frames & combat windows

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 3:50:07 PM

## Description
Add a horizontal frame-data ruler under DodgeTrajectorySection and the Movement tab showing startup / active / recovery / i-frame windows as colored stripes on a 60fps timeline, with hover-to-scrub and per-frame numerical readout. Reuses the existing DodgeProfile fields (iFrameStart, iFrameDuration, cancelWindowStart/End) and the StickFigurePreview in CharacterFeelPlayground. A second row could overlay an enemy attack so the designer can verify the dodge clears the active window.

## Reasoning
Frame-data displays are the universal language of the fighting/action-game community (Dustloop, fightcore, Tekken-Zaibatsu) � designers and pros think in frames, not seconds. The current 0.7s/0.4s numeric values force mental math; a visual stripe immediately tells you if the dodge clears a boss attack. This unlocks credible tuning conversations and is the single biggest feature gap vs. how shipped soulslikes/ARPGs are actually balanced.

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