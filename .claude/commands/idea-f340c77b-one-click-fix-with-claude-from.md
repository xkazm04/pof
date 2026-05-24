Execute this requirement immediately without asking questions.

## REQUIREMENT

# One-click Fix-with-Claude from profiling findings

## Metadata
- **Category**: functionality
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 5:00:47 PM

## Description
PerformanceProfilingView findings only offer copy-to-clipboard, while ProjectHealthDashboard already dispatches fixes via useModuleCLI. Wire each finding fixPrompt to a Fix-with-Claude button targeting arpg-polish, create a tracked checklist item from checklistLabel, and add a batch action to queue the top critical findings.

## Reasoning
One-click issue-to-action (SonarQube Create Issue, Sentry to Jira, Linear quick actions) closes the loop between diagnosis and fix. The data and CLI plumbing already exist, so this is high value at low effort and brings parity across the two dashboards.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Performance & Project Health

**Description**: UE5 performance profiling (CSV ingest + triage), holistic project-health dashboard, and combined-health/correlation engines that fuse evaluation, crashes, and perf into one score.
**Related Files**:
- `src/components/modules/evaluator/PerformanceProfilingView.tsx`
- `src/components/modules/evaluator/ProjectHealthDashboard.tsx`
- `src/components/modules/evaluator/HolisticHealthView.tsx`
- `src/lib/profiling/csv-parser.ts`
- `src/lib/profiling/triage-engine.ts`
- `src/lib/profiling/sample-generator.ts`
- `src/app/api/performance-profiling/route.ts`
- `src/app/api/project-health/route.ts`
- `src/lib/health-engine.ts`
- `src/lib/evaluator/combined-health.ts`
- `src/lib/evaluator/correlation-engine.ts`
- `src/stores/performanceProfilingStore.ts`
- `src/stores/projectHealthStore.ts`
- `src/types/performance-profiling.ts`
- `src/types/project-health.ts`

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