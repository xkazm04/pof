Execute this requirement immediately without asking questions.

## REQUIREMENT

# Close the loop: auto-adopt winning variant as live prompt

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:51:06 PM

## Description
The evolution engine produces A/B winners (getBestVariant) and "adopt-winner" suggestions, but adoption is manual and nothing wires the winner back into the dispatch path — buildTaskPrompt/module-registry still serve the static default. Add a persisted promptOverrides layer keyed by `moduleId::checklistItemId` that the prompt builders consult first, with a one-click "Adopt" on each suggestion. Push it further with a champion/challenger model that auto-reverts if the live success rate of an adopted prompt regresses below the prior default.

## Reasoning
This is the pattern behind LaunchDarkly/Optimizely "promote winner to 100%" and PromptLayer "set production version". Right now every insight the evolution engine generates is a dead end — it never changes a real dispatch, so the whole subsystem produces no measurable improvement. Closing the loop is what turns this from a dashboard into a self-improving system.

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