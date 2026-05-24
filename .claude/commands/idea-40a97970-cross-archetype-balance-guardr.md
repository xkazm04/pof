Execute this requirement immediately without asking questions.

## REQUIREMENT

# Cross-archetype balance guardrails / outlier linter

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:38:04 PM

## Description
Wire the existing LevelScaledPowerCurve, ArchetypeComparisonPanel and PowerCurveDangerZones together into an automated balance check. Sample each character genome effective power (DPS/EHP) across level bands, compute the archetype mean, and flag outliers: dominant builds more than X% above mean and underpowered builds below Y%, plus any archetype whose curve crosses the progression danger zone. Surface the specific field nudges (e.g. lower critMultiplier) that would pull an outlier back in line. Inspired by competitive balance dashboards like Riot champion win-rate views and spreadsheet conditional formatting.

## Reasoning
validateGenome today only checks per-field legality, not whether one archetype trivializes the others, which is the central job of a multi-class balance tool. Automatic outlier flagging across level bands catches power creep before it ships and turns the comparison matrix from a passive readout into actionable guidance. All inputs already exist in this context, so the work is mostly aggregation and thresholding logic.

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