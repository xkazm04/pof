Execute this requirement immediately without asking questions.

## REQUIREMENT

# Build Swarm: Parallel Multi-Agent Task DAG Orchestrator

## Metadata
- **Category**: functionality
- **Effort**: Unknown (9/3)
- **Impact**: Unknown (9/3)
- **Scan Type**: moonshot_architect
- **Generated**: 5/24/2026, 6:16:56 PM

## Description
Evolve the single-running-task model into a dependency-aware swarm. Decompose a high-level goal (e.g. build a souls-like boss fight) into a DAG of CLITasks using feature-definitions cross-module dependencies, dispatch independent branches across multiple concurrent Claude CLI processes, and reconcile their UE asset/callback outputs with conflict detection on the shared project tree. The TaskFactory, callback registry, and feature dependency graph already exist � this adds a scheduler and a parallel-safe write protocol on top.

## Reasoning
The taskRegistry currently serializes work to one task per session, leaving the assistant a single craftsman rather than a studio. Parallel orchestration eliminates whole classes of waiting and turns PoF into an autonomous game-production pipeline, a 10x leap in throughput that would define the category.

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