Execute this requirement immediately without asking questions.

## REQUIREMENT

# One-click fixes for Asset-Code Oracle violations

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:23:08 PM

## Description
Today the Oracle reports violations with a text-only suggestion. Borrow the ESLint --fix / SonarQube quick-fix / Dependabot-PR pattern: add an action per violation that dispatches the fix through the existing CLI task system (TaskFactory/useModuleCLI) — generate a C++ parent class for orphaned Blueprints, create a BP_ stub for missing assets, rename to convention for naming mismatches. Track each fix so the violation clears on the next scan.

## Reasoning
Detection without remediation forces manual translation of every suggestion into work; best-in-class code-quality tools close that loop with actionable fixes. Wiring violations into the existing task system turns the Oracle from a report into a workflow, sharply raising its value.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Asset Marketplace & Pattern Catalog

**Description**: Marketplace asset catalog with recommendation engine and integration-code generator, plus the asset-code oracle that maps catalog assets to UE5 wiring code. Backed by marketplaceStore.
**Related Files**:
- `src/lib/marketplace/asset-catalog.ts`
- `src/lib/marketplace/recommendation-engine.ts`
- `src/lib/marketplace/integration-generator.ts`
- `src/lib/catalog/seed-spellbook.ts`
- `src/lib/asset-code-oracle.ts`
- `src/components/catalog/LifecycleBadge.tsx`
- `src/app/api/marketplace/route.ts`
- `src/app/api/asset-code-oracle/route.ts`
- `src/stores/marketplaceStore.ts`
- `src/types/marketplace.ts`
- `src/components/modules/evaluator/AssetScoutView.tsx`
- `src/components/modules/evaluator/AssetCodeOracleView.tsx`

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