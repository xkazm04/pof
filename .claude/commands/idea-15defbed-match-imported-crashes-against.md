Execute this requirement immediately without asking questions.

## REQUIREMENT

# Match imported crashes against known fixes

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:57:06 PM

## Description
analyzeSingleCrash only returns a diagnosis when crashId exactly equals a sample id, so a freshly imported crash always shows no analysis. Generate a crash signature (crashType plus culprit function plus normalized callstack) using the same approach as error-fingerprint.ts, then match new crashes against previously diagnosed crashes and the error-memory DB. When a match is found, surface the prior root cause, fix, and a This fix resolved N similar crashes confidence note.

## Reasoning
Sentry Similar Issues and Crashlytics known-issue matching are beloved because they instantly tell you we have seen this before, here is what worked. This reuses the existing fingerprinting engine and error memory, fixing the current dead-end where imported crashes yield nothing and compounding the value of every diagnosis over time.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Crash & Error Analysis

**Description**: Crash-log analysis engine, error fingerprinting, and persistent error memory that feeds prompt context. Diagnostics surface through crashAnalyzerStore and errorDiagnosticsStore.
**Related Files**:
- `src/components/modules/evaluator/CrashAnalyzerView.tsx`
- `src/lib/crash-analyzer/analysis-engine.ts`
- `src/lib/crash-analyzer/sample-crashes.ts`
- `src/app/api/crash-analyzer/route.ts`
- `src/lib/error-memory-db.ts`
- `src/lib/error-fingerprint.ts`
- `src/app/api/error-memory/route.ts`
- `src/stores/crashAnalyzerStore.ts`
- `src/stores/errorDiagnosticsStore.ts`
- `src/types/crash-analyzer.ts`
- `src/types/error-memory.ts`

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