Execute this requirement immediately without asking questions.

## REQUIREMENT

# Anticipatory Co-Pilot That Dispatches the Next Task

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:17:07 PM

## Description
Build an ambient co-pilot that continuously reads project scan state, the feature-definitions dependency graph, and recordSessionOutcome history to predict the single highest-value next CLITask, then offers it for one-tap (eventually voice) dispatch: You wired the combat ability but have no animation montage � scaffold it? It reuses the existing NBA signals and useModuleCLI dispatch path, adding a proactive suggestion engine that surfaces work before the user thinks to ask.

## Reasoning
Users must currently know which checklist item or quick action comes next, demanding domain expertise and constant context-switching. A system that anticipates the next move turns PoF from a tool you operate into a partner that drives momentum � the kind of magical, predictive experience that earns word-of-mouth.

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