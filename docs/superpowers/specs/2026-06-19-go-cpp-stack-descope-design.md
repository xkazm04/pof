# Go+C++ MCP stack descope (config-level)

**Date:** 2026-06-19 · **Status:** approved · **Implements:** the retirement path from [`concepts/UE/mcp-bakeoff-verdict.md`](../../concepts/UE/mcp-bakeoff-verdict.md) (Phase 3 #1 verdict) + the Phase 3 #2 `:8000` flip.

## Decision

**Descope the bespoke Go `mcp-unreal` + `MCPUnreal` C++ stack at the repo/config level now; defer the `anim_blueprint` C++ re-home (paper blocker); leave the destructive physical deletion as a documented manual step.** Approved depth: *config descope + defer C++* (not a full physical removal, not a speculative C++ build).

**Why defer the C++ re-home:** the bake-off's "one blocker" (`anim_blueprint`) is largely paper — `anim_blueprint_query` on `ABP_VSPlayer` returned **0 state machines** (PoF's ABPs are blendspace-driven; ABP edits were done via Python/editor, not this tool). Re-homing 328 lines of editor-only AnimGraph C++ into a new C++ module on a content-only plugin, for a capability PoF doesn't exercise, is the "wasted potential" we avoid. Build it **only if** a real AnimBP-state-machine need arises.

## Scope of "the stack"

- **Go `mcp-unreal`** proc + binary — `~/mcp-unreal-staging/` (external to the repo).
- **`MCPUnreal`** C++ HTTP plugin (`:8090`, 22 routes) — in the *UE project* `Plugins/` (external to the repo; shared with the concurrent session).
- **Repo references:** `.mcp.json` (the `mcp-unreal` stdio entry), `src/lib/claude-terminal/mcp-config.ts` (docstring only — the resolver mechanism is config-agnostic), docs.

## Changes (this session — all repo-level, non-destructive, reversible)

1. **`.mcp.json`:** remove the `mcp-unreal` stdio server. Keep `pof-mcp` (the always-up app-API server). Add `unreal-official` — an HTTP entry for the official MCP at `http://127.0.0.1:8000/mcp` (the Phase 3 #2 in-app flip). **Note:** `:8000` is reachable only when a 5.8 editor is up with `ModelContextProtocol.StartServer`; a failed connect is a non-fatal warning, so the always-available autonomous surface is `pof-mcp` + (when an editor is up) `:8000`.
2. **`mcp-config.ts`:** update the docstring (it no longer "declares mcp-unreal"). No behavior change — the resolver just passes whatever config `POF_CLI_MCP_CONFIG` points at.
3. **Docs:** a decommission note in [`concepts/UE/`](../../concepts/UE/) with the **manual physical-removal steps** (delete the `MCPUnreal` UE plugin + the Go binary — destructive, do when ready) and the **deferred** `anim_blueprint` re-home; update the convergence plan Phase 3 (#1 retirement started, #2 flipped) + the followups.

## Explicitly NOT done (deferred / manual, by the approved decision)

- **No C++ `anim_blueprint` toolset** built (deferred-unless-needed).
- **No physical deletion** of the `MCPUnreal` UE plugin or the Go binary — they're outside the repo and the UE project is shared; deletion is a documented manual step for the user.

## Verification

- `.mcp.json` stays valid JSON (the autonomous spawns + this session load it).
- `npm run typecheck`/`lint` unaffected (`mcp-config.ts` is a docstring-only change).
- No live UE needed — the `:8000` flip target was already live-proven in the bake-off (`get_current_level → VerticalSlice` via the official MCP). The descope is config-level.

## Non-goals

- The `:30040` verification moat (`test-gate-runner`, L3/L4) is untouched (Phase 3 #3 — keep).
- `pof-mcp` (the app-API stdio server) is unaffected — it's not part of the bespoke UE control stack.
