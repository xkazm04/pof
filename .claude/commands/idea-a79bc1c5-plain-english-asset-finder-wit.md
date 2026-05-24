Execute this requirement immediately without asking questions.

## REQUIREMENT

# Plain-English asset finder with verified wiring

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:11:22 PM

## Description
Recommendations today come from feature-matrix gaps and the opaque featureToTags keyword matcher in recommendation-engine.ts — unreadable to a non-technical creator. Add a natural-language front door to AssetScoutView ("I want enemies that flank and dodge the player") that an LLM maps to the existing keyword set and module category, runs the current recommendation engine, then explains the recommended asset and its integration steps in plain language. First step: add a single NL input box that calls an LLM to translate one sentence into featureToTags keywords + an AssetCategory, then feeds the existing generateRecommendations path.

## Reasoning
This directly serves the Globalization goal — making the app understandable to day-to-day non-technical users — by removing the requirement to think in GAS/module/tag jargon. It turns asset discovery into a conversation, dramatically widening who can use POF, while reusing the entire scoring engine that already exists.

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