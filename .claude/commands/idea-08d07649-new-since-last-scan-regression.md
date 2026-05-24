Execute this requirement immediately without asking questions.

## REQUIREMENT

# New-since-last-scan regression diff with git blame

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:54:22 PM

## Description
After each deep eval, diff the new findings against the previous scanId using finding-collector fingerprints and tag every finding NEW, RESOLVED, or PERSISTING; default DeepEvalResults to a New-issues view so regressions stand out. Push it further by reusing codebase-archeologist git-log parsing to attribute each NEW finding to the commit(s) that touched its file between scans (e.g. this critical issue appeared in commit abc123). Show a compact regression summary banner (+3 critical, -5 resolved) at the top of the results tree.

## Reasoning
SonarQube New Code period and GitHub code-scanning PR checks proved that focusing on issues introduced since the last analysis is far more actionable than re-triaging the whole backlog. Today every scan starts from zero with no memory of the prior run, so users cannot tell whether their last change helped or hurt. Git attribution makes regressions traceable to a cause, dramatically shortening the fix loop.

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