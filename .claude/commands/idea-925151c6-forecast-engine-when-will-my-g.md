Execute this requirement immediately without asking questions.

## REQUIREMENT

# Forecast engine: when will my game be playable?

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:28:57 PM

## Description
Review snapshots already capture per-module status over time but are only used for a sparkline. Build a velocity/Monte-Carlo forecasting engine that projects per-module ETAs, a confidence band, and dated "playable" and "shippable" milestones from historical snapshot velocity weighted by remaining dependency-graph work, shown as a burn-up chart. First sprint step: derive features-implemented-per-day from getAllReviewHistory() and render a naive linear ETA ("~3 weeks to playable at current pace") on the cross-module dashboard.

## Reasoning
Solo creators and small teams have no idea if they are weeks or years from done � a credible, plain-English projected date is the single most motivating and decision-shaping number a game-dev tool can show, and the historical data to compute it is already being captured.

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