Execute this requirement immediately without asking questions.

## REQUIREMENT

# Build Mission Control: live cinematic cook cockpit

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:55:15 PM

## Description
Transform packaging from a wall of log text into a real-time command center the developer wants to watch. A single cockpit unifies the build-queue state, a cook phase timeline (cook to stage to package to done from CookEvent), live triaged log highlights (errors/warnings surfaced from the existing throttled stream), a smoke-test heartbeat, the cross-platform build matrix, and a predictive ETA ring. First step: a live phase-timeline strip plus animated progress/ETA ring component fed directly by the SSE CookEvent stream already emitted from /api/packaging/execute, dropped into PackagingViews Pipeline tab.

## Reasoning
The cook is the longest, most anxiety-inducing operation in the workflow, yet it is currently a passive scrolling log. A glanceable, beautiful cockpit turns dead waiting time into confident situational awareness and makes the product feel best-in-class. It reuses the structured event stream and history data that already exist, so the lift is presentation rather than new plumbing.

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