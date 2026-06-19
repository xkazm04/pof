# Phase 2 tool map — MCPUnreal (40) vs UE 5.8 first-party toolsets

> Scoping for [convergence Phase 2](./ue58-mcp-convergence-plan.md#phase-2--port-the-toolset-on-58). Compares our 40 `mcp-unreal` tools against Epic's UE 5.8 shipped toolsets to decide, per tool: **DROP** (Epic covers it — use first-party), **PORT** (PoF gap-filler — re-home as an `AICallable`/Python toolset), or **PARTIAL/VERIFY** (Epic overlaps but coverage unconfirmed). Built 2026-06-18 from a read of both code bases.

## Headline

Epic ships **28 toolsets / 350+ AI-callable tools** in 5.8 — `EditorToolset` alone is **262** (blueprint ×53, asset ×21, material ×35, scene ×20, meshes ×38, data/curve/string tables ×27, …), plus a **319-tool** AnimationAssistantToolset, GAS (C++, inspection), StateTree, BehaviorTree, MetaHuman, UMG/Slate, LiveCoding, AutomationTest, Config, SemanticSearch, PCG, Plugin/GameFeatures.

**So Phase 2 is far smaller than "port 37 tools."** Most of our generic engine ops are now first-party → **drop them**. The real work is porting **~16 PoF gap-fillers**, and only ~6 of those are the load-bearing moat.

| Verdict | Count | Meaning |
|---|---|---|
| **DROP** (Epic covers) | ~20 | actor/blueprint/asset/material/components/UI/live-compile/doc-lookup/tests/config/property/transform |
| **PORT** (gap-filler) | ~16 | the PoF-distinctive or not-covered tools (below) |
| **N/A — not editor-MCP** | 4 | build/cook/generate/project headless ops stay on the PoF bridge/`pof-mcp` (Epic's MCP is editor-only) |

## Two corrections to earlier docs

1. **Epic DOES ship a code-execution tool** — `EditorToolset.programmatic.execute_tool_script(script)`: a **sandboxed** Python runner (stdlib only — `json/math/datetime/copy/re/time`; **read-only** file I/O; can call other tools; transactional). Earlier notes (Candidate G, convergence plan, memory) said "no code-mode tool" — that was wrong. PoF's `execute_script` is **unsandboxed/full** (`py` console — write files, any `unreal` API). It's a *power/safety* difference, not a pure gap: keep ours as the full-access power-tool; prefer Epic's for read-only orchestration.
2. **Epic's GAS is inspection-only** — `GASToolsets` (C++) reads: `GetAttributeValues`, `GetActiveEffects`, `GetGrantedAbilities`, `GetActiveTags`, `ListAttributes`. Our `gas_ops` **mutates** (grant/revoke ability, apply/revoke effect, set attribute). So `gas_ops` is a genuine gap-filler, not redundant.

## PORT — the gap-fillers (Phase 2 work)

⭐ = load-bearing moat; do these first.

| Tool | Why Epic doesn't cover it |
|---|---|
| ⭐ `capture_viewport` | No first-party screenshot/rendered-frame tool. **PoF's L4 visual verification depends on this.** |
| ⭐ `gas_ops` (mutations) | Epic GAS only *inspects*; ours grants/applies/sets — the ARPG combat authoring surface. |
| ⭐ `character_config` | Game-specific ARPG movement/capsule tuning; no engine equivalent. |
| ⭐ `niagara_ops` | `NiagaraToolsets` ships **0 callable tools** (skills/docs only). |
| ⭐ `input_ops` | Enhanced Input authoring; VibeUE reported the first-party input methods are empty/non-functional — verify, but likely a real gap. |
| ⭐ `execute_script` (unsandboxed) | Epic's `execute_tool_script` is sandboxed/read-only; keep ours as the full-access power-tool (with the safety caveat documented). |
| `anim_blueprint_query/modify` | Epic anim tooling is Sequencer/Control-Rig; **AnimBP state-machine** editing (states/transitions/rules) appears uncovered — PoF locomotion needs it. |
| `procedural_mesh` / `realtime_mesh` | Runtime mesh from vertex/UV/tri arrays; Epic `static_mesh` is asset-based, not array-built. |
| `ism_ops` | Instanced-static-mesh instance add/remove/query — not in the catalog. |
| `pie_control` | Start/stop/query PIE — verify against AutomationTest; likely a gap. |
| `player_control` | Teleport player / set camera / view target — partial vs scene; port the PoF-shaped surface. |
| `level_ops` (streaming) | Streaming level load/unload/save — verify; likely a gap. |
| `network_debug` | Multiplayer/replication state — not in the catalog. |
| `fab_ops` | Marketplace query/install — verify vs PluginToolset/GameFeatures. |
| `get_output_log` (filtered) | Category/verbosity/regex log querying — verify; PoF debugging relies on it. |
| `run_console_command` | Arbitrary console command — verify; small, port if uncovered. |

### Phase A audit resolution (2026-06-19)

The "verify" candidates above were adjudicated against Epic's shipped 5.8 toolset source — full table in [`concepts/UE/mcp-parity-audit.md`](./concepts/UE/mcp-parity-audit.md). Outcome:
- **COVERED → drop:** `pie_control` (`EditorAppToolset.StartPIE/StopPIE/IsPIERunning`), `get_output_log` (`LogsToolset.GetLogEntries`+regex).
- **Already ported:** `run_console_command`, `player_control`(editor) — `PoFWorldTools`.
- **GAP → PORTED + verified live:** `ism_ops` → `PoFInstancedMeshTools` (add/count/update/remove instance). `PoFToolset` is now **10 tools / 9 toolsets**.
- **Residual — not ported (rationale):** `anim_blueprint` is a real PoF-used gap but **C++-bound** (AnimGraph/state-machine editing isn't a clean Python re-home — needs a C++ AICallable toolset) → the one genuine retire blocker; `network_debug` + in-game `player_control` are **runtime/PIE-only** (not editor-MCP, like build/cook); `procedural_mesh`/`realtime_mesh`, `fab_ops`, `level_ops`(streaming) are **unused by PoF** (porting them = wasted potential).

## DROP — Epic covers it (use first-party on migration)

| Our tool(s) | First-party replacement |
|---|---|
| `get_level_actors`, `spawn_actor`, `delete_actors`, `move_actor`, `get_actor_components` | `EditorToolset` actor.py (17) + scene.py (20) |
| `blueprint_query`, `blueprint_inspect`, `blueprint_modify` (+ graph) | blueprint.py (**53**) + blueprint_node/dsl/layout |
| `get_asset_info`, `get_asset_dependencies`, `get_asset_referencers`, `search_assets` | asset.py (21) |
| `material_ops` | material.py (22) + material_instance.py (13) |
| `texture_ops` | texture.py (minor prop gap — confirm before fully dropping) |
| `data_asset_ops` | data_asset.py (Epic = create only; ours adds load/get/set — thin gap, confirm) |
| `get_property`, `set_property`, `call_function` | object.py (class/name/properties/outer) |
| `ui_query` | UMGToolSet + SlateInspectorToolset |
| `live_compile` | LiveCodingToolset |
| `pcg_ops` | PCGToolset (confirm execute/cleanup parity) |
| `run_tests`, `list_tests`, `run_visual_tests` | AutomationTestToolset (confirm *visual* coverage — likely still ours) |
| `config_ops` | ConfigSettingsToolset |
| `lookup_class`, `lookup_docs` | SemanticSearchToolset |
| `subsystem_query` | partial (object/config) — confirm |
| `status` | trivial; the PoF bridge already reports health |

## N/A — not part of the editor MCP

`build_project`, `cook_project`, `generate_project_files`, `project_ops` are **`mcp-unreal` server (Go) / headless** capabilities. Epic's MCP is **editor-only** — it has no headless build/cook orchestration. These stay on PoF's side (`pof-mcp` + the `:30040` bridge / `test-gate-runner`), independent of the toolset port.

## Confidence & open verifications

The DROP list for Python `EditorToolset` is high-confidence (read directly). The C++ toolsets (GAS, PCG, AutomationTest, Config, UMG, Plugin, GameFeatures, SemanticSearch) were enumerated by class/area but not every function — so anything marked *confirm/verify* needs a quick live check once a 5.8 editor is up (pairs with the Phase 0 live run). Specifically verify Epic coverage for: AnimBP state machines, PIE control, ISM, Enhanced Input, level streaming, network/replication, visual tests, Fab install, filtered output-log.

## Phase 2 recommendation

Port the **6 ⭐ moat tools first** (`capture_viewport`, `gas_ops`, `character_config`, `niagara_ops`, `input_ops`, `execute_script`) as one PoF toolset — they're the highest-value, lowest-overlap, and directly feed PoF's verification + ARPG authoring. Add the remaining gap-fillers after the Phase 0 live run confirms the open verifications. Drop the ~20 redundant tools rather than porting them.
