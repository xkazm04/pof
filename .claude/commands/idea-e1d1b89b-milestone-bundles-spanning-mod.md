Execute this requirement immediately without asking questions.

## REQUIREMENT

# Milestone bundles spanning modules (Vertical Slice)

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:48:07 PM

## Description
Features currently roll up only to their own module, so there is no concept of a cross-cutting goal like Playable Vertical Slice or Combat Demo that bundles specific features from character, GAS, animation, and combat. Add named milestones that reference feature keys (moduleId::featureName) across modules and show a single progress bar plus a list of remaining blockers per milestone. Store definitions in a new table alongside feature_matrix and reuse the existing status map for progress.

## Reasoning
Linear Projects, Jira Versions/Epics, and Aha! releases all prove that milestone bundles are how people reason about shippable increments rather than scattered features. For a non-technical owner this reframes progress around meaningful goals (a demo they can play) instead of module internals, supporting the Globalization goal. It builds cleanly on the existing feature-key and status-map infrastructure.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Feature Matrix & Next-Best-Action

**Description**: Cross-module feature dependency matrix, overlap detection, batch review, and the NBA (Next Best Action) engine that recommends what to build next. Backed by feature-matrix DB and feature-definitions graph.
**Related Files**:
- `src/components/modules/core-engine/FeatureMatrix.tsx`
- `src/components/modules/shared/RecommendedNextBanner.tsx`
- `src/components/modules/evaluator/CrossModuleFeatureDashboard.tsx`
- `src/components/modules/evaluator/CrossModuleOverlapPanel.tsx`
- `src/components/modules/evaluator/BatchReviewPanel.tsx`
- `src/lib/feature-matrix-db.ts`
- `src/lib/feature-definitions.ts`
- `src/lib/nba-engine.ts`
- `src/lib/overlap-detection.ts`
- `src/hooks/useFeatureMatrix.ts`
- `src/hooks/useNBA.ts`
- `src/app/api/feature-matrix/route.ts`
- `src/app/api/feature-matrix/aggregate/route.ts`
- `src/app/api/feature-matrix/batch-review/route.ts`
- `src/app/api/feature-matrix/overlap/route.ts`
- `src/app/api/feature-matrix/progress/route.ts`
- `src/app/api/feature-matrix/history/route.ts`
- `src/types/feature-matrix.ts`

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