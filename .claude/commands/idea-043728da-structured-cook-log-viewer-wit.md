Execute this requirement immediately without asking questions.

## REQUIREMENT

# Structured cook-log viewer with severity + jump-to-error

## Metadata
- **Category**: ui
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 3:32:23 PM

## Description
Replace the flat <pre> in CookProgress.tsx with a virtualized log list that parses each UAT line for severity (Error:/Warning:/LogCook:Display:) and renders it with a colored left border (red/yellow/blue tokens from chart-colors), a monospaced timestamp prefix, and a Cmd+F-style filter row above (All / Errors / Warnings / Cook / Stage). Add a sticky Jump to error button when errors exist, a copy-all button that includes timestamps, and a small auto-scroll lock toggle that disables tailing the moment the user scrolls up so they can read in peace.

## Reasoning
The current log dump dumps undifferentiated UAT noise � operators have to eyeball thousands of lines to find the one Error: that killed the cook. Severity coloring + jump-to-error turns a 90-second hunt into a 1-second glance, and a respectful auto-scroll lock fixes the most common log-viewer frustration (scrolling up to read something and getting yanked back to the bottom).

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