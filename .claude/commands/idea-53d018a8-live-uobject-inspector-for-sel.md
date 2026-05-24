Execute this requirement immediately without asking questions.

## REQUIREMENT

# Live UObject Inspector for selected actors

## Metadata
- **Category**: functionality
- **Effort**: Unknown (6/3)
- **Impact**: Unknown (8/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:01:07 PM

## Description
Add a web-based property inspector that mirrors UE5's Details panel: when the editor selection changes (the WebSocket already emits event.selection with SelectedActor[]), call RemoteControlClient.describeObject to enumerate the actor's exposed properties and render an editable tree. Inline edits write back via setProperty (HTTP or WS set.property), and any property can be pinned to a live watch using the existing watchProperty plumbing. This stitches together three capabilities that already exist in isolation (live selection, describeObject, property watch/set) into one cohesive panel.

## Reasoning
Inspecting and tweaking a UObject today requires alt-tabbing back to the engine; every successful live-tooling product (Chrome DevTools Elements, React DevTools, UE's own Details panel) makes the selected entity directly inspectable and editable. All the transport already exists — only the UI that unifies it is missing — so this is high value at moderate effort and turns the bridge from a plumbing layer into a usable workspace.

## Context

**Note**: This section provides supporting architectural documentation and is NOT a hard requirement. Use it as guidance to understand existing code structure and maintain consistency.

### Context: UE5 / PoF Bridge & Live Sync

**Description**: Bidirectional bridge to the running UE5 editor: remote-control client, WebSocket live-state sync, hot-patch compile, manifest/snapshot, and C++ source parsing for verification. Backed by pofBridgeStore and ue5BridgeStore.
**Related Files**:
- `src/lib/pof-bridge/client.ts`
- `src/lib/pof-bridge/connection-manager.ts`
- `src/lib/pof-bridge/verification-engine.ts`
- `src/lib/pof-bridge/verification-rules.ts`
- `src/lib/ue5-bridge/connection-manager.ts`
- `src/lib/ue5-bridge/remote-control-client.ts`
- `src/lib/ue5-bridge/ws-live-state.ts`
- `src/lib/cpp-semantic-parser.ts`
- `src/lib/ue5-source-parser.ts`
- `src/app/api/pof-bridge/compile/route.ts`
- `src/app/api/pof-bridge/manifest/route.ts`
- `src/app/api/pof-bridge/status/route.ts`
- `src/app/api/ue5-bridge/build/route.ts`
- `src/app/api/ue5-bridge/query/route.ts`
- `src/app/api/ue5-source/parse/route.ts`
- `src/hooks/usePofBridge.ts`
- `src/hooks/useUE5Connection.ts`
- `src/hooks/useLiveStateSync.ts`
- `src/hooks/useLiveCoding.ts`
- `src/stores/pofBridgeStore.ts`
- `src/stores/ue5BridgeStore.ts`
- `src/types/pof-bridge.ts`
- `src/types/ue5-bridge.ts`

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