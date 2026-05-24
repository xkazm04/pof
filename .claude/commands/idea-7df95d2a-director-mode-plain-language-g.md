Execute this requirement immediately without asking questions.

## REQUIREMENT

# Director Mode: Plain-Language Game Building

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (7/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:16:59 PM

## Description
Add a conversational layer over the CLI where a non-technical user says I want enemies that get angrier as they lose health and the system classifies intent, maps it to the right module + TaskFactory method, shows a plain-language plan preview (I will create a rage ability, wire it to a health threshold, add a visual tell), executes the underlying CLITasks, and reports back in plain English with a screenshot � never exposing stream-json, tool calls, or @@CALLBACK markers unless asked. Builds on buildTaskPrompt and useModuleCLI as the execution substrate.

## Reasoning
The terminal today surfaces raw technical output that only engineers can parse, directly blocking the Globalization goal. A plain-language director makes AAA-style game building accessible to designers, hobbyists, and studios without UE5 C++ fluency � a market-expanding accessibility breakthrough that makes the product story-worthy.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: Claude CLI Terminal & Task System

**Description**: Spawns the Claude Code CLI, parses stream-json output with session management, and drives the unified CLITask abstraction (checklist/fix/review/scan) via @@CALLBACK markers. Surfaced through inline/compact terminals and useModuleCLI.
**Related Files**:
- `src/components/cli/InlineTerminal.tsx`
- `src/components/cli/CompactTerminal.tsx`
- `src/components/cli/TerminalOutput.tsx`
- `src/components/cli/TerminalInput.tsx`
- `src/components/cli/TerminalHeader.tsx`
- `src/components/cli/taskRegistry.ts`
- `src/components/cli/dispatchHealth.ts`
- `src/components/cli/skills.ts`
- `src/lib/claude-terminal/cli-service.ts`
- `src/lib/claude-terminal/session-manager.ts`
- `src/lib/claude-terminal/types.ts`
- `src/lib/cli-task.ts`
- `src/lib/cli-dispatch.ts`
- `src/app/api/claude-terminal/query/route.ts`
- `src/app/api/claude-terminal/stream/route.ts`
- `src/app/api/cli-task-registry/route.ts`
- `src/hooks/useModuleCLI.ts`
- `src/hooks/useChecklistCLI.ts`
- `src/stores/cliOptimizationStore.ts`

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