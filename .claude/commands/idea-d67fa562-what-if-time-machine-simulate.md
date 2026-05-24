Execute this requirement immediately without asking questions.

## REQUIREMENT

# What-If Time Machine: simulate ship dates live

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:23:27 PM

## Description
CalendarRoadmapView already predicts dates from velocity and layout-engine already computes the critical path via longest-effort DP. Turn the roadmap into an interactive simulator where makers drag levers and watch the ship date move instantly: 'run 3 agents in parallel', 'cut multiplayer', 'skip everything below medium impact', 'double my hours'. Wall-clock time is derived from critical-path length versus total effort divided by concurrency. First sprint step: add a parallelism slider (1-N concurrent agents) to the plan that recomputes projected wall-clock completion using findCriticalPath vs total effort and shows the live ship-date delta.

## Reasoning
It transforms planning from a static list into a playable strategy surface, letting makers find the fastest path to a demo in seconds instead of guessing. Seeing the ship date jump as you toggle scope is the kind of story-worthy moment users share. The critical-path and effort math already exist, so the moonshot is the interactive what-if layer on top.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Implementation Planning & Roadmap

**Description**: Generates implementation plans (effort/impact scoring, DAG layout), milestone deadlines, workflow-DAG orchestration, and roadmap/calendar views. Backed by taskDAGStore.
**Related Files**:
- `src/components/modules/core-engine/ImplementationPlan.tsx`
- `src/components/modules/core-engine/PlanView.tsx`
- `src/components/modules/core-engine/RoadmapChecklist.tsx`
- `src/lib/implementation-planner/plan-generator.ts`
- `src/lib/implementation-planner/effort-estimator.ts`
- `src/lib/implementation-planner/impact-scorer.ts`
- `src/lib/implementation-planner/layout-engine.ts`
- `src/lib/implementation-planner/sector-layout-engine.ts`
- `src/lib/task-dag-orchestrator.ts`
- `src/lib/workflow-templates.ts`
- `src/app/api/milestone-deadlines/route.ts`
- `src/app/api/workflow-dag/route.ts`
- `src/app/api/project-progress/route.ts`
- `src/hooks/useImplementationPlan.ts`
- `src/stores/taskDAGStore.ts`
- `src/types/task-dag.ts`
- `src/components/modules/evaluator/WorkflowOrchestratorView.tsx`
- `src/components/modules/evaluator/CalendarRoadmapView.tsx`

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