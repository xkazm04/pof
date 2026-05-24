Execute this requirement immediately without asking questions.

## REQUIREMENT

# Convert AutoSave toggles to real accessible Switch controls

## Metadata
- **Category**: ui
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 3:27:23 PM

## Description
AutoSaveConfig.tsx renders 'Combat Save' and 'Compression' as decorative <span> pills with an absolutely positioned dot � they look like switches but cannot be focused, toggled, or read by a screen reader. Replace each with a real Radix UI Switch (or a small custom button with role='switch', aria-checked, focus-visible:ring-2 ring-cyan-400/40), keep the existing cyan/emerald palette via inline styles, and wire onCheckedChange to a Zustand action so the value actually persists. Apply the same pattern to the interval slider (currently a static div � should be an <input type='range'> with the cyan track styling preserved).

## Reasoning
Right now this panel is theater: it teaches users that the controls do nothing, eroding trust in every similar visualization across the app. Real controls turn this dashboard into a config tool, fix keyboard accessibility for an entire pattern, and set a precedent for the dozen other 'design.tsx' panels that copy this style.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Gameplay Systems (Physics, Net, Save, Input, Blueprint)

**Description**: Domain views for physics, multiplayer/replication, save-load data schema, input mapping, and the blueprint-to-C++ transpiler that parses UE5 Blueprints and emits code.
**Related Files**:
- `src/components/modules/game-systems/PhysicsView.tsx`
- `src/components/modules/game-systems/MultiplayerView.tsx`
- `src/components/modules/game-systems/SaveLoadView.tsx`
- `src/components/modules/game-systems/InputView.tsx`
- `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/design.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/advanced/AutoSaveConfig.tsx`
- `src/components/modules/core-engine/unique-tabs/SaveDataSchema/advanced/SerializationProfiler.tsx`
- `src/app/api/blueprint-transpiler/route.ts`
- `src/lib/blueprint-parser.ts`
- `src/hooks/useBlueprintTranspiler.ts`
- `src/types/blueprint.ts`

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