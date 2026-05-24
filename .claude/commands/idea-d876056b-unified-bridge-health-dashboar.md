Execute this requirement immediately without asking questions.

## REQUIREMENT

# Unified bridge health dashboard & setup wizard

## Metadata
- **Category**: user_benefit
- **Effort**: Unknown (5/3)
- **Impact**: Unknown (7/3)
- **Scan Type**: feature_scout
- **Generated**: 5/24/2026, 12:01:32 PM

## Description
Create one dashboard that shows all three bridge channels at a glance (UE5 Remote Control on 30010, PoF Bridge plugin on 30040, WebSocket live state on 30041) with plain-language status, round-trip latency, uptime, and reconnect counts pulled from the existing connection managers. Pair it with a first-run setup wizard that auto-probes the default ports, explains in non-technical terms what each channel does, and turns raw error strings (such as a 30040 timeout) into guided next steps like start the UE5 editor and click Retry.

## Reasoning
Status pages (GitHub, Vercel) and connection onboarding wizards (Postman, TablePlus, ngrok inspector) set the expectation that connection state is centralized and self-explanatory. Today the three channels each surface their own technical error in isolation, which is opaque to anyone who is not a UE5 engineer. A unified, plain-language health view and guided setup directly serves the goal of making the app understandable to day-to-day non-technical users while reducing first-run friction.

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