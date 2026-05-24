Execute this requirement immediately without asking questions.

## REQUIREMENT

# Predictive Success Oracle via semantic embeddings

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:31:37 PM

## Description
Replace the brittle Jaccard token similarity in clustering.ts with a local embedding model (transformers.js / small ONNX) so the system understands prompt meaning, not just shared words. Compute an embedding per session in session_analytics, then train a lightweight success classifier so that BEFORE a prompt runs, PromptEvolutionView shows a predicted success gauge with the nearest proven and failed prompts driving the score. First sprint step: add an embedding column to session_analytics, generate embeddings on the existing record path, and swap getBestCluster to use cosine similarity.

## Reasoning
Predicting failure before a costly multi-minute CLI run saves users real time and money and feels genuinely magical. Semantic understanding also dramatically improves pattern matching and the optimizer, lifting the quality of every downstream recommendation across the whole evolution and pattern-library system.

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