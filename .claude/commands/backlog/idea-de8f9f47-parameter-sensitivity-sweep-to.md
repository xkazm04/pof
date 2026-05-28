Execute this requirement immediately without asking questions.

## REQUIREMENT

# Parameter sensitivity sweep (tornado chart)

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/26/2026, 8:14:55 PM

## Description
Add a sweep mode that re-runs the deterministic engine while varying one faucet/sink/item parameter at a time across a +/- range (e.g. each DEFAULT_FAUCETS baseAmount +/-50%), then ranks parameters by how much they move a chosen output like endgame Gini, net flow, or critical-alert count. Render the result as a tornado chart so designers instantly see the few levers that dominate the economy. The seeded createRNG already guarantees each sweep point is reproducible, so deltas are pure signal, not noise.

## Reasoning
Sensitivity analysis (tornado charts, Excel data-tables, Monte-Carlo sweeps) is the standard way modeling tools turn a descriptive simulator into a prescriptive one - it answers which knob to turn instead of just what happened. For a designer drowning in dozens of faucets and sinks, ranking the 2-3 parameters that actually drive inflation is enormous time savings and directly improves tuning quality.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Economy & Balance Simulation

**Description**: Model the game economy and balance baselines: currency/item-economy engines, an economy simulator with code generation, and threat-score/bestiary guardrails persisted as balance baselines. Spans economy/balance libs, the economy-simulator store, and the balance-baseline API.
**Related Files**:
- `src/lib/economy/simulation-engine.ts`
- `src/lib/economy/item-economy-engine.ts`
- `src/lib/economy/codegen.ts`
- `src/lib/economy/definitions.ts`
- `src/lib/balance/baseline.ts`
- `src/lib/balance/baseline-db.ts`
- `src/lib/balance/bestiary-guardrails.ts`
- `src/lib/balance/threat-score.ts`
- `src/stores/economySimulatorStore.ts`
- `src/types/economy-simulator.ts`
- `src/app/api/economy-simulator/route.ts`
- `src/app/api/balance-baseline/route.ts`
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