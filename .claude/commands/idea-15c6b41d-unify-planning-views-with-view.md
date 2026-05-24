Execute this requirement immediately without asking questions.

## REQUIREMENT

# Unify planning views with ViewHeader and ProgressBar

## Metadata
- **Category**: ui
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (5/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:58:09 AM

## Description
The five planning surfaces each reinvent their header (text-sm vs text-base titles, w-4 vs w-5 icons, differing gaps) and their progress bar (h-1, h-1.5, h-2 with mixed framer-motion/CSS animation). Extract a <ViewHeader title icon actions> primitive and a <ProgressBar value gradient> primitive in @/components/ui and adopt them everywhere to lock a single rhythm.

## Reasoning
Inconsistent headers and progress bars make the section feel assembled by different hands. Shared primitives create instant visual coherence, shrink each component, and let future views inherit the polished standard for free — classic design-system leverage.

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