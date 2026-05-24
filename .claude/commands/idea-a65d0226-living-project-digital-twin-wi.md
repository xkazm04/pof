Execute this requirement immediately without asking questions.

## REQUIREMENT

# Living project digital twin with impact prediction

## Metadata
- **Category**: ui
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:11:22 PM

## Description
The asset-code oracle already builds a class<->asset dependency graph (nodes + edges) but only on a manual "Run Analysis." Promote it to an always-on, persisted digital twin of the project that updates as you work and answers "what breaks if I rename or delete this?" by visualizing the impact radius across the graph before you act. First step: persist the oracle dependency graph and add a BFS impact-radius query to DependencyExplorer so selecting a node highlights every downstream asset/class a deletion or rename would break.

## Reasoning
A live, queryable model of every relationship in the project turns the oracle from an after-the-fact linter into a predictive safety net that prevents broken references before they happen — the kind of "magical" capability that makes a tool indispensable. The dependency graph data already exists; this elevates it from a static report into a continuously valuable visualization.

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