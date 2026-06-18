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
- **✅ DONE 2026-06-18 (fully autonomous):** [`ue/PoFToolset/`](../ue/PoFToolset/README.md) `PoFSpikeTools` was launched in a headless UE 5.8 editor (spawned from a shell via the new [`src/lib/ue-launch`](../src/lib/ue-launch) wrapper — no human-opened editor), **discovered + registered by Epic's Toolset Registry** (`LogToolsetRegistry: Registering Toolset pof_toolset.toolsets.spike.PoFSpikeTools`), and both tools executed (`SPIKE_RESULT=PoF toolset alive | PoF on UE 5.8.0`). Temp plugin enabled via `-EnablePlugins` (no `.uproject` edit) + removed after. The authoring path is proven. **Remaining:** the MCP *transport* round-trip (Claude → `:8000` → call the tool) and the `RefreshTools`-vs-restart measurement. Invocation gotchas captured in the plugin README + the `ue-launch` wrapper.

### Phase 1 — Wire `--mcp-config` into the app-spawned Claude (no 5.8 needed)
Add an optional MCP-config path to the spawn in `src/lib/claude-terminal/cli-service.ts` (behind a setting/flag, default off). De-risk independently of 5.8 by pointing it at **today's `MCPUnreal` (`:8090`)** first. This is the missing link that lets a harness session call UE tools directly instead of only `@@CALLBACK`.
- **Acceptance:** a harness Claude session lists + invokes a UE tool over MCP (callback path still works unchanged when the flag is off).
- **DONE 2026-06-18** (commit `059c95a`): `POF_CLI_MCP_CONFIG`-gated `--mcp-config` on autonomous spawns only; off-state byte-for-byte unchanged; tsc/eslint 0, tests green. Live acceptance pending.

### Phase 2 — Port the gap-fillers (on 5.8)
**Scoped 2026-06-18** ([`ue58-mcp-phase2-tool-map.md`](./ue58-mcp-phase2-tool-map.md)): Epic's 5.8 first-party toolsets (28 toolsets / 350+ tools) already cover ~20 of our 40 — **drop those**. Port only the **~16 PoF gap-fillers** as `@toolset_registry.tool_call` Python staticmethods, **6 ⭐ moat tools first** (`capture_viewport`, `gas_ops` mutations, `character_config`, `niagara_ops`, `input_ops`, unsandboxed `execute_script`). Build/cook/headless ops stay on the PoF bridge (Epic's MCP is editor-only). Verification stays on the `:30040` auth'd bridge.
- **Acceptance:** the gap-filler toolset loads + is callable on 5.8; the test-gate-runner still drains L3/L4 verdicts. (The DROP list's open verifications get confirmed in the Phase 0 live run.)

### Phase 3 — Decide (gate, not a migration)
With parity + verification proven on 5.8, decide whether to retire the Go MCP proc + `MCPUnreal` routing, keep both, or run a thin adapter. Only then touch the production engine version.

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
