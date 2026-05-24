Execute this requirement immediately without asking questions.

## REQUIREMENT

# Unify dashboards on one accessible chart primitive set

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 12:24:16 PM

## Description
PerformanceProfilingView, ProjectHealthDashboard and HolisticHealthView each hand-roll their own charts (FrameTimeChart, BarChartSimple, LineChartSimple, AreaChartSimple, BurndownChart, OverallScoreSparkline, ModuleScoreTrend) with inconsistent axes, legends, gridlines and hover behavior. Extract a composable @/components/ui/charts family (Bar, Line, Area, Sparkline) that share tokens from chart-colors, a 4/8px spacing rhythm, consistent rounded-sm bars, and a single Tooltip. Each primitive ships role=img plus an aria-label and an sr-only data summary so the visuals are accessible by default.

## Reasoning
Three flagship dashboards currently look subtly different because every chart is bespoke, which dilutes the premium feel and triples maintenance. A shared primitive set creates one coherent visual language across the app and makes accessibility a built-in default rather than an afterthought.

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