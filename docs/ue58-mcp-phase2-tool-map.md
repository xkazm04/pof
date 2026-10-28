# Phase 2 tool map — MCPUnreal (40) vs UE 5.8 first-party toolsets

> Scoping for [convergence Phase 2](./ue58-mcp-convergence-plan.md#phase-2--port-the-toolset-on-58). Compares our 40 `mcp-unreal` tools against Epic's UE 5.8 shipped toolsets to decide, per tool: **DROP** (Epic covers it — use first-party), **PORT** (PoF gap-filler — re-home as an `AICallable`/Python toolset), or **PARTIAL/VERIFY** (Epic overlaps but coverage unconfirmed). Built 2026-06-18 from a read of both code bases; **per-tool verdicts settled 2026-10-22** against the committed audit/bake-off/decommission docs (see the PORT table).

## Headline

Epic ships **28 toolsets / 350+ AI-callable tools** in 5.8 — `EditorToolset` alone is **262** (blueprint ×53, asset ×21, material ×35, scene ×20, meshes ×38, data/curve/string tables ×27, …), plus a **319-tool** AnimationAssistantToolset, GAS (C++, inspection), StateTree, BehaviorTree, MetaHuman, UMG/Slate, LiveCoding, AutomationTest, Config, SemanticSearch, PCG, Plugin/GameFeatures.

**So Phase 2 is far smaller than "port 37 tools."** Most of our generic engine ops are now first-party → **drop them**. The real work was porting the PoF gap-fillers; **settled: 9 were ported into `PoFToolset`** (6 of them the load-bearing moat), 2 were dropped as Epic-covered, and the rest were deliberately not ported.

| Verdict | Count | Meaning |
|---|---|---|
| **DROP** (Epic covers) | ~20 | actor/blueprint/asset/material/components/UI/live-compile/doc-lookup/tests/config/property/transform |
| **PORT** (gap-filler) | ~16 scoped → 9 ported, 2 dropped, rest not ported | the PoF-distinctive or not-covered tools (below, each with a settled verdict) |
| **N/A — not editor-MCP** | 4 | build/cook/generate/project headless ops stay on the PoF bridge/`pof-mcp` (Epic's MCP is editor-only) |

## Two corrections to earlier docs

1. **Epic DOES ship a code-execution tool** — `EditorToolset.programmatic.execute_tool_script(script)`: a **sandboxed** Python runner (stdlib only — `json/math/datetime/copy/re/time`; **read-only** file I/O; can call other tools; transactional). Earlier notes (Candidate G, convergence plan, memory) said "no code-mode tool" — that was wrong. PoF's `execute_script` is **unsandboxed/full** (`py` console — write files, any `unreal` API). It's a *power/safety* difference, not a pure gap: keep ours as the full-access power-tool; prefer Epic's for read-only orchestration.
2. **Epic's GAS is inspection-only** — `GASToolsets` (C++) reads: `GetAttributeValues`, `GetActiveEffects`, `GetGrantedAbilities`, `GetActiveTags`, `ListAttributes`. Our `gas_ops` **mutates** (grant/revoke ability, apply/revoke effect, set attribute). So `gas_ops` is a genuine gap-filler, not redundant.

## PORT — the gap-fillers (Phase 2 work)

**All verdicts settled 2026-10-22** from the committed evidence ([`mcp-bakeoff-verdict.md`](./concepts/UE/mcp-bakeoff-verdict.md) 2026-06-19, [`mcp-parity-audit.md`](./concepts/UE/mcp-parity-audit.md) 2026-06-19, [`go-cpp-stack-decommission.md`](./concepts/UE/go-cpp-stack-decommission.md) 2026-06-19, Phase 2 slice notes in [`ue58-mcp-convergence-plan.md`](./ue58-mcp-convergence-plan.md)). No row is left open. The *Why* column is the original 2026-06-18 scoping; the *Verdict* column is the settled outcome. Tool names are as the cited docs record them — the PoFToolset plugin source is not in this checkout.

⭐ = load-bearing moat; these were done first.

| Tool | Why Epic doesn't cover it (2026-06-18 scoping) | Verdict (settled 2026-10-22) |
|---|---|---|
| ⭐ `capture_viewport` | No first-party screenshot/rendered-frame tool. **PoF's L4 visual verification depends on this.** | **PORTED** → `PoFViewportTools.capture_viewport` (71 KB PNG via `-RenderOffScreen`; convergence plan Phase 2 slice 2, 2026-06-18). One of the nine `PoFToolset` ports in `mcp-bakeoff-verdict.md` (2026-06-19). |
| ⭐ `gas_ops` (mutations) | Epic GAS only *inspects*; ours grants/applies/sets — the ARPG combat authoring surface. | **PORTED** → `PoFGasTools.apply_effect` / `list_abilities` (GAS mutation, plan slice 2, 2026-06-18); counted in the nine ports, `mcp-bakeoff-verdict.md` (2026-06-19). |
| ⭐ `character_config` | Game-specific ARPG movement/capsule tuning; no engine equivalent. | **PORTED** → `PoFCharacterTools.get_movement` / `set_movement` (plan slice 1, 2026-06-18); `mcp-bakeoff-verdict.md` (2026-06-19). |
| ⭐ `niagara_ops` | `NiagaraToolsets` ships **0 callable tools** (skills/docs only). | **PORTED** → `PoFNiagaraTools.list` / `spawn` (plan slice 2, 2026-06-18); `mcp-bakeoff-verdict.md` (2026-06-19). |
| ⭐ `input_ops` | Enhanced Input authoring; VibeUE reported the first-party input methods are empty/non-functional. | **PORTED** → `PoFInputTools` (`list_input_actions` recorded in plan slice 1, 2026-06-18); `mcp-bakeoff-verdict.md` (2026-06-19) lists `input_ops` among the nine ported. The "verify, likely a real gap" caveat was resolved by porting it. |
| ⭐ `execute_script` (unsandboxed) | Epic's `execute_tool_script` is sandboxed/read-only; keep ours as the full-access power-tool. | **PORTED** → `PoFScriptTools.run_python` (unsandboxed code mode; plan slice 1, 2026-06-18); `mcp-bakeoff-verdict.md` (2026-06-19). |
| `anim_blueprint_query/modify` | Epic anim tooling is Sequencer/Control-Rig; **AnimBP state-machine** editing appears uncovered. | **NOT PORTED** (2026-06-19). Real gap but C++-bound — AnimGraph/state-machine editing is a 328-line editor-only lift (`UAnimGraphNode_StateMachine`/`UAnimStateNode`/`FBlueprintEditorUtils`), not a clean Python re-home; it would need a C++ AICallable toolset. Deferred unless a real authoring need arises: PoF's ABPs are blendspace-driven (the tool returned 0 state machines on `ABP_VSPlayer`) and ABP edits were done via Python/editor. `MCPUnreal` itself — the only implementation — was physically deleted 2026-06-19, so the tool is **gone**, not kept. Sources: `mcp-parity-audit.md`, `mcp-bakeoff-verdict.md`, `go-cpp-stack-decommission.md` (all 2026-06-19). |
| `procedural_mesh` / `realtime_mesh` | Runtime mesh from vertex/UV/tri arrays; Epic `static_mesh` is asset-based. | **NOT PORTED** (2026-06-19) — unused by PoF (pipelines use Blender→import asset meshes); porting would be wasted potential. `mcp-parity-audit.md`. |
| `ism_ops` | Instanced-static-mesh instance add/remove/query — not in the catalog. | **PORTED** → `PoFInstancedMeshTools` (add/count/update/remove instance), verified live 2026-06-19 (add→count=2, remove→count=1). `mcp-parity-audit.md`. |
| `pie_control` | Start/stop/query PIE — verify against AutomationTest. | **NOT PORTED — COVERED by Epic, dropped** (2026-06-19): `EditorAppToolset.StartPIE`/`StopPIE`/`IsPIERunning`. `mcp-parity-audit.md`. |
| `player_control` | Teleport player / set camera / view target — port the PoF-shaped surface. | **Editor part PORTED** → `PoFWorldTools.teleport_actor` (Epic also has `EditorAppToolset.Set/GetCameraTransform`); listed as ported in `mcp-bakeoff-verdict.md`. **In-game part NOT PORTED** — runtime/PIE-only, not an editor-MCP capability. Both 2026-06-19, `mcp-parity-audit.md`. |
| `level_ops` (streaming) | Streaming level load/unload/save — verify; likely a gap. | **NOT PORTED** (2026-06-19) — unused by PoF; Epic `SceneTools.load_level` + level-instance editing cover PoF's needs. `mcp-parity-audit.md`. |
| `network_debug` | Multiplayer/replication state — not in the catalog. | **NOT PORTED** (2026-06-19) — replication state exists only in a running networked game (PIE/`-game`); runtime-only, not editor-MCP, like build/cook. `mcp-parity-audit.md`. |
| `fab_ops` | Marketplace query/install — verify vs PluginToolset/GameFeatures. | **NOT PORTED** (2026-06-19) — unused by PoF's autonomous loop, heavy editor-plugin surface. `mcp-parity-audit.md`. |
| `get_output_log` (filtered) | Category/verbosity/regex log querying — verify. | **NOT PORTED — COVERED by Epic, dropped** (2026-06-19): `LogsToolset.GetLogEntries` (category + regex + max). `mcp-parity-audit.md`. |
| `run_console_command` | Arbitrary console command — verify; small, port if uncovered. | **PORTED** → `PoFWorldTools.run_console_command` (a direct `exec`; Epic's `execute_tool_script` is heavier). `mcp-parity-audit.md`; listed among the nine in `mcp-bakeoff-verdict.md`. |

**Net:** nine tools ported into `PoFToolset` (`capture_viewport`, `gas_ops`, `character_config`, `niagara_ops`, `input_ops`, `execute_script`, `run_console_command`, `player_control` editor, `ism_ops`); two dropped as Epic-covered; the rest deliberately not ported. **UNVERIFIED rows: none.** Caveat: the per-tool function names for `input_ops` beyond `list_input_actions` come from the bake-off's "all 9 ported" statement, not from plugin source.

### Phase A audit resolution (2026-06-19)

The "verify" candidates were adjudicated against Epic's shipped 5.8 toolset source — full table in [`concepts/UE/mcp-parity-audit.md`](./concepts/UE/mcp-parity-audit.md); the per-row verdicts above are the settled form of that audit. `PoFToolset` is **10 tools / 9 toolsets**. `anim_blueprint` was the one retire blocker; it was resolved by deferral and by the removal of `MCPUnreal` (see above).

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

The DROP list for Python `EditorToolset` is high-confidence (read directly). The C++ toolsets (GAS, PCG, AutomationTest, Config, UMG, Plugin, GameFeatures, SemanticSearch) were enumerated by class/area but not every function.

**Settled 2026-10-22:** every verification the 2026-06-18 scoping left open for the PORT list — AnimBP state machines, PIE control, ISM, Enhanced Input, level streaming, network/replication, Fab install, filtered output-log — is resolved in the PORT table above from [`mcp-parity-audit.md`](./concepts/UE/mcp-parity-audit.md) and [`mcp-bakeoff-verdict.md`](./concepts/UE/mcp-bakeoff-verdict.md) (both 2026-06-19). Still *confirm*-marked, and not covered by those docs, are the DROP-table caveats (`texture_ops`, `data_asset_ops`, `pcg_ops`, `subsystem_query`, and *visual* tests — the bake-off lists `run_visual_tests` as kept on the `:30040` test-gate-runner); they need a 5.8 editor or the PoFToolset source to close, and are not part of the PORT verdicts.

## Phase 2 recommendation (executed)

Done: the 6 ⭐ moat tools were ported first as one PoF toolset (slices 1–2, 2026-06-18), the remaining gap-fillers were adjudicated and `ism_ops` ported (2026-06-19), and the ~20 redundant tools were dropped rather than ported. Final outcome per tool is in the PORT table.
