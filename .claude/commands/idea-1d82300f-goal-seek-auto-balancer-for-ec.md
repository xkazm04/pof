Execute this requirement immediately without asking questions.

## REQUIREMENT

# Goal-seek auto-balancer for economy targets

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 4:35:08 PM

## Description
Let the designer set a target (net flow near 0 at level 15, Gini under 0.5, or clear all critical alerts) and run a grid/gradient search over selected faucet/sink/drop parameters to propose values that hit it. Present the result as an applyable diff that populates flowOverrides, reusing the existing alert engine as the scoring function.

## Reasoning
The simulator already detects imbalances via its alert system but leaves the fix to manual trial-and-error. Turning detection into one-click suggested fixes (the Excel Solver / Goal Seek pattern) is the natural next evolution and a major time-saver for live-ops tuning.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Item Economy & Balance Simulation

**Description**: Item-economy simulator: models drop rates, currency sinks/faucets, and rarity stacking; generates economy-tuning C++ and surfaces affix alerts. Backed by economy-simulator API and economySimulatorStore.
**Related Files**:
- `src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/index.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/RarityStackChart.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/AffixHeatmap.tsx`
- `src/components/modules/core-engine/unique-tabs/ItemEconomySimulator/AffixAlertsTabs.tsx`
- `src/components/modules/core-engine/dzin-panels/ItemEconomyPanel.tsx`
- `src/lib/economy/item-economy-engine.ts`
- `src/lib/economy/simulation-engine.ts`
- `src/lib/economy/codegen.ts`
- `src/lib/economy/definitions.ts`
- `src/app/api/economy-simulator/route.ts`
- `src/stores/economySimulatorStore.ts`
- `src/types/economy-simulator.ts`
- `src/components/modules/evaluator/EconomySimulatorView.tsx`
- `src/components/modules/evaluator/EconomyCodeGenPanel.tsx`

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