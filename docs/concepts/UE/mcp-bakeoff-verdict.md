# MCP retirement bake-off — verdict (Phase 3 #1, Phase B)

**Date:** 2026-06-19 · **Question:** should we retire the bespoke `mcp-unreal` (Go) + `MCPUnreal` (C++ HTTP `:8090`) stack in favour of UE 5.8's first-party MCP (`:8000`, Epic toolsets + `PoFToolset`)? · **Method:** coverage-parity map + live spot-checks of *both* surfaces from one 5.8 editor.

## Verdict

**RETIRE `MCPUnreal` + the Go proc — gated on one item: re-home `anim_blueprint` as a C++ AICallable toolset (or keep that single tool).** Everything else `MCPUnreal` does is covered by Epic first-party, already ported to `PoFToolset`, out of editor-MCP scope (headless build/cook, runtime/PIE), or unused by PoF. The converged `:8000` surface is **live-proven** and structurally easier to use at scale.

## Live evidence (both surfaces, one 5.8 editor, 2026-06-19)

One headless `UnrealEditor-Cmd` (`-RenderOffScreen` + `ModelContextProtocol.StartServer`) served **both** ports:

| Surface | Check | Result |
|---|---|---|
| `:8000` official | meta-tools | `list_toolsets, describe_toolset, call_tool` (tool-search) |
| `:8000` official | `list_toolsets` | `ToolsetRegistry.AgentSkillToolset` + **all 10 PoFToolset toolsets** coexisting on one surface (incl. the new `PoFInstancedMeshTools`) |
| `:8000` official | call PoFToolset via `call_tool` | `get_current_level → {"returnValue":"VerticalSlice"}` ✅ — a PoF gap-filler executes end-to-end through Epic's MCP |
| `:8090` MCPUnreal | `status` | `editor_online / plugin_online: true`; full feature set (`actors, blueprints, anim_blueprints, materials, viewport_capture, script_execution, …`) |
| `:8090` MCPUnreal | `get_level_actors` | 5 actors (a DROP-covered op — Epic's `EditorToolset.actor` does the same) |
| `:8090` MCPUnreal | `anim_blueprint_query` | valid result on `/Game/Characters/Player/ABP_VSPlayer` ✅ — **the C++-bound capability `:8000` lacks** |

## Coverage-parity map (MCPUnreal surface → who covers it)

| MCPUnreal tool(s) | Covered by | Notes |
|---|---|---|
| `get_level_actors`, `spawn_actor`, `delete_actors`, `move_actor`, `get_actor_components` | **Epic** `EditorToolset` actor/scene | live: `get_level_actors` works on `:8090`; Epic equivalent confirmed by source |
| `blueprint_query/modify`, `get_property/set_property/call_function` | **Epic** blueprint (53) / object | |
| `get_asset_info`, `search_assets`, `data_asset_ops`, `material_ops`, `texture_ops` | **Epic** asset/material/texture/data_asset | |
| `ui_query`, `live_compile`, `pcg_ops`, `config_ops`, `lookup_class/docs`, `subsystem_query` | **Epic** UMG-Slate / LiveCoding / PCG / Config / SemanticSearch / object | |
| `run_tests`, `list_tests`, `get_test_log` | **Epic** AutomationTest | |
| `pie_control`, `get_output_log` | **Epic** `EditorAppToolset` / `LogsToolset` | audit-confirmed COVERED |
| `capture_viewport`, `gas_ops`, `character_config`, `niagara_ops`, `input_ops`, `execute_script`, `run_console_command`, `player_control`(editor), `ism_ops` | **`PoFToolset`** | all 9 ported + live-verified (`:8000` `get_current_level` proves callability) |
| `build_project`, `cook_project`, `generate_project_files`, `project_ops` | **PoF bridge / `pof-mcp`** (headless) | Epic MCP is editor-only — out of scope (stays on PoF side) |
| `run_visual_tests` | **PoF `:30040` test-gate-runner** (L4 moat) | the verification moat we KEEP |
| `network_debug`, `player_control`(in-game) | **— (runtime/PIE-only)** | not an editor-MCP capability, like build/cook |
| `procedural_mesh`, `realtime_mesh`, `fab_ops`, `level_ops`(streaming) | **— (unused by PoF)** | deliberately not ported (porting = wasted potential) |
| **`anim_blueprint_query/modify`** | **🔴 nobody — C++-bound gap** | the one PoF-used capability not reproducible on `:8000` without a C++ re-home |

→ **Zero residual gaps except `anim_blueprint`.**

## Rubric

| Axis | `:8000` Epic + PoFToolset | `:8090` MCPUnreal |
|---|---|---|
| **Correctness** | ✅ live (`get_current_level=VerticalSlice`) | ✅ live (`get_level_actors`, `anim_blueprint_query`) |
| **Quality / breadth** | Epic's 350+ maintained tools + PoFToolset's 10 gap-fillers | 40 PoF tools (≈20 now redundant with Epic) — **+1: has `anim_blueprint`** |
| **Ease of use** | ✅ **tool-search** (`list/describe/call`) — lazy discovery, scales to 350+ without flooding context | flat ~40–50 tools, all schemas eager (heavier agent context) |
| **Maintenance** | ✅ Epic owns the bulk; PoF maintains only 10 | PoF maintains a Go proc + a C++ HTTP plugin (rebuild per engine bump) |

## Recommendation & next steps

1. **Re-home `anim_blueprint`** as a **C++ AICallable toolset** in `PoFToolset` (the only blocker) — *or* keep just `MCPUnreal`'s `anim_blueprint` tool and retire the rest.
2. Then **retire** the Go `mcp-unreal` proc + the `MCPUnreal` C++ HTTP routes.
3. Flip the in-app autonomous Claude to `:8000` (Phase 3 #2), keeping `:8090` as the transition fallback until step 2.
4. **Cleanup:** the Go server's `ue_editor_path` is still `UE_5.7` (`ue_installed:false`). It connected to a running 5.8 `:8090` fine (the path only matters for auto-*launch*), but standardize it on 5.8.
5. **Keep** the `:30040` verification moat (Phase 3 #3) — unaffected.

See [mcp-parity-audit.md](mcp-parity-audit.md) (Phase A) for the per-candidate porting rationale.
