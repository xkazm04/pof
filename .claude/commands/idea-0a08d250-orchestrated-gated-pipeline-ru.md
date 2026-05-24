Execute this requirement immediately without asking questions.

## REQUIREMENT

# Orchestrated gated pipeline runs (preflight to ship)

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:09:27 PM

## Description
Today preflight, UBT build, cook, smoke-test, and version-bump are separate endpoints invoked one at a time. Add a single PipelineRun orchestrator that chains them as fail-fast gated stages (skip cook if preflight fails, skip distribute if smoke fails), persists one pipeline_runs record with per-stage status/duration, and renders a unified stage timeline in PackagingView. The cook-executor event stream and buildQueue already exist � wrap them in a stage runner that consults overallStatus() between gates.

## Reasoning
Chained, gated stages are the defining feature of every modern CI (GitHub Actions, GitLab CI, Jenkins). The component islands are already built and tested; the only missing piece is the orchestration layer that turns five manual clicks into one reproducible run. This converts the toolset from a collection of scripts into an actual pipeline, the single highest-leverage upgrade for this context.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Build & Packaging Pipeline

**Description**: UE5 cook/package pipeline: build profiles, preflight checks, cook executor, smoke tests, version manager, and UAT command generation with a build-history store and comparison UI.
**Related Files**:
- `src/components/modules/game-systems/PackagingView.tsx`
- `src/components/modules/game-systems/CookSettingsPanel.tsx`
- `src/components/modules/game-systems/BuildComparison.tsx`
- `src/lib/packaging/cook-executor.ts`
- `src/lib/packaging/build-profiles.ts`
- `src/lib/packaging/build-profiles-db.ts`
- `src/lib/packaging/preflight.ts`
- `src/lib/packaging/smoke-test.ts`
- `src/lib/packaging/version-manager.ts`
- `src/lib/packaging/uat-command-generator.ts`
- `src/lib/packaging/build-history-store.ts`
- `src/lib/ue5-bridge/build-pipeline.ts`
- `src/lib/ue5-bridge/build-queue.ts`
- `src/app/api/packaging/execute/route.ts`
- `src/app/api/packaging/preflight/route.ts`
- `src/app/api/packaging/smoke-test/route.ts`
- `src/app/api/packaging/profiles/route.ts`
- `src/app/api/packaging/history/route.ts`
- `src/hooks/useBuildPipeline.ts`

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