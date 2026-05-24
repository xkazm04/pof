Execute this requirement immediately without asking questions.

## REQUIREMENT

# Bidirectional Living GDD: Design-Code Digital Twin

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:34:35 PM

## Description
Upgrade gdd-synthesizer from one-way code-to-doc generation into a two-way digital twin where editing a GDD section emits design-intent deltas that create feature-matrix rows and checklist items, while code changes push semantic diffs back into the GDD so the two never drift. The GDD becomes the single source of truth instead of a stale snapshot regenerated on demand. First sprint step: make GDDSection content editable in GameDesignDocView and, on save, emit a structured intent delta that inserts matching missing-feature rows into the feature matrix.

## Reasoning
The current GDD is a read-only mirror that goes stale the moment code changes, and compliance gaps are detected by brittle string matching after the fact. A living twin that keeps design and implementation continuously reconciled eliminates an entire class of drift work and makes the GDD a trustworthy contract teams can build a decade of relevance on.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Code Evaluation & GDD Compliance

**Description**: 3-pass module evaluation (structure/quality/performance), deep-eval engine, codebase archeologist, game-design-doc synthesizer, and GDD-compliance checking. Backed by evaluatorStore and gddComplianceStore.
**Related Files**:
- `src/components/modules/evaluator/EvaluatorModule.tsx`
- `src/components/modules/evaluator/AggregateQualityDashboard.tsx`
- `src/components/modules/evaluator/DeepEvalResults.tsx`
- `src/components/modules/evaluator/GDDComplianceView.tsx`
- `src/components/modules/evaluator/GameDesignDocView.tsx`
- `src/components/modules/evaluator/CodebaseArcheologistView.tsx`
- `src/components/modules/evaluator/DependencyGraph.tsx`
- `src/lib/evaluator/deep-eval-engine.ts`
- `src/lib/evaluator/module-eval-prompts.ts`
- `src/lib/evaluator/finding-collector.ts`
- `src/lib/evaluator/fix-plan-generator.ts`
- `src/lib/gdd-compliance.ts`
- `src/lib/gdd-synthesizer.ts`
- `src/lib/codebase-archeologist.ts`
- `src/app/api/gdd-compliance/route.ts`
- `src/app/api/game-design-doc/route.ts`
- `src/app/api/codebase-archeologist/route.ts`
- `src/stores/evaluatorStore.ts`
- `src/stores/gddComplianceStore.ts`
- `src/types/evaluator.ts`
- `src/types/gdd-compliance.ts`

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