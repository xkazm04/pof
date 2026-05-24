Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live progress feedback for long streaming CLI runs

## Metadata
- **Category**: ui
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: ui_perfectionist
- **Generated**: 5/24/2026, 11:47:33 AM

## Description
The streaming state is just a static "Working..." spinner (TerminalOutput.tsx:751) even though the subsystem explicitly handles 40-minute runs with a 15-min stuck threshold (dispatchHealth.ts). Surface liveness: an elapsed-time counter in the status bar (mm:ss, refreshing each second), a "last action" line echoing the current tool (e.g. "Editing PlayerCharacter.cpp"), a subtle animate-pulse-glow activity dot, and a blinking caret on the latest assistant token. Drive it from useTaskQueue state already available (executionInfo + latest tool_use log).

## Reasoning
Silence during multi-minute runs reads as a hang and creates anxiety; users abort healthy tasks. Continuous, honest motion makes the system feel alive and in control, and pre-empts the very stuck-state the code already tracks internally but never shows the user.

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