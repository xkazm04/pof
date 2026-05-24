Execute this requirement immediately without asking questions.

## REQUIREMENT

# Self-driving economy auto-balancer (target-seeking)

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:28:11 PM

## Description
Add an optimization loop on top of runItemEconomySim/runSimulation that searches the faucet, sink, drop-rate and affix-weight space to hit designer-set targets (a chosen power-curve shape, a Gini band, net-flow approximately zero, rarity inflation under a cap). It runs thousands of seeded simulations via the existing mulberry32 RNG, scores each against a fitness function, and returns the optimal calibrated config plus its generated UE5 code. First step: define a BalanceTarget type and a scalar fitness(result, target) distance metric in src/lib/economy/, then wire a single random-restart hill-climb over the faucet/sink philosophy multipliers behind a 'Find balance for me' action.

## Reasoning
Today designers hand-tune numbers and re-run to see what breaks; the tool is a microscope, not a solver. An auto-balancer turns balancing a months-long iterative craft into a one-click optimization, making POF the only UE5 assistant that ships a calibrated economy you can trust. It compounds because every new alert rule becomes a new optimization constraint.

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