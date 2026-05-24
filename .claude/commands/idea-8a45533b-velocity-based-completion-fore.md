Execute this requirement immediately without asking questions.

## REQUIREMENT

# Velocity-based completion forecast

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:48:07 PM

## Description
review_snapshots already records implemented/total counts per module over time and the matrix shows a quality sparkline. Compute a velocity (features moved to implemented per week) from snapshot history and project an estimated completion date for each module and the whole project, shown as a When will this be done? badge with a confidence range. Surface it next to the existing sparkline and on the cross-module dashboard.

## Reasoning
Burndown and velocity-based projections are table stakes in Jira, Linear, and Monday because they answer the question every stakeholder asks: when will it ship. The snapshot time-series needed for the calculation is already persisted, so this is a derived metric plus a small UI, and it makes the existing history data far more actionable than a bare trend line.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Feature Matrix & Next-Best-Action

**Description**: Cross-module feature dependency matrix, overlap detection, batch review, and the NBA (Next Best Action) engine that recommends what to build next. Backed by feature-matrix DB and feature-definitions graph.
**Related Files**:
- `src/components/modules/core-engine/FeatureMatrix.tsx`
- `src/components/modules/shared/RecommendedNextBanner.tsx`
- `src/components/modules/evaluator/CrossModuleFeatureDashboard.tsx`
- `src/components/modules/evaluator/CrossModuleOverlapPanel.tsx`
- `src/components/modules/evaluator/BatchReviewPanel.tsx`
- `src/lib/feature-matrix-db.ts`
- `src/lib/feature-definitions.ts`
- `src/lib/nba-engine.ts`
- `src/lib/overlap-detection.ts`
- `src/hooks/useFeatureMatrix.ts`
- `src/hooks/useNBA.ts`
- `src/app/api/feature-matrix/route.ts`
- `src/app/api/feature-matrix/aggregate/route.ts`
- `src/app/api/feature-matrix/batch-review/route.ts`
- `src/app/api/feature-matrix/overlap/route.ts`
- `src/app/api/feature-matrix/progress/route.ts`
- `src/app/api/feature-matrix/history/route.ts`
- `src/types/feature-matrix.ts`

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