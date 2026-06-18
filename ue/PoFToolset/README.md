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

### Phase 2 gap-filler tools (verified autonomously 2026-06-18)

Real PoF capabilities Epic's first-party toolsets don't cover ([tool map](../../docs/ue58-mcp-phase2-tool-map.md)). All registered with the Toolset Registry and executed in a headless 5.8 editor:

| Tool | Purpose | Verified |
|------|---------|----------|
| `PoFScriptTools.run_python(script)` | **Unsandboxed** code mode (vs Epic's sandboxed `execute_tool_script`) — execs with full `unreal` access, returns `str(result)` | `run_python('result = 2 + 2')` → `4` |
| `PoFCharacterTools.get_movement` / `set_movement(path, walk, jump, gravity)` | ARPG character movement tuning on an editor-world actor (transient) | spawn `Character`, set → `max_walk_speed=600.0; jump_z_velocity=800.0; gravity_scale=1.5` |
| `PoFInputTools.list_input_actions()` | Enhanced Input introspection (Epic's is non-functional) | returned 16 `InputAction` assets |

**Verify recipe (robust):** write the probe to a `.py` file and exec it via `buildPythonExecFile` → `-ExecCmds=py exec(open('<path>').read())`. This dodges the `-ExecCmds="…"` double-quote truncation that bit the inline form — use it for any multi-statement Python.

**Next slice:** `capture_viewport` (needs a rendered `-game -RenderOffScreen` launch), `gas_ops` mutations (needs an ASC-bearing actor + ability/effect assets), `niagara_ops`.

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

## ✅ Proven autonomously (2026-06-18)

Verified end-to-end with **zero human steps** — launched UE 5.8 headless from a shell, mounted the plugin via `-EnablePlugins` (no `.uproject` edit), and read the result from the abslog:

```
LogToolsetRegistry: Display: Registering Toolset pof_toolset.toolsets.spike.PoFSpikeTools
LogPython: SPIKE_RESULT=PoF toolset alive | PoF on UE 5.8.0-55116800+++UE5+Release-5.8
```

The exact working invocation (and the gotchas that cost three tries):

```bash
UE='…/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe'
# ONE `py` prefix, ';'-joined plain Python, SINGLE quotes only (see below)
EXEC="py import unreal; import pof_toolset.toolsets.spike as s; unreal.log('SPIKE_RESULT=' + s.PoFSpikeTools.ping() + ' | ' + s.PoFSpikeTools.project_info())"
"$UE" "$PROJ/PoF.uproject" -EnablePlugins=PythonScriptPlugin,ToolsetRegistry,PoFToolset \
  "-ExecCmds=$EXEC" -unattended -nopause -nosplash -nullrhi -NoLiveCoding -log -abslog="$LOG"
# then poll $LOG for "LogPython: SPIKE_RESULT=" and kill the editor (it won't self-quit)
```

**Gotchas (now encoded in `src/lib/ue-launch`):**
- **`Quit` via `-ExecCmds` does NOT exit a headless 5.8 editor** — it idles. Poll the abslog for your marker, then kill the process (or launch `-game`, which self-exits).
- **UE's `py` consumes the whole line as one Python string** — use one `py ` prefix + `;`-separated plain Python; a second `py` after `;` is a SyntaxError. (`buildPythonExecCmd` enforces this.)
- **Use single quotes in the Python** — double quotes collide with `-ExecCmds="…"` and truncate the value at the first inner `"`. (`buildPythonExecCmd` throws on `"`.)
- **Anchor the result grep on the `LogPython:` prefix** — the abslog also echoes the raw command line (which contains your `KEY=`), so a bare `KEY=` grep false-positives.
- `-EnablePlugins=A,B,C` enables session-scoped plugins without editing the `.uproject`.

**Still pending:** the MCP *transport* round-trip (Claude → `http://127.0.0.1:8000/mcp` → call `PoFSpikeTools.ping`) — this validated registration + direct execution, not Epic's HTTP server. And the `RefreshTools`-vs-restart measurement.

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
