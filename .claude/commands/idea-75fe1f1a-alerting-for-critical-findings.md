Execute this requirement immediately without asking questions.

## REQUIREMENT

# Alerting for critical findings and regressions

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:44:41 PM

## Description
When a playtest completes with critical findings or the regression tracker raises a RegressionAlert, publish to the typed event-bus (eval.* / build.* channels) and fire a configurable notification � in-app toast plus an optional user-set webhook (Slack/Discord) and/or OS notification. Add a small threshold config (e.g. notify on critical-only, or on any regression) persisted alongside the session settings.

## Reasoning
Sentry and Datadog earn their keep by pushing alerts the moment something breaks rather than waiting for someone to open a dashboard; here, regression alerts and criticals are completely passive and only seen if the user navigates to the right tab. Routing through the existing event-bus makes this low-risk and immediately raises the odds that a serious regression is caught the day it appears.

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