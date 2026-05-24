Execute this requirement immediately without asking questions.

## REQUIREMENT

# Session-vs-session build diff comparison

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:44:35 PM

## Description
Add a Compare mode that lets the user pick two complete sessions and renders a side-by-side diff: overallScore delta, coverage-by-category delta, and findings bucketed into New / Resolved / Still-present / Regressed. The fingerprint hashing already in regression-tracker.ts (stemTitle + hashFingerprint) can be reused for a pairwise comparison without persisting anything, so it is purely a read-time view over getFindings for the two sessions.

## Reasoning
Build-comparison views are table stakes in Datadog, CI dashboards and visual-regression tools like Chromatic/Percy because they answer the one question developers actually ask: did this build get better or worse? The Game Director stores per-session scores and coverage but offers no way to compare two builds directly, forcing manual cross-referencing.

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