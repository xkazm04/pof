Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live UE5 feel-sync: tune in browser, feel in PIE instantly

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:13:15 PM

## Description
Build a bidirectional bridge between the Feel Optimizer/Playground sliders and a running UE5 Play-In-Editor session over the existing PillarsOfFortuneBridge/Blender-MCP-style TCP channel. Dragging walkSpeed, dodge i-frames, or camera lag hot-patches the live ARPGCharacterBase UPROPERTY in under 100ms with zero rebuild, and the engine streams the actual resulting values back into the inspector. This turns the current write-once Apply-via-CLI flow into a closed WYSIWYG loop where designers feel every change as they make it.

## Reasoning
Game feel can only be judged by playing it, yet today every tweak requires a CLI write plus a full UE rebuild and replay, costing minutes per iteration. A sub-second tune-and-feel loop is the single capability that would make this the definitive game-feel tool and a story-worthy signature feature. The TCP bridge infrastructure already exists, so the path is conceivable even though the realtime sync is ambitious.

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