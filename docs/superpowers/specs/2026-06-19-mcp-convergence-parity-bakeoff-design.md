# MCP convergence — parity port + retirement bake-off

**Date:** 2026-06-19 · **Status:** approved · **Implements:** Phase 3 #1 of [`ue58-mcp-convergence-plan.md`](../../ue58-mcp-convergence-plan.md).

## Goal

Decide whether to **retire the bespoke `mcp-unreal` (Go) + `MCPUnreal` (C++ HTTP `:8090`) stack** in favour of UE 5.8's first-party MCP (`:8000`). The bar: `(Epic first-party + PoFToolset gap-fillers)` must match `MCPUnreal` on **coverage, correctness, quality, and ease-of-use**. Retirement is *gated on the bake-off*, not assumed.

**Reframe (locked):** parity is the *whole* `:8000` surface (Epic's 350+ tools + `PoFToolset`) vs `MCPUnreal`'s 40 — not `PoFToolset` alone. So audit Epic's coverage and port only true gaps; recreating what Epic ships is the "wasted potential" we avoid.

## Phase A — Coverage audit + port true gaps

Remaining MCPUnreal PORT candidates to adjudicate: `anim_blueprint`, `ism_ops`, `pie_control`, `player_control`, `level_ops`(streaming), `network_debug`, `fab_ops`, `get_output_log`, `run_console_command`, `procedural_mesh`/`realtime_mesh`.

1. **Static coverage audit.** Read Epic's shipped UE 5.8 toolset Python source (`<UE_5.8>/Engine/Plugins/.../Toolsets/*.py`). Per candidate, record **COVERED** (Epic ships an equivalent → drop) / **GAP** (port) / **PARTIAL** (port the missing surface). Live-confirm only the ambiguous via the official MCP's `describe_toolset`.
2. **Port the true GAPs** into `PoFToolset`, following the existing template: one `@unreal.uclass` `ToolsetDefinition` per area, `@toolset_registry.tool_call` `@staticmethod`s, registered in `toolsets/__init__.py`'s `Registration([...])`. Pure Python; escalate to C++ only if a verb isn't Python-exposed.
3. **Live-verify** each ported tool autonomously (headless 5.8 launch → register → `call_tool` via the official MCP → confirm the real effect/return). No tool is "done" without that observation.
4. Update `ue58-mcp-phase2-tool-map.md` with the audit verdicts + `PoFToolset`'s final tool list; commit. Add an audit summary under `docs/concepts/UE/`.

## Phase B — Bake-off + retirement verdict (after A)

1. **Coverage-parity map:** all 40 MCPUnreal tools → (Epic | PoFToolset | gap). Prove zero residual gaps (or list them).
2. **Live spot-checks:** a representative subset run through *both* surfaces — a DROP-covered op (e.g. spawn / modify a blueprint), a moat gap-filler (`capture_viewport` / `gas` mutate), and a discovery/ease task — driven via the in-session `mcp-unreal` tools (`:8090`) and the Node MCP client (`:8000`).
3. **Rubric** (per task × surface): **Correctness** (right artifact, verified via the `:30040` bridge / observation), **Quality** (output completeness/usability), **Ease** (discovery + invocation friction — Epic's tool-search vs MCPUnreal's flat 40).
4. **Verdict doc:** `:8000` matches at equal-or-better quality/ease → recommend retiring `MCPUnreal` + the Go proc (+ standardize remaining 5.7 refs on 5.8); residual gaps → keep until closed.

## Constraints / notes

- Live audit-confirm + tool verification + the bake-off need the **5.8 editor up with both stacks**: `MCPUnreal` (`:8090`, auto-starts) and the official MCP (`:8000`, needs the ModelContextProtocol/ToolsetRegistry plugins + `PoFToolset` registered + `StartServer`; restart-to-register).
- Driving: `:8090` via in-session `mcp-unreal` tools; `:8000` via the Node MCP StreamableHTTP client proven in the Phase-0 capstone.
- The static audit is read-based (no editor needed) — it's how the original tool map was built; the editor is for verifying ported tools + the bake-off.

## Non-goals

- No porting of DROP-covered tools (use Epic first-party on migration).
- No change to the `:30040` verification moat (`test-gate-runner`, L3/L4) — Phase 3 #3 keeps it.
- The actual deletion of the Go+C++ stack is a *follow-up* gated on the Phase B verdict, not part of this spec.
