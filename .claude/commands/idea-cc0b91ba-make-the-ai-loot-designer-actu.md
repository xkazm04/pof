Execute this requirement immediately without asking questions.

## REQUIREMENT

# Make the AI Loot Designer actually generative

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:24:41 PM

## Description
Today the AILootDesigner is a deterministic xorshift simulator with zero AI. Turn it into a true generative system: a designer types a brief like "a fire legendary sword family that rewards aggressive melee but punishes kiting" and Claude emits a balanced ItemDesign + affix pool + weights, which the existing drop-simulator immediately validates and generateUE5Code() ships to the engine. First sprint step: add a /api/loot/generate route that takes a natural-language brief and returns a structured AffixPoolEntry[] + ItemDesign validated against drop-simulator types, rendered in DesignerPanel.

## Reasoning
This is the one capability the product could be famous for: describe loot in plain English and get a balanced, engine-ready item family in seconds. It collapses hours of manual weight-tuning into a sentence and directly serves non-technical designers. The simulator already exists to score the output, so the AI only needs to propose candidates the existing math validates.

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