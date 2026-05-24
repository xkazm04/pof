Execute this requirement immediately without asking questions.

## REQUIREMENT

# Automated translation QA validator

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:27:48 PM

## Description
memoQ QA, Xbench, Verifika, and Lokalise all run automated checks on the translated output, not just the source. The current pipeline only flags source-side hazards in scan-engine.ts; nothing validates the TranslationEntry results, yet a dropped {0} placeholder will crash UE5's FText::Format at runtime. Add a validateTranslations() pass that compares each entry against its source for placeholder parity ({0}/{1}), number parity, untranslated-identical-to-source segments, empty results, trailing/double whitespace, and glossary-term compliance. Surface failures in a new 'QA' preset chip alongside the existing needs-review filter. Push it further by attaching a one-click fixPrompt to each finding (mirroring the hazard cards) and gating a per-locale 'ready to ship' badge on a clean QA run.

## Reasoning
Translation QA is a category-standard safety net that catches the failures most likely to ship broken builds: lost format tokens, mistranslated numbers, and silent untranslated strings. It reuses the existing hazard/fixPrompt UX pattern and converts the translation engine's confidence scores into actionable, blocking quality signals.

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