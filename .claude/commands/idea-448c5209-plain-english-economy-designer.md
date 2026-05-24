Execute this requirement immediately without asking questions.

## REQUIREMENT

# Plain-English economy designer with AI explainer

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 5:28:11 PM

## Description
Let a designer describe intent in natural language ('players should feel rich by level 20 but always grind for legendaries'); an LLM maps it to a SimulationConfig plus flowOverrides/itemOverrides, runs the existing engine, then narrates the result and every alert in plain language with concrete suggested tweaks. Reuses the project's prompt-builder and CLI/LLM plumbing rather than new infra. First step: add an 'Explain this economy in plain English' button that serializes current defaults plus the result summary (alerts, Gini, power curve) into a structured prompt and renders the narrated answer read-only.

## Reasoning
Drop weights, Gini coefficients, and affix saturation are opaque to non-technical creators, which is exactly the audience the Globalization goal targets. Translating both input (intent to config) and output (numbers to narrative) makes economy design approachable to anyone, turning a specialist tool into a mainstream one and showcasing the app's AI-native identity.

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