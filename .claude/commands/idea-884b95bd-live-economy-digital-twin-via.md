Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live economy digital twin via telemetry round-trip

## Metadata
- **Category**: functionality
- **Effort**: Unknown (8/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:28:11 PM

## Description
Close the currently one-way codegen loop: extend codegen.ts so the generated UEconomyManager (which already tracks inflow/outflow/Gini) also emits periodic JSON economy snapshots, and add a Vibeman-side ingestion + comparison view that overlays the shipped game's real metrics against the simulation's prediction, flagging drift and offering a re-calibration. First step: add a ReportSnapshot telemetry-emitter snippet to the generated EconomyManager and a stub ingestion route that just stores incoming snapshots (no diff logic yet).

## Reasoning
A predictor that never sees reality slowly drifts from the live game. A digital twin that continuously reconciles simulated vs actual economy turns POF into a living balance dashboard for shipped titles, a capability no offline balancing spreadsheet can match and a durable moat that gets more valuable the longer a game runs.

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