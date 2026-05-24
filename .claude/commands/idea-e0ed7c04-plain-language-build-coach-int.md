Execute this requirement immediately without asking questions.

## REQUIREMENT

# Plain-Language Build Coach: intent to prompt compiler

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:31:44 PM

## Description
Make the entire 6-section PromptBuilder invisible to non-technical users. A user types an outcome in plain English (enemies that chase me and attack up close); an intent compiler maps it to the right module + checklist item, auto-injects the best-performing variant, the matching ue-gotchas, known assets, and wiring requirements, then explains in everyday language what it will build and why. The user describes results, never prompts. First sprint step: a thin intent classifier endpoint that maps free text to the best-matching module-registry checklist entry and pre-fills the builder.

## Reasoning
This directly advances the Globalization goal of being understandable by non-technical users, removing the single biggest barrier to adoption: knowing UE5 jargon and prompt craft. It could 10x the addressable audience by letting hobbyists and designers ship UE5 systems without ever learning the engine vocabulary.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Prompt Builder, Knowledge & Evolution

**Description**: Composable prompt-builder with project-context header and module-registry checklists, UE knowledge packs (gotchas, known-assets, wiring), and the prompt-evolution engine (A/B testing, clustering, mutations) with the pattern library.
**Related Files**:
- `src/lib/prompts/prompt-builder.ts`
- `src/lib/prompt-context.ts`
- `src/lib/module-registry.ts`
- `src/lib/knowledge/ue-gotchas.ts`
- `src/lib/knowledge/ue-known-assets.ts`
- `src/lib/knowledge/wiring-requirements.ts`
- `src/lib/knowledge/binary-content.ts`
- `src/lib/knowledge/types.ts`
- `src/lib/prompt-evolution/engine.ts`
- `src/lib/prompt-evolution/ab-testing.ts`
- `src/lib/prompt-evolution/clustering.ts`
- `src/lib/prompt-evolution/mutations.ts`
- `src/lib/pattern-extractor.ts`
- `src/lib/pattern-library-db.ts`
- `src/app/api/prompt-evolution/route.ts`
- `src/app/api/pattern-library/route.ts`
- `src/stores/promptEvolutionStore.ts`
- `src/stores/patternLibraryStore.ts`
- `src/components/modules/evaluator/PromptEvolutionView.tsx`
- `src/components/modules/evaluator/PatternLibraryView.tsx`

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