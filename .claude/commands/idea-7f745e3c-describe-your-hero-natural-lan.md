Execute this requirement immediately without asking questions.

## REQUIREMENT

# Describe-Your-Hero Natural-Language Genome Author

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:11:12 PM

## Description
Add a plain-English prompt box to the Character/Item Genome editors where a non-technical user types 'a slow, armored tank that hits hard but dodges poorly' and an LLM synthesizes a complete genome (movement, combat, dodge, camera, attributes), generates the UE5 C++, and explains every tradeoff in everyday language. First step (one sprint): ship genomeFromDescription() mapping ~8 archetype descriptors to weighted preset blends behind a text input, with a plain-language summary of the result.

## Reasoning
The genome editor exposes dozens of cm/s and i-frame fields only a UE5 engineer understands, locking out designers and non-technical users. Natural-language authoring collapses that expertise barrier and directly advances the Globalization goal of an app any day-to-day user can operate.

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