Execute this requirement immediately without asking questions.

## REQUIREMENT

# Unify type scale & semantic status color tokens

## Metadata
- **Category**: ui
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:44:05 AM

## Description
Nearly every line is text-2xs/text-xs in text-text-muted, producing a flat, cramped hierarchy, and severity/status colors mix semantic tokens (bg-status-red-subtle) with ad-hoc raw classes (bg-amber-500/5, text-amber-400, text-red-400). Define a small shared scale (section titles text-sm font-semibold text-text, primary content text-xs text-text, metadata text-2xs text-text-muted) and route SEVERITY_STYLE/STATUS_STYLE through the existing semantic status tokens so warning/error/info read consistently and theme changes propagate cleanly.

## Reasoning
Clear typographic hierarchy and consistent color semantics make dense localization data scannable for non-technical users, directly supporting the Globalization goal, and as a design-system change it elevates readability across the whole evaluator module rather than one screen.

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