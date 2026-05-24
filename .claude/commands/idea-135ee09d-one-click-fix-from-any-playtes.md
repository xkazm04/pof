Execute this requirement immediately without asking questions.

## REQUIREMENT

# One-click Fix from any playtest finding

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:44:30 PM

## Description
Add a Fix this button to each finding in SessionDetail FindingsList and FindingsExplorer that dispatches a CLI fix task via the existing TaskFactory.featureFix + useModuleCLI hook, pre-populating the prompt with the finding title, description, suggestedFix, relatedModule and gameTimestamp. This turns the Game Director from a read-only critic into an actionable loop where a detected issue becomes a running repair task in one click. Track the originating finding id so the regression tracker can later confirm whether the fix held.

## Reasoning
Sentry (Create Issue/Autofix) and GitHub Copilot Autofix made detection valuable only because they bridge straight to a fix; today findings carry a suggestedFix and relatedModule that the user must copy-paste manually. The plumbing (cli-task.ts, useModuleCLI) already exists, so this is high value at low effort and closes the detect->fix->verify loop the regression tracker already assumes.

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