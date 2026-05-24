Execute this requirement immediately without asking questions.

## REQUIREMENT

# Predictive fragility radar: forecast regressions

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:26:06 PM

## Description
The regression-tracker is reactive � it only alerts after a fixed fingerprint reappears. Build a predictive fragility model over the existing fingerprint history (regression_count, occurrence_count, peak_severity, build_gap) plus module churn to forecast which systems are most likely to break in the NEXT build, surfaced as a ranked fragility heatmap in the RegressionTrackerView before a playtest is even run. The director warns you where to look first. First sprint step: compute a per-module fragility score from existing regression_fingerprints aggregates and render it as a sorted list in the Regressions tab.

## Reasoning
Anticipating failures before they happen � rather than cataloguing them after � transforms the tracker from a logbook into an early-warning system, the difference between a rear-view mirror and radar. It directs scarce testing attention to the riskiest systems, and the prediction quality compounds as more sessions accumulate, deepening the data moat with zero extra user effort.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Game Director, Sessions & Telemetry

**Description**: Game-director dev-session tracking: session detail, findings explorer, regression tracker, session analytics, weekly digest, and telemetry persistence. Backed by game-director, session-analytics, session-log, and telemetry DBs.
**Related Files**:
- `src/components/modules/game-director/GameDirectorModule.tsx`
- `src/components/modules/game-director/DirectorOverview.tsx`
- `src/components/modules/game-director/NewSessionPanel.tsx`
- `src/components/modules/game-director/SessionDetail.tsx`
- `src/components/modules/game-director/FindingsExplorer.tsx`
- `src/components/modules/game-director/RegressionTrackerView.tsx`
- `src/lib/game-director-db.ts`
- `src/lib/session-analytics-db.ts`
- `src/lib/session-log-db.ts`
- `src/lib/regression-tracker.ts`
- `src/lib/weekly-digest.ts`
- `src/lib/telemetry-db.ts`
- `src/app/api/game-director/route.ts`
- `src/app/api/session-analytics/route.ts`
- `src/app/api/session-log/route.ts`
- `src/app/api/regression-tracker/route.ts`
- `src/app/api/weekly-digest/route.ts`
- `src/app/api/telemetry/route.ts`
- `src/hooks/useGameDirector.ts`
- `src/hooks/useSessionAnalytics.ts`
- `src/components/modules/evaluator/SessionAnalyticsDashboard.tsx`
- `src/components/modules/evaluator/WeeklyDigestView.tsx`

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