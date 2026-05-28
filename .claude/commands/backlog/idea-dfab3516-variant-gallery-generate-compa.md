Execute this requirement immediately without asking questions.

## REQUIREMENT

# Variant gallery: generate, compare, select

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/26/2026, 8:13:13 PM

## Description
Build the Gallery2D shared component that CLAUDE.md's Shared Component Manifest already earmarks: Produce generates N candidates, shows them in a selectable grid, and records the chosen one - the candidate-grid pattern from Midjourney, Scenario.gg, and ComfyUI. It would power the currently-stubbed gallery view kind in ArchetypeStep and the Icon 2D / 3D Generation / Material steps whose specs only store selected:0 today, wiring into the existing Leonardo generation integration. Push past Midjourney by tying selection straight to the UE asset path and offering 'regenerate variations of this candidate'.

## Reasoning
Visual steps are the heart of game-content creation, yet the gallery view is a placeholder that just prints a candidate count, so users cannot actually compare or pick. A real generate-compare-select gallery is table stakes for any AI asset tool and unblocks the most-used steps in the Items reference pipeline.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Layout Lab & Pipeline Steps

**Description**: The /layout reference workspace and StepSpec pipeline UI: the Category->Catalog->Entity tree, the Items pipeline (concept->art->attributes->economy->gate->integration), the archetype step renderer, and the server-backed lab artifact cache. The canonical View/Produce/Acceptance implementation.
**Related Files**:
- `src/components/layout-lab/LayoutLab.tsx`
- `src/components/layout-lab/NewHome.tsx`
- `src/components/layout-lab/Baseline.tsx`
- `src/components/layout-lab/CatalogTree.tsx`
- `src/components/layout-lab/labPipelineStore.ts`
- `src/components/layout-lab/labAcceptance.ts`
- `src/components/layout-lab/labArtifactClient.ts`
- `src/components/layout-lab/labPipelines.ts`
- `src/components/layout-lab/useLabCatalogData.ts`
- `src/components/layout-lab/LabBridgeStrip.tsx`
- `src/components/layout-lab/PipelineRollup.tsx`
- `src/components/layout-lab/steps/StepFrame.tsx`
- `src/components/layout-lab/steps/ArchetypeStep.tsx`
- `src/components/layout-lab/steps/index.ts`
- `src/components/layout-lab/steps/itemsSteps.ts`
- `src/components/layout-lab/steps/shared/CliProduce.tsx`

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