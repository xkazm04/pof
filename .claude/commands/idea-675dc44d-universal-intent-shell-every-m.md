Execute this requirement immediately without asking questions.

## REQUIREMENT

# Universal Intent Shell: every module driveable by voice

## Metadata
- **Category**: functionality
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:20:11 PM

## Description
Today the advisor in advisorTools.ts hardcodes a 10-entry ARPG-combat panel enum and a combat-only system instruction, while the DZIN engine itself (resolver, Hungarian assignment, intent bus) is fully domain-agnostic. Auto-generate the advisor tool enum, panel descriptions, and composition patterns directly from pofRegistry so EVERY PoF module (animations, audio, materials, loot, level-design) becomes composable by natural language and voice. DZIN stops being a combat demo and becomes the single adaptive shell for the entire product.

## Reasoning
This converts a narrow combat prototype into the products defining interaction model: describe any task and the right cross-module workspace assembles itself. It is the highest-leverage unlock because the hard parts (layout solver, intent routing, voice) already exist and only the registry-to-LLM contract is hardcoded.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: DZIN Adaptive UI Engine

**Description**: Intent-driven adaptive layout engine: intent bus/director/queue with compose/navigate/manipulate handlers, Hungarian-assignment layout resolver, chat store, and the LLM advisor client + voice. Powers the dynamic panel composition.
**Related Files**:
- `src/lib/dzin/core/index.ts`
- `src/lib/dzin/core/intent/director.ts`
- `src/lib/dzin/core/intent/bus.ts`
- `src/lib/dzin/core/intent/queue.ts`
- `src/lib/dzin/core/intent/handlers/compose.ts`
- `src/lib/dzin/core/intent/handlers/navigate.ts`
- `src/lib/dzin/core/intent/handlers/manipulate.ts`
- `src/lib/dzin/core/layout/resolver.ts`
- `src/lib/dzin/core/layout/assignment.ts`
- `src/lib/dzin/core/layout/hungarian.ts`
- `src/lib/dzin/core/layout/scoring.ts`
- `src/lib/dzin/core/layout/useLayout.ts`
- `src/lib/dzin/core/chat/store.ts`
- `src/lib/dzin/core/llm/transport.ts`
- `src/lib/dzin/core/llm/serializer.ts`
- `src/lib/dzin/advisor/AdvisorClient.ts`
- `src/lib/dzin/advisor/advisorTools.ts`
- `src/app/api/agents/advisor/route.ts`
- `src/app/api/agents/live-token/route.ts`
- `src/hooks/useIntentDispatch.ts`
- `src/hooks/useAdvisorVoice.ts`

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