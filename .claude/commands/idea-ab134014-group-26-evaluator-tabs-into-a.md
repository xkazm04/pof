Execute this requirement immediately without asking questions.

## REQUIREMENT

# Group 26 evaluator tabs into a command-palette nav

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 12:15:53 PM

## Description
EvaluatorModule.tsx renders 26 tabs in a single horizontally-scrolling bar; even with TabDividers (Analysis/Quality/Simulation/Pipeline/Intelligence) the active tab is often scrolled off-screen and discovery requires hunting. Add a Cmd/Ctrl+K command palette that lists tabs grouped by those five sections with fuzzy search, plus a persistent group label chip beside the title showing which section the active tab belongs to. Keep the scroll bar as a fallback but let power users jump in two keystrokes.

## Reasoning
Twenty-six peer-level tabs is the biggest cognitive-load problem in this context � users cannot hold the full surface in their head. A grouped, searchable launcher turns navigation from scanning into recall, makes the breadth feel like a feature instead of clutter, and sets a reusable pattern for other dense modules.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Code Evaluation & GDD Compliance

**Description**: 3-pass module evaluation (structure/quality/performance), deep-eval engine, codebase archeologist, game-design-doc synthesizer, and GDD-compliance checking. Backed by evaluatorStore and gddComplianceStore.
**Related Files**:
- `src/components/modules/evaluator/EvaluatorModule.tsx`
- `src/components/modules/evaluator/AggregateQualityDashboard.tsx`
- `src/components/modules/evaluator/DeepEvalResults.tsx`
- `src/components/modules/evaluator/GDDComplianceView.tsx`
- `src/components/modules/evaluator/GameDesignDocView.tsx`
- `src/components/modules/evaluator/CodebaseArcheologistView.tsx`
- `src/components/modules/evaluator/DependencyGraph.tsx`
- `src/lib/evaluator/deep-eval-engine.ts`
- `src/lib/evaluator/module-eval-prompts.ts`
- `src/lib/evaluator/finding-collector.ts`
- `src/lib/evaluator/fix-plan-generator.ts`
- `src/lib/gdd-compliance.ts`
- `src/lib/gdd-synthesizer.ts`
- `src/lib/codebase-archeologist.ts`
- `src/app/api/gdd-compliance/route.ts`
- `src/app/api/game-design-doc/route.ts`
- `src/app/api/codebase-archeologist/route.ts`
- `src/stores/evaluatorStore.ts`
- `src/stores/gddComplianceStore.ts`
- `src/types/evaluator.ts`
- `src/types/gdd-compliance.ts`

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