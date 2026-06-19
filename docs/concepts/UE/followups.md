# UE followups backlog

Running list of UE-side followups for future sessions. Each entry: what, why it's
open, and where to start. Keep newest/most-actionable near the top; tick + date when
done. (This is the UE counterpart to a backlog — not a commitment.)

## L4 visual capture

- **Specific action visible in-frame (content/map).** The L4 capture tooling is done, but a per-gate frame currently shows the character *idle* on a lit map because the lit map's pawn (`BP_VSPlayer`) lacks arbitrary abilities and the ability-capable pawn is on the dark `TestHarness`. Close by one of: grant abilities to `BP_VSPlayer`; light `TestHarness`; or add per-catalog lit capture maps via the resolver `mapFor`. See [l4-autonomous-visual-capture.md](l4-autonomous-visual-capture.md).
- **Wire `autoCapture` into the live drain route.** `buildExecutors` accepts `autoCapture` but no route passes it yet — the `/api/pipeline-artifacts/drain` (or equivalent) caller must opt in so L4 jobs auto-capture in production. Then the full launch→render→Gemini path runs from a real drain.
- **Gemini round-trip is mocked in tests.** A true end-to-end L4 pass needs `GEMINI_API_KEY` (the personas `gemini-recognize` path). Add a live smoke check (gated on the key) rather than only the mocked `visualExecutor` tests.

## UE 5.8 first-party MCP convergence

- **Phase 2 long-tail gap-fillers.** The 6 ⭐ moat tools + 3 world tools are ported; the remaining non-⭐ PORT items (anim_blueprint state machines, ism_ops, level streaming, pie/player control, network_debug, fab_ops, get_output_log) follow the same `PoFToolset` template when needed. See `docs/ue58-mcp-phase2-tool-map.md`.
- **Phase 0 `RefreshTools`-vs-restart measurement.** Confirm whether editing a Python toolset re-registers via `ModelContextProtocol.RefreshTools` without an editor restart (drives the iterate cadence). Minor.
- **Phase 3 — the strategic decision (in progress).** Whether to retire the bespoke `mcp-unreal` (Go) + `MCPUnreal` (HTTP routes) in favour of the first-party Toolset Registry, keep the auth'd `:30040` PoF Bridge as the verification moat, and promote the engine default to 5.8. (See the convergence plan + the session's Phase 3 analysis.)

## Autonomy / tooling

- **`ue-launch` is bash-driven in verification; the Node path is the product surface.** Live bash verifies need `MSYS_NO_PATHCONV=1` + Windows-form uproject (Node `spawn` is unaffected). If a future session scripts UE launches from bash, reuse that recipe.
- **`captureScenarioFrame` per-catalog `mapFor`.** Today the resolver defaults every gate to VerticalSlice; non-character catalogs (materials, zones) may want their own lit capture map for a representative frame.
