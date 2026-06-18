# PoF Toolset — UE 5.8 official-MCP spike (convergence Phase 0)

A content-only UE 5.8 plugin that registers a custom **`PoFSpikeTools`** toolset
with Epic's first-party **Toolset Registry**, so the official **ModelContextProtocol**
server exposes it to an MCP client (Claude Code). It is the cheapest proof that
PoF's tool-authoring approach works on the first-party MCP — the prerequisite for
[Phase 2](../../docs/ue58-mcp-convergence-plan.md) (porting the 37 `MCPUnreal` ops).

Authored against Epic's shipped pattern (`UE_5.8/Engine/Plugins/Experimental/Toolsets/ConversationToolset`): `@unreal.uclass()` on `unreal.ToolsetDefinition`, tools tagged `@toolset_registry.tool_call @staticmethod`, registered via `toolset_registry.registration.Registration` in `init_unreal.py`.

## Tools

| Tool | Returns | Proves |
|------|---------|--------|
| `PoFSpikeTools.ping` | `"PoF toolset alive"` | authoring → registry discovery → MCP call |
| `PoFSpikeTools.project_info` | `"<project> on UE <version>"` | the toolset reaches the live `unreal` API |

## Run the spike (manual editor steps)

> The PoF project is still UE 5.7. Test against a **throwaway 5.8 project** (recommended — isolated) **or** a PoF project upgraded to 5.8. Pick one and copy the plugin in.

1. **Copy** this `PoFToolset/` folder into `<5.8 project>/Plugins/PoFToolset/`.
2. **Open** the project in UE 5.8. Enable (Edit → Plugins, then restart):
   - `Model Context Protocol`, `Toolset Registry`, `Python Editor Script Plugin`, and **PoF Toolset (Phase-0 Spike)**.
3. **Editor Preferences → Model Context Protocol**: turn on **Auto Start Server** (off by default). Leave **tool search** on (default). The server listens on `http://127.0.0.1:8000/mcp` (HTTP+SSE, loopback, no auth).
4. **Generate the client config** (Output Log console):
   ```
   ModelContextProtocol.GenerateClientConfig ClaudeCode
   ```
   writes `.mcp.json` in the project root. (Or use `pof-official-mcp.example.json` here, which points at the same URL.)

## Verify it's callable

**Option A — directly:** from the project dir,
```
claude --mcp-config .mcp.json --strict-mcp-config
```
then in the session: `/mcp` (should connect + show the tool-search meta-tools `list_toolsets` / `describe_toolset` / `call_tool`), then ask it to **list toolsets** (expect `PoFSpikeTools`) and **call `PoFSpikeTools.ping`**.

**Option B — via the PoF app (exercises Phase 1):** point the Phase-1 env var at an HTTP config for the official server and run an autonomous spawn:
```
set POF_CLI_MCP_CONFIG=<path>\pof-official-mcp.example.json
```
then trigger a one-shot/harness run; the `init` event's tool list should include `mcp__unreal-official__PoFSpikeTools_ping` (exact tool naming TBD by the server — confirm during the run).

### Acceptance
`PoFSpikeTools.ping` returns **`"PoF toolset alive"`** through the MCP client. ✅ proves the authoring path.

## The key unknown to capture: re-register cost

After editing a **Python** toolset, run the console command:
```
ModelContextProtocol.RefreshTools
```
and note whether the change is picked up **without** an editor restart. (Epic's docs warn that *C++* `UFUNCTION(meta=(AICallable))` changes need a restart because Live Coding doesn't propagate new UFUNCTIONs — Python toolsets *should* re-poll via `RefreshTools`, but this spike is what confirms it.) Record the result for the Phase 2 effort estimate.

## Editor-run tests

`pof_toolset/tests/test_spike.py` runs inside the editor (needs the live `unreal`
runtime, so not vitest): Automation tab → **PoF.Toolsets.PoFSpikeToolset**.

## Notes

- **Content-only** (no C++ module) → no compile needed; `PythonScriptPlugin` auto-runs `init_unreal.py`. If registration doesn't fire, confirm Python is enabled and the plugin is enabled, then restart.
- This is throwaway spike scaffolding. Phase 2 re-homes the real PoF tools into a maintained toolset and decides the plugin's final home.
