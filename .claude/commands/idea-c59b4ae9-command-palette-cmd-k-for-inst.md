Execute this requirement immediately without asking questions.

## REQUIREMENT

# Command palette (Cmd-K) for instant intent dispatch

## Metadata
- **Category**: functionality
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:36:56 PM

## Description
Add a Cmd-K fuzzy command palette that dispatches compose, navigate, and manipulate intents straight through the existing IntentBus and Director. Known actions (open panel, set-layout, focus, set-density) resolve on the local fast path, bypassing the Gemini round-trip that NEEDS_LLM triggers. Surface the advisor composition patterns such as debug effects and tune balance as first-class parameterized commands with a recents list.

## Reasoning
Linear, VS Code, Raycast, and Superhuman all made Cmd-K the primary navigation surface because it is faster than the mouse and far more discoverable than chat. The IntentBus already classifies intents into local versus LLM, so a palette is mostly a thin UI over infrastructure that already exists, giving high impact for moderate effort.

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