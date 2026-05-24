Execute this requirement immediately without asking questions.

## REQUIREMENT

# Balance Audit linter for loot & affix designs

## Metadata
- **Category**: functionality
- **Effort**: Unknown (4/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:32:07 PM

## Description
Add a one-click Balance Audit that runs the existing drop simulation and surfaces actionable warnings: dead affixes that never roll (frequency 0), power outliers far outside the rarity budget, axis coverage gaps, and rarities that effectively never drop. Present findings as a Lighthouse/ESLint-style checklist with severity badges and quick-fix buttons (e.g. "bump weight", "raise min rarity") that mutate the affix pool in place.

## Reasoning
Linters and audit panels (ESLint, Lighthouse, accessibility checkers) are proven to catch costly mistakes before they ship � here they prevent designers from releasing loot tables with unreachable or wildly unbalanced items. The drop-simulator already computes frequency, power histograms, and axis coverage, so the analysis layer is nearly free; the value is in turning that data into prescriptive guidance.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Loot Tables & Item Catalog

**Description**: Loot table visualizer with drop simulation, item catalog, AI loot designer, affix-crafting workbench, and inventory/equipment dzin panels. Injects generated items into the UE5 project.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/index.tsx`
- `src/components/modules/core-engine/unique-tabs/LootTableVisualizer/metrics/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemCatalog/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AILootDesigner/index.tsx`
- `src/components/modules/core-engine/unique-tabs/AILootDesigner/DesignerPanel.tsx`
- `src/components/modules/core-engine/unique-tabs/AffixCraftingWorkbench/index.tsx`
- `src/components/modules/core-engine/unique-tabs/affix-workbench/AffixExportPanel.tsx`
- `src/components/modules/core-engine/unique-tabs/affix-workbench/SynergyDetector.tsx`
- `src/components/modules/core-engine/dzin-panels/LootTablePanel.tsx`
- `src/components/modules/core-engine/dzin-panels/LootAffixPanel.tsx`
- `src/components/modules/core-engine/dzin-panels/InventoryCatalogPanel.tsx`
- `src/components/modules/core-engine/dzin-panels/InventoryEquipmentPanel.tsx`
- `src/lib/loot-designer/drop-simulator.ts`
- `src/lib/catalog/seed-spellbook.ts`
- `src/lib/catalog/types.ts`
- `src/lib/prompts/inventory.ts`
- `src/app/api/ue5-inject-item/route.ts`
- `src/stores/catalogStore.ts`

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