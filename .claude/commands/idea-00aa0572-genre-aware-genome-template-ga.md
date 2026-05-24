Execute this requirement immediately without asking questions.

## REQUIREMENT

# Genre-aware genome template gallery

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (6/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:38:18 PM

## Description
The genre-evolution-engine already detects sub-genres (souls-like, diablo-like, character-action, etc.) with confidence scores, but its suggestions only reorder checklists. Add a curated gallery of pre-tuned character and item genomes keyed to each SubGenreId, so when the engine suggests Evolve toward Souls-like the designer can one-click import a matching deliberate-stamina-heavy archetype and a high-coherence weapon genome into genomeStore. Mirrors Notion and Figma template galleries that turn a recommendation into an instant starting point.

## Reasoning
Starting a new archetype from the generic presets wastes the rich, genre-specific knowledge the evolution engine already produces; template galleries are the proven way successful tools convert intent into momentum. Connecting the two existing systems gives designers a credible head-start aligned with their detected direction and increases adoption of both the genome editor and the genre engine. The templates are static data plus the existing import path, so effort is moderate.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Genome Editing & Progression Curves

**Description**: Procedural character/item DNA (genome) editors with C++ codegen, attribute-point optimizer, and the XP/power progression curve designer with build comparison and time-to-level estimation. Includes genre-evolution engine and genomeStore.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/CharacterGenomeEditor/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemDNAGenomeEditor/CodePreview.tsx`
- `src/components/modules/core-engine/unique-tabs/ProgressionCurve/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ProgressionCurve/data.ts`
- `src/components/modules/core-engine/unique-tabs/ProgressionCurve/curves/XpCurveChart.tsx`
- `src/components/modules/core-engine/unique-tabs/ProgressionCurve/curves/MultiCurveOverlay.tsx`
- `src/components/modules/core-engine/unique-tabs/ProgressionCurve/rewards/TimeToLevelEstimator.tsx`
- `src/components/modules/core-engine/unique-tabs/AttributePointOptimizer/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AttributePointOptimizer/design.tsx`
- `src/lib/genome/codegen.ts`
- `src/lib/genome/defaults.ts`
- `src/lib/item-dna/rolling-engine.ts`
- `src/lib/genre-evolution-engine.ts`
- `src/stores/genomeStore.ts`
- `src/types/character-genome.ts`
- `src/types/item-genome.ts`
- `src/hooks/useGenomeHistory.ts`
- `src/hooks/useGenreEvolution.ts`

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