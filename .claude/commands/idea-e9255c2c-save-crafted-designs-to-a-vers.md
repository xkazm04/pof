Execute this requirement immediately without asking questions.

## REQUIREMENT

# Save crafted designs to a versioned Design Library

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:31:52 PM

## Description
Crafted items in AffixCraftingWorkbench and weight configs in AILootDesigner are currently ephemeral � closing the tab loses the work. Add a Save-to-Library action that persists each design as a catalog ItemEntry in catalogStore, with named version snapshots that also capture the DropSimResult (avg power, distribution) at save time. Borrowing version history from Figma/Notion/Google Docs, designers can recall, branch, and diff how an item evolved across revisions.

## Reasoning
Every serious design tool lets users save and revisit their work; the absence here forces designers to re-craft from scratch or screenshot results. Persisting designs into the existing catalog lifecycle (planned to verified) also feeds the UE generation pipeline, turning throwaway experiments into trackable assets. High workflow value for moderate effort since catalogStore and the sim engine already exist.

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