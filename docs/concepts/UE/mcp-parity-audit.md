# MCP convergence — coverage audit (Phase 3 #1, Phase A)

**Date:** 2026-06-19 · **Method:** static read of Epic's shipped UE 5.8 toolset source (`<UE_5.8>/Engine/Plugins/Experimental/Toolsets/*`) + a live registration/round-trip check for the ported gap. Adjudicates the remaining `MCPUnreal` PORT candidates from [`../../ue58-mcp-phase2-tool-map.md`](../../ue58-mcp-phase2-tool-map.md): does Epic 5.8 ship an equivalent, so we drop it — or is it a true gap to port? **Verify-then-port** (don't recreate what Epic ships).

## Verdicts

| Candidate | Verdict | Decision | Evidence / rationale |
|---|---|---|---|
| `pie_control` | **COVERED** | drop | `EditorToolset.EditorAppToolset`: `StartPIE`/`StopPIE`/`IsPIERunning` (C++ AICallable, with `FPIESessionOptions`). |
| `get_output_log` (filtered) | **COVERED** | drop | `EditorToolset.LogsToolset`: `GetLogEntries`(Category+regex Pattern+Max)/`GetLogCategories`/`Get/SetVerbosity`. |
| `run_console_command` | already covered | — | Already ported in `PoFWorldTools.run_console_command` (Epic's `execute_tool_script` is heavier; ours is a direct `exec`). |
| `player_control` (editor) | already covered | — | `PoFWorldTools.teleport_actor` covers editor-actor teleport. Epic also has `EditorAppToolset.Set/GetCameraTransform`. |
| **`ism_ops`** | **GAP** | **✅ PORTED** | Epic ships no per-instance ISM management. New `PoFInstancedMeshTools` (add/count/update/remove instance) — **verified live** (registration + full tool round-trip: add→count=2, remove→count=1). |
| `anim_blueprint` | **GAP — C++-bound** | residual (see below) | No first-party AnimBP state-machine graph edit/read (Epic anim tooling = Sequencer/ControlRig/keyframing). **Not a clean Python re-home** — AnimGraph/state-machine editing is C++/editor-only; re-homing needs a **C++ AICallable toolset**, not a Python toolset. PoF locomotion uses it → the one genuine retire blocker. |
| `network_debug` | GAP | residual (runtime-only) | Replication state only exists in a running networked game (PIE/`-game`). Like `build`/`cook`, **not an editor-MCP capability** — out of scope for the `:8000`/`:8090` editor comparison. |
| `player_control` (in-game) | PARTIAL | residual (runtime-only) | Possess/SetViewTarget/teleport the *player pawn* is a PIE/`-game` concept; the editor MCP has no player. Editor-actor teleport already covered. |
| `procedural_mesh` / `realtime_mesh` | GAP | residual (low value) | Array-built runtime mesh; PoF's pipelines use asset/imported meshes (Blender→import), not runtime array meshes. Porting unused capability = the "wasted potential" to avoid. |
| `fab_ops` | GAP | residual (low value) | Marketplace query/install; not used in PoF's autonomous loop, and a heavy editor-plugin surface. |
| `level_ops` (streaming) | PARTIAL | residual (low value) | Epic `SceneTools.load_level` + level-instance editing cover PoF's needs; per-instance streaming unload is unused. |

## Net result

`PoFToolset` is now **10 tools / 9 toolsets** (added `PoFInstancedMeshTools`). For **PoF's editor-MCP needs**, the `:8000` surface (Epic first-party + `PoFToolset`) reaches functional parity with `MCPUnreal` — **except one item**:

- **`anim_blueprint` is the single genuine, PoF-used gap that does not cleanly re-home** (it's C++-bound). Retiring `MCPUnreal` requires either re-implementing its `anim_blueprint` as a **C++ AICallable toolset** or keeping that one `MCPUnreal` tool.

Everything else is either **COVERED by Epic** (drop), **already ported**, **runtime-only** (network/in-game player — not editor-MCP, like build/cook), or **unused by PoF** (procedural mesh / fab / streaming — deliberately not ported).

→ This is the key input to the **Phase B bake-off + retirement verdict**.
