Execute this requirement immediately without asking questions.

## REQUIREMENT

# Programmatic AnimBP graph generation engine

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:42:12 PM

## Description
Build a PoFEditor commandlet/Python tool that constructs AnimBP AnimGraph nodes programmatically (state machine nodes, transition rules, blend nodes) directly from the StateMachineEditor data model, turning todays setup-instructions comment block into a real generated .uasset. This directly attacks the recurring not-automatable-from-headless wall noted across the codebase.

## Reasoning
Every part of the codebase concedes the AnimBP graph must be hand-built in the editor; cracking that makes PoF the first tool to fully auto-generate animation blueprints. First step: spike a PoFEditor Python script that creates an empty AnimBlueprint and adds one state machine node via editor scripting, proving the graph can be mutated programmatically.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Animation State Graphs & Montages

**Description**: Authors UE5 animation: state machine/graph editor, combo montages with frame scrubber, blend-space budget, retargeting, Mixamo import, and AI combo choreographer. Scans AnimBP assets and emits animation code.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/state-graph/StateGroupBrowser.tsx`
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/combos-montages/ComboChainPanel.tsx`
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/combos-montages/FrameScrubberPanel.tsx`
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/budget/BlendSpacePanel.tsx`
- `src/components/modules/core-engine/unique-tabs/AnimationStateGraph/retargeting/RetargetingTab.tsx`
- `src/components/modules/content/animations/AnimationsView.tsx`
- `src/components/modules/content/animations/StateMachineEditor.tsx`
- `src/components/modules/content/animations/AIComboChoreographer.tsx`
- `src/components/modules/content/animations/MixamoImport.tsx`
- `src/components/modules/core-engine/dzin-panels/AnimationStateMachinePanel.tsx`
- `src/components/modules/core-engine/dzin-panels/AnimationBlendSpacePanel.tsx`
- `src/components/modules/core-engine/dzin-panels/AnimationMontagesPanel.tsx`
- `src/lib/animations.ts`
- `src/lib/prompts/animation-checklist.ts`
- `src/app/api/filesystem/scan-animbp/route.ts`

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