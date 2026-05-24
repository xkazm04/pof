Execute this requirement immediately without asking questions.

## REQUIREMENT

# Predictive Cook Forecaster: ETA, size & risk pre-launch

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:55:02 PM

## Description
Before a blind 60-minute gamble, forecast the outcome. Using the build-history-store.ts stats (per-platform avg duration, size trend) plus preflight results and what changed since the last build, predict estimated cook duration, resulting package size, and a success probability with named risk flags: This cook will take ~42 min, produce ~3.8 GB, 87% likely to succeed; 2 risks detected. First step: add a forecast helper that derives a duration/size estimate from getBuildStats + getSizeTrend for the selected profile and renders it as a pre-launch card in the Pipeline tab of PackagingView.

## Reasoning
Cooks are long, expensive, and currently launched blind � the developer has no idea what theyre committing to. A forecast turns packaging from a gamble into a planned operation and flags likely failures before the clock starts. All the historical signal already lives in build_history; it is simply not being projected forward yet.

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