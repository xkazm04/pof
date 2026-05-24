Execute this requirement immediately without asking questions.

## REQUIREMENT

# Syntax-highlighted adapter code with copy/download actions

## Metadata
- **Category**: ui
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 3:47:09 PM

## Description
IntegrationCard's code preview (line 637-639) renders generated Adapter.h/.cpp inside a flat <pre> with monospaced text and zero highlighting � for non-trivial C++ snippets this is a wall of unreadable text. Integrate Shiki (lightweight, SSR-friendly) with a UE5/C++ grammar, add line numbers in a gutter, and a sticky toolbar with 'Copy' (with checkmark confirmation toast) and 'Download .h/.cpp' icon-buttons. Show language badge in top-right corner. Wrap in max-h-96 with subtle scroll fade-out.

## Reasoning
The whole point of the integration generator is to produce code the user will paste into their UE5 project � yet the current preview makes it harder to read than a plain editor window. Syntax highlighting transforms 'wall of text' into scannable structure, and one-click copy removes the manual selection friction. This is the moment the user decides 'this tool is professional grade' vs 'this is a demo'.

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