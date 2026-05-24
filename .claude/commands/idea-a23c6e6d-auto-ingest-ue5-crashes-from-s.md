Execute this requirement immediately without asking questions.

## REQUIREMENT

# Auto-ingest UE5 crashes from Saved/Crashes folder

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:57:01 PM

## Description
The analyzer runs only on SAMPLE_CRASHES and requires manual log paste in the Import tab. Add a server-side scanner in the crash-analyzer API route that reads the active UE project path from projectStore, enumerates the Saved/Crashes subfolders, parses each crash log with the existing parseCrashLog, and persists results to a new SQLite crashes table (mirroring error-memory-db) deduped by a crash fingerprint. Surface a Scan Crash Folder button next to Analyze Crashes.

## Reasoning
Crashlytics and Sentry never make a developer paste a stack trace by hand; ingestion is automatic and continuous. UE already dumps every crash to Saved/Crashes, so auto-ingest plus persistence turns this from a demo on sample data into a real tool wired to the users actual project, which is the single biggest unlock for the whole context.

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