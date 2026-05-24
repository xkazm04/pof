Execute this requirement immediately without asking questions.

## REQUIREMENT

# Make disclosure cards & tabs keyboard/ARIA accessible

## Metadata
- **Category**: ui
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:44:05 AM

## Description
StringCard, HazardCard and StringTableCard expand via <div onClick> with cursor-pointer but no role, tabIndex, aria-expanded, or Enter/Space handler, so they are unreachable by keyboard and silent to screen readers. Convert the clickable header to a real <button> with aria-expanded and aria-controls, give the sub-tab nav role='tablist' with role='tab'/aria-selected, add aria-label to the two search inputs, and aria-pressed to PresetChip toggles.

## Reasoning
Keyboard and screen-reader access is a baseline requirement, not a nice-to-have, and the whole evaluator surface currently fails it. The fix is mechanical, follows WAI-ARIA disclosure/tab patterns, and raises the quality bar for every other panel in the app.

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