Execute this requirement immediately without asking questions.

## REQUIREMENT

# Staged pipeline progress stepper + skeleton loaders

## Metadata
- **Category**: ui
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:44:05 AM

## Description
runFullPipeline chains scan -> replacements -> tables -> translate but the UI shows only a single spinning RefreshCw with 'Running...'. Add a horizontal stepper (Scanning strings, Detecting hazards, Generating translations, Building tables) that fills checkmarks as each phase completes (drive it via a 'phase' field on the store emitted over the event-bus, or split the POST into phased calls), and replace the blank loading area with skeleton placeholders for the stat tiles and list rows using a staggered framer-motion fade-in that respects useReducedMotion.

## Reasoning
A 10-30s opaque spinner feels broken and erodes trust; staged feedback plus skeletons makes the wait feel responsive and communicates exactly what the engine is doing. Perceived performance is one of the highest-leverage polish wins for long-running tooling.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Localization Pipeline

**Description**: Localization scan/translation pipeline: scans source strings, runs translation engine, and tracks coverage. Backed by localizationPipelineStore.
**Related Files**:
- `src/lib/localization/definitions.ts`
- `src/lib/localization/scan-engine.ts`
- `src/lib/localization/translation-engine.ts`
- `src/app/api/localization-pipeline/route.ts`
- `src/stores/localizationPipelineStore.ts`
- `src/types/localization-pipeline.ts`
- `src/components/modules/evaluator/LocalizationPipelineView.tsx`

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