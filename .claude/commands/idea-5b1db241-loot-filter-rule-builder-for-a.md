Execute this requirement immediately without asking questions.

## REQUIREMENT

# Loot Filter Rule Builder for ARPG item filtering

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:31:46 PM

## Description
Add a visual rule editor (alongside LootTableVisualizer) where designers stack show/hide/highlight rules matched on rarity, affix tag, axis, and item level � the same mechanic that made Path of Exile and Last Epoch loot filters legendary. Each rule set compiles to a UE5 loot-filter data asset (or a UARPGItemInstance predicate) and ships through the existing ue5-inject-item bridge so filters can be hot-tested in a live PIE session. Reuse the rarity tiers and affix pool already defined in drop-simulator.ts and the workbench data.

## Reasoning
A configurable loot filter is the single most beloved table-stakes feature of modern ARPGs, yet this toolkit can author loot tables but offers no way to design the on-screen filtering players actually experience. Delivering it makes the suite competitive with FilterBlade/NeverSink-style tooling and closes an obvious gap designers will expect. The drop-simulator and rarity model already exist, so most of the data layer is reusable.

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