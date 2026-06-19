# UE 5.8 First-Party MCP — Convergence Prototype Plan

> Concrete prototype/spec for [Candidate G](./ue5-capability-integration-candidates.md#candidate-g--converge-on-the-first-party-ue-mcp-server-control-surface-keep-pofs-verification-moat). Created 2026-06-18 from a research pass over Epic's *[Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor)* doc + three demo walkthroughs (BuiltByMoebs, VibeUE, Flopperam). **This is a spike plan, not committed work** — it deliberately stops short of upgrading the production PoF project to 5.8.

## Goal

Validate that PoF can **converge its raw-UE control surface onto UE 5.8's first-party MCP server** — retiring the bespoke `MCPUnreal` HTTP routes + the community Go MCP process — **while keeping PoF's verification and orchestration as the moat.** The official MCP is a *control* plane only; it has no verification, no code-mode, and no auth (see caveats below). We adopt the control plane and keep our distinctive value above it.

## Non-goals (hold the line)

- **Do NOT upgrade the production PoF UE project (5.7) to 5.8.** 5.8 and its MCP feature are preview/Experimental. All spikes happen in a throwaway 5.8 project.
- **Do NOT remove `PillarsOfFortuneBridge` (`:30040`).** It stays as the auth'd verification/orchestration layer.
- **Do NOT remove the verification spine** (`src/lib/test-gate-runner/`, observation.json L3, Gemini visual L4) or `execute_script`. These are the moat.
- **Do NOT expose any control plane beyond loopback.** The official MCP has no auth.
- **Do NOT rip out `MCPUnreal` until 5.8 parity + verification are proven.** Phase 3 is a *decision* gate, not a foregone migration.

## Current state (grounded)

Two C++ HTTP plugins in the UE project, both via `FHttpServerModule`/`FHttpRouter`:

| Plugin | Port | Role | Tool model |
|---|---|---|---|
| `MCPUnreal` | `:8090` | raw UE control (behind a community Go MCP proc, `mcp__mcp-unreal__*`) | ~37 routes hand-registered via `Register*Routes()`; **no tool-search**, all static |
| `PillarsOfFortuneBridge` | `:30040` | app/harness/test-gate integration | REST, **auth-token validated** |

- App-spawned Claude: `claude -p - --output-format stream-json --dangerously-skip-permissions`, **no `--mcp-config`** (`src/lib/claude-terminal/cli-service.ts`) → drives PoF via `@@CALLBACK` only, no MCP tools.
- `pof-mcp` (`tools/pof-mcp/src/`): stdio MCP over the app HTTP API (`:3000`); never touches UE.
- Engine: **5.7**.

## Target architecture (two planes)

```
                 ┌─────────────── CONTROL PLANE (adopt) ───────────────┐
 Claude Code  ──▶│ UE 5.8 first-party MCP  (HTTP+SSE 127.0.0.1:8000)    │──▶ UE editor
 (in-app harness │  Toolset Registry: ActorTools/SceneTools/… (Epic)    │
  OR in-editor   │  + PoF gap-filler toolsets (AICallable / Python)     │
  Terminal)      │  + execute_script  ← "code mode" Epic omits          │
                 └─────────────────────────────────────────────────────┘
                 ┌──────────── VERIFICATION/ORCH PLANE (keep) ──────────┐
 PoF app /    ──▶│ PillarsOfFortuneBridge (auth'd REST :30040)          │──▶ UE editor
 test-gate-runner│  /pof/test/run-automation · /pof/snapshot/capture    │
                 │  observation.json L3 · Gemini visual L4 · build queue│
                 └─────────────────────────────────────────────────────┘
```

The control plane is interchangeable (official MCP ← today: MCPUnreal). The verification plane is PoF-proprietary and stays.

## The 5.8 MCP facts that shape the plan (from Epic docs)

- Custom tools: C++ `UFUNCTION(meta = (AICallable))` static methods on a `UToolsetDefinition`, **or** Python `@toolset_registry.tool_call` `@staticmethod` on `unreal.ToolsetDefinition`. Auto-discovered by the **Toolset Registry** subsystem (scans plugin `Content/Python/`).
- `ModelContextProtocol.GenerateClientConfig ClaudeCode` → writes `.mcp.json`. `ModelContextProtocol.RefreshTools` → re-poll.
- **Tool-search on by default**: server advertises `list_toolsets` / `describe_toolset` / `call_tool`, not every schema.
- Transport: **HTTP + SSE only** at `http://127.0.0.1:8000/mcp` (no stdio/WebSocket).
- **Caveats:** Experimental; loopback-only, **no auth**; code execution is **sandboxed only** (`execute_tool_script`: stdlib + read-only FS) — **no unsandboxed "code mode"**; **Live Coding does not register new `UFUNCTION`s — adding a tool needs an editor restart.**

## Phases

### Phase 0 — Spike the toolset path (throwaway 5.8 project)
Stand up a fresh UE 5.8 preview project; enable **Unreal MCP**, **Toolset Registry**, **Terminal**; turn on *Auto Start Server*; run `ModelContextProtocol.GenerateClientConfig ClaudeCode`; connect Claude Code and confirm tool-search (3 meta-tools). Author **one** Python toolset (in the plugin's `Content/Python/`) that wraps a single existing PoF op — start with **`execute_script`** (it's our differentiator and the simplest to prove). Test the `RefreshTools` vs. restart-to-register behavior.
- **Acceptance:** Claude calls a PoF-authored tool through Epic's server and gets a real result. Restart-to-register friction quantified.
- **✅ DONE 2026-06-18 (fully autonomous):** [`ue/PoFToolset/`](../ue/PoFToolset/README.md) `PoFSpikeTools` was launched in a headless UE 5.8 editor (spawned from a shell via the new [`src/lib/ue-launch`](../src/lib/ue-launch) wrapper — no human-opened editor), **discovered + registered by Epic's Toolset Registry** (`LogToolsetRegistry: Registering Toolset pof_toolset.toolsets.spike.PoFSpikeTools`), and both tools executed (`SPIKE_RESULT=PoF toolset alive | PoF on UE 5.8.0`). Temp plugin enabled via `-EnablePlugins` (no `.uproject` edit) + removed after. The authoring path is proven. **✅ MCP transport round-trip CLOSED 2026-06-18:** launched UE 5.8 headless with `ModelContextProtocol.StartServer`, connected a Node MCP client (`@modelcontextprotocol/sdk` StreamableHTTP) to `http://127.0.0.1:8000/mcp`, and `call_tool`'d `PoFScriptTools.run_python` → `{"returnValue":"pong"}` — a PoF tool callable **through Epic's server**, fully autonomously. `call_tool` args: `{ tool_name (required), toolset_name (= full python module path, e.g. `pof_toolset.toolsets.script.PoFScriptTools`), arguments }`. **Remaining:** the `RefreshTools`-vs-restart measurement (minor). Invocation gotchas captured in the plugin README + the `ue-launch` wrapper.

### Phase 1 — Wire `--mcp-config` into the app-spawned Claude (no 5.8 needed)
Add an optional MCP-config path to the spawn in `src/lib/claude-terminal/cli-service.ts` (behind a setting/flag, default off). De-risk independently of 5.8 by pointing it at **today's `MCPUnreal` (`:8090`)** first. This is the missing link that lets a harness session call UE tools directly instead of only `@@CALLBACK`.
- **Acceptance:** a harness Claude session lists + invokes a UE tool over MCP (callback path still works unchanged when the flag is off).
- **DONE 2026-06-18** (commit `059c95a`): `POF_CLI_MCP_CONFIG`-gated `--mcp-config` on autonomous spawns only; off-state byte-for-byte unchanged; tsc/eslint 0, tests green. Live acceptance pending.

### Phase 2 — Port the gap-fillers (on 5.8)
**Scoped 2026-06-18** ([`ue58-mcp-phase2-tool-map.md`](./ue58-mcp-phase2-tool-map.md)): Epic's 5.8 first-party toolsets (28 toolsets / 350+ tools) already cover ~20 of our 40 — **drop those**. Port only the **~16 PoF gap-fillers** as `@toolset_registry.tool_call` Python staticmethods, **6 ⭐ moat tools first** (`capture_viewport`, `gas_ops` mutations, `character_config`, `niagara_ops`, `input_ops`, unsandboxed `execute_script`). Build/cook/headless ops stay on the PoF bridge (Epic's MCP is editor-only). Verification stays on the `:30040` auth'd bridge.
- **Acceptance:** the gap-filler toolset loads + is callable on 5.8; the test-gate-runner still drains L3/L4 verdicts. (The DROP list's open verifications get confirmed in the Phase 0 live run.)
- **✅ Slice 1 DONE 2026-06-18** (commit `9a2d281`): 3 of the moat tools ported as Python toolsets in `ue/PoFToolset` + autonomously headless-verified — `PoFScriptTools.run_python` (unsandboxed code mode → `4`), `PoFCharacterTools.get/set_movement` (round-tripped 600/800/1.5 on a spawned `ACharacter`), `PoFInputTools.list_input_actions` (16 IA assets). All registered by Epic's Toolset Registry; `run_python` proven callable over MCP HTTP (see Phase 0 capstone).
- **✅ Slice 2 DONE 2026-06-18** (commits `579f581`, `90e4827`): the remaining 3 moat tools — `PoFNiagaraTools.list/spawn` (17 systems; spawned a component — Epic ships 0 Niagara tools), `PoFViewportTools.capture_viewport` (**71 KB PNG via `-RenderOffScreen`** — the L4 visual-gate unlock), `PoFGasTools.apply_effect`/`list_abilities` (**GAS mutation** — applied `/Script/PoF.GE_Buff_Strength` to `VSEnemy`; Epic's GAS is inspection-only). All Python (no C++ escalation needed — GAS mutation verbs are Python-exposed). **All 6 ⭐ moat gap-filler tools now ported + registered + autonomously verified.** Remaining gap-fillers (the non-⭐ PORT list in the tool map: anim_blueprint, ism, level streaming, pie/player control, network, fab, output-log, run-console) follow the same template when needed.

### Phase 3 — Decided 2026-06-19 (directions of record)

1. **Control surface → port-to-parity, bake-off, then retire.** Finish porting the remaining gap-fillers into `PoFToolset` so it reaches **functional parity** with `MCPUnreal`; run a **head-to-head bake-off** (output correctness / quality / ease-of-use) of `PoFToolset` (first-party `:8000`) vs the bespoke `MCPUnreal` (`:8090`); once parity holds, **retire the Go `mcp-unreal` proc + the `MCPUnreal` C++ HTTP routes** (redundant once parity proven). Retirement is gated on the bake-off, not assumed.
   - **✅ DONE 2026-06-19** (audit [`concepts/UE/mcp-parity-audit.md`](./concepts/UE/mcp-parity-audit.md) + bake-off [`concepts/UE/mcp-bakeoff-verdict.md`](./concepts/UE/mcp-bakeoff-verdict.md)). Ported `ism_ops` (`PoFToolset` = 10 tools / 9 toolsets); dropped Epic-covered (`pie_control`/`get_output_log`); residuals are runtime-only or unused. **Live-proven both surfaces from one 5.8 editor.** **Verdict: RETIRE — gated on ONE blocker: re-home `anim_blueprint` (C++-bound) as a C++ AICallable toolset** (or keep just that tool).
2. **In-app autonomous Claude → `:8000` official, `:8090` fallback.** Point the Phase-1 `--mcp-config` at the official MCP once 5.8 is the daily-driver; keep `:8090` as the transition fallback.
3. **Verification moat → KEEP.** The `:30040` PoF Bridge + `test-gate-runner` (L3/L4, auth, `execute_script` code-mode, harness orchestration, the autonomous L4 capture) stay — the official MCP is control-only and does NOT replace them. Do not converge the verification layer.
4. **Landing → mixed PR as-is.** PR `feature/ue58-mcp-convergence` including the interleaved concurrent `/research` commits (no history surgery).

Adjacent cleanup (do with #1/#2): the project is already on 5.8 — standardize the remaining 5.7 references (e.g. the `mcp-unreal` Go server's editor path) on 5.8.

**Next work (the #1 program):** port the long-tail PORT items from [`ue58-mcp-phase2-tool-map.md`](./ue58-mcp-phase2-tool-map.md) (anim_blueprint, ism, level-streaming, pie/player-control, network, fab, output-log) into `PoFToolset` → run the parity bake-off → retire `MCPUnreal`. Tracked in [`concepts/UE/followups.md`](./concepts/UE/followups.md).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| 5.8 + MCP are Experimental/preview | All spikes in a throwaway project; production stays on 5.7 until Phase 3 |
| Restart-to-register (no Live-Coding tool reload) | Quantify in Phase 0; batch tool changes; keep hot-iterating dev tools on the `:8090`/`:30040` HTTP path during development |
| No auth on the official MCP | Loopback-only; keep all verification/orchestration on the auth'd `:30040` bridge; never expose the control plane |
| Losing the moat in a migration | Non-goals forbid removing verification spine / `execute_script` / auth; Phase 3 is a decision gate |
| HTTP+SSE only (our `pof-mcp` is stdio) | Different layer — `pof-mcp` wraps the app API, not UE; unaffected |

## What we deliberately keep (the moat)

`execute_script` (full/unsandboxed — Epic's `execute_tool_script` is sandboxed/read-only) · `capture_viewport` (Epic ships no screenshot tool) · `gas_ops` mutations (Epic GAS only inspects) · the L3 observation.json behavioral spine + L4 Gemini visual gate · the auth'd `:30040` bridge · the SQLite authoring-truth + harness orchestration. The official MCP gives Claude *hands*; PoF keeps the *eyes and the rules*. Full tool-by-tool verdict: [`ue58-mcp-phase2-tool-map.md`](./ue58-mcp-phase2-tool-map.md).
