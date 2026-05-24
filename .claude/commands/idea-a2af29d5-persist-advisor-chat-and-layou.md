Execute this requirement immediately without asking questions.

## REQUIREMENT

# Persist advisor chat and layout history across sessions

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:37:03 PM

## Description
Persist advisor conversations and the workspace snapshot each turn produced into the existing SQLite database instead of the in-memory chat store that caps at 200 messages and is lost on reload. A history drawer lets users resume past sessions and click any assistant turn to restore both the chat and the exact layout it composed. Link each ChatMessage to its resulting directives plus template.

## Reasoning
ChatGPT, Claude, and Cursor all persist conversations because losing context on refresh destroys trust and continuity. Tying messages to the layouts they generated turns the chat log into a time machine for the workspace, a differentiator most competitors lack.

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