Execute this requirement immediately without asking questions.

## REQUIREMENT

# Living Health Map: a breathing risk map of the whole game

## Metadata
- **Category**: ui
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/26/2026, 8:02:31 PM

## Description
Replace the flat crash list with an always-on, living visualization of the entire games structural health. Every module from the registry becomes a node that pulses and shifts color in real time as crashes, recurring patterns, systemic issues, and high-occurrence error-memory entries accumulate against it, fusing crashesByModule, CrashStats, the pattern/anti-pattern catalogs, and error_memory into one breathing map. A timeline scrubber lets you replay how risk spread across the project over a release, exposing systemic hot-spots at a glance. First step (one sprint): build a force-directed module graph that sizes and colors each node from the existing crashesByModule and patternsDetected stats, with a hover card listing that modules top crash patterns.

## Reasoning
Crash data today is buried in a text list that hides the single most valuable signal: which systems are structurally fragile and getting worse. A living, time-travelable health map turns reliability into something a whole team can feel and rally around in a single glance, and it is exactly the kind of striking, story-worthy artifact people screenshot and share. It reuses stats the analyzer already computes, so the vision is reachable from existing data.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Crash Analysis & Pattern Library

**Description**: Diagnose crashes and curate reusable patterns: crash log analysis with fingerprinting, the pattern library and anti-pattern catalog, and localization QA. Spans crash-analyzer/pattern-library libs, their stores, and the corresponding APIs.
**Related Files**:
- `src/lib/crash-analyzer/analysis-engine.ts`
- `src/lib/crash-analyzer/sample-crashes.ts`
- `src/lib/error-fingerprint.ts`
- `src/lib/error-memory-db.ts`
- `src/lib/pattern-library-db.ts`
- `src/lib/pattern-extractor.ts`
- `src/stores/crashAnalyzerStore.ts`
- `src/stores/patternLibraryStore.ts`
- `src/types/crash-analyzer.ts`
- `src/types/pattern-library.ts`
- `src/components/modules/evaluator/CrashAnalyzerView.tsx`
- `src/components/modules/evaluator/PatternLibraryView.tsx`
- `src/app/api/crash-analyzer/route.ts`
- `src/app/api/pattern-library/route.ts`
- `src/app/api/error-memory/route.ts`

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