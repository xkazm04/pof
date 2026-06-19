# UE followups backlog

Running list of UE-side followups for future sessions. Each entry: what, why it's
open, and where to start. Keep newest/most-actionable near the top; tick + date when
done. (This is the UE counterpart to a backlog — not a commitment.)

## L4 visual capture

- **Specific action visible in-frame (content/map).** The L4 capture tooling is done, but a per-gate frame currently shows the character *idle* on a lit map because the lit map's pawn (`BP_VSPlayer`) lacks arbitrary abilities and the ability-capable pawn is on the dark `TestHarness`. Close by one of: grant abilities to `BP_VSPlayer`; light `TestHarness`; or add per-catalog lit capture maps via the resolver `mapFor`. See [l4-autonomous-visual-capture.md](l4-autonomous-visual-capture.md).
- **Wire `autoCapture` into the live drain route.** `buildExecutors` accepts `autoCapture` but no route passes it yet — the `/api/pipeline-artifacts/drain` (or equivalent) caller must opt in so L4 jobs auto-capture in production. Then the full launch→render→Gemini path runs from a real drain.
- **Gemini round-trip is mocked in tests.** A true end-to-end L4 pass needs `GEMINI_API_KEY` (the personas `gemini-recognize` path). Add a live smoke check (gated on the key) rather than only the mocked `visualExecutor` tests.

## UE 5.8 first-party MCP convergence

- **Phase A coverage audit DONE (2026-06-19)** — see [mcp-parity-audit.md](mcp-parity-audit.md). Remaining long-tail adjudicated: `ism_ops` PORTED+verified (`PoFInstancedMeshTools`); `pie_control`/`get_output_log` dropped (Epic covers); `network_debug`+in-game `player_control` are runtime-only; `procedural_mesh`/`fab_ops`/`level_ops`-streaming unused (not ported). `PoFToolset` = 10 tools / 9 toolsets.
- **🔴 anim_blueprint is C++-bound — the one genuine retire blocker.** AnimBP state-machine graph edit/read is not a clean Python re-home (AnimGraph editing is C++/editor-only); PoF locomotion uses it. To fully retire `MCPUnreal` either re-implement `anim_blueprint` as a **C++ AICallable toolset** (a real chunk of work) or keep that one `MCPUnreal` tool. Decide in/after the Phase B bake-off.
- **Phase B bake-off DONE (2026-06-19)** — [mcp-bakeoff-verdict.md](mcp-bakeoff-verdict.md). Live-proven both surfaces from one 5.8 editor: `:8000` (Epic + 10 PoFToolset toolsets, tool-search, `get_current_level` call works) and `:8090` (MCPUnreal full feature set, `get_level_actors` + `anim_blueprint_query` work). **Verdict: RETIRE MCPUnreal + Go, gated on re-homing `anim_blueprint` as a C++ AICallable toolset** (the only residual gap); `:8000` is structurally easier (tool-search vs flat-40) and Epic-maintained.
- **✅ Descope DONE 2026-06-19 (config-level)** — [go-cpp-stack-decommission.md](go-cpp-stack-decommission.md). `.mcp.json` flipped to `pof-mcp` + `unreal-official` (`:8000`); `mcp-unreal` removed; `mcp-config.ts` docstring updated. The Go+C++ stack is out of PoF's active workflow.
- **Manual (when ready, destructive — outside repo):** delete the `MCPUnreal` UE plugin (`<project>/Plugins/MCPUnreal/`) + the Go binary (`~/mcp-unreal-staging/`); rebuild. Confirm the concurrent `/research` session no longer needs `:8090` first.
- **Deferred-unless-needed — `anim_blueprint` C++ re-home.** Only build the C++ AICallable toolset (lift `AnimBlueprintRoutes.cpp`) IF a real AnimBP-state-machine authoring need arises — PoF's ABPs are blendspace-driven (the tool returned 0 state machines), so it's likely unneeded. Steps in the decommission doc.
- **Phase 0 `RefreshTools`-vs-restart measurement.** Confirm whether editing a Python toolset re-registers via `ModelContextProtocol.RefreshTools` without an editor restart (drives the iterate cadence). Minor.

## Autonomy / tooling

- **`ue-launch` is bash-driven in verification; the Node path is the product surface.** Live bash verifies need `MSYS_NO_PATHCONV=1` + Windows-form uproject (Node `spawn` is unaffected). If a future session scripts UE launches from bash, reuse that recipe.
- **`captureScenarioFrame` per-catalog `mapFor`.** Today the resolver defaults every gate to VerticalSlice; non-character catalogs (materials, zones) may want their own lit capture map for a representative frame.
