# Phase 2 (slice 1) — Port PoF gap-filler tools to the official UE 5.8 MCP

**Date:** 2026-06-18 · **Status:** approved · **Plan:** [`docs/ue58-mcp-convergence-plan.md`](../../ue58-mcp-convergence-plan.md) Phase 2 · **Tool map:** [`docs/ue58-mcp-phase2-tool-map.md`](../../ue58-mcp-phase2-tool-map.md)

## Goal

Expose PoF's **gap-filler** capabilities (the ones Epic's first-party toolsets don't cover) through the official UE 5.8 MCP, as custom toolsets the Toolset Registry discovers — building on the Phase 0 proof that PoF-authored toolsets register and run. This slice ports the most tractable moat tools and verifies each fully autonomously; the heavier ones (`capture_viewport`, `gas_ops` mutations, `niagara_ops`) follow the same template next session.

## Decisions (approved)

- **Hybrid port:** Python-first (`@toolset_registry.tool_call` staticmethods), escalate an individual tool to C++ `AICallable` only if the `unreal` Python API can't express it.
- **Scope this session:** `run_python` + `character_config` (get/set) fully + autonomously verified; `list_input_actions` if smooth. Then the **MCP transport capstone**.

## Structure

Extend the proven content-only `ue/PoFToolset` plugin (keep `PoFSpikeTools` as the liveness probe). Add per-domain Python toolset modules, each `@unreal.uclass()` on `unreal.ToolsetDefinition`, registered together in `toolsets/__init__.py` via `Registration([...])`:

| Module | Toolset class | Tools |
|--------|---------------|-------|
| `toolsets/script.py` | `PoFScriptTools` | `run_python(script: str) -> str` |
| `toolsets/character.py` | `PoFCharacterTools` | `get_movement(actor_path: str) -> str`, `set_movement(actor_path: str, max_walk_speed: float, jump_z_velocity: float, gravity_scale: float) -> str` |
| `toolsets/input.py` | `PoFInputTools` | `list_input_actions() -> list[str]` |

### Tool behavior

- **`run_python`** — the *unsandboxed* "code mode" (vs Epic's sandboxed `execute_tool_script`). Execs the script in a fresh namespace with `unreal` pre-imported; returns `str(ns.get('result', ''))`. Full editor access by design (it's PoF's power-tool); the security posture is the same as the existing `:8090 execute_script`.
- **`get_movement` / `set_movement`** — resolve an editor-world actor by path/label, read/write its `CharacterMovementComponent` (`max_walk_speed`, `jump_z_velocity`, `gravity_scale`). Transient (no asset save). Returns a compact `key=value; …` string. Raises if the actor has no movement component.
- **`list_input_actions`** — AssetRegistry query for `InputAction` assets; returns their object paths. (Epic's Enhanced-Input tooling is reportedly non-functional — this is a real gap-filler.)

## Verification (per tool)

UE Python toolsets need the live `unreal` runtime, so vitest-TDD does not apply — the gate is **(a)** an editor-run `unittest` (Epic pattern, under `pof_toolset/tests/`) **and (b)** an **autonomous headless check** via the proven `ue-launch` recipe:

1. Copy `PoFToolset` into the project `Plugins/` (temp, removed after).
2. `UnrealEditor-Cmd <proj> -EnablePlugins=PythonScriptPlugin,ToolsetRegistry,PoFToolset -ExecCmds="<py>" -unattended -nopause -nosplash -nullrhi -NoLiveCoding -log -abslog=<log>`, where `<py>` is **one `py` prefix, `;`-joined, single-quoted** (`buildPythonExecCmd` rules).
3. The `<py>` calls the tool and asserts, emitting `unreal.log('POF_T2=' + outcome)`.
4. Poll the abslog for `LogPython: POF_T2=`, then kill the editor (it won't self-quit) and remove the temp plugin.

Per-tool checks:
- `run_python`: `run_python('result = 2 + 2')` ⇒ `'4'`.
- `set_movement`: spawn an `ACharacter` in the editor world, `set_movement(path, 600, 800, 1.5)`, then `get_movement(path)` ⇒ contains `max_walk_speed=600.0`.
- `list_input_actions`: returns a non-empty list including a project `IA_*` action (e.g. `IA_Move`).

## Capstone — MCP transport round-trip

Launch UE 5.8 with `ModelContextProtocol` auto-started (set the editor pref via config ini or a console enable), wait for `http://127.0.0.1:8000/mcp`, then drive the MCP HTTP protocol autonomously (curl or a tiny Node client): `initialize` → list toolsets/tools → `call_tool` `PoFScriptTools.run_python` (e.g. `result='pong'`). Success = the PoF tool returns through **Epic's server**, closing strict Phase 0 and proving the convergence end-to-end. Transport is HTTP+SSE, loopback, no auth (acceptable — local only).

## Non-goals

- `capture_viewport` (needs RHI / rendered launch), `gas_ops` mutations (needs ASC-bearing actor + ability/effect assets), `niagara_ops` — next slice.
- No C++ recompile unless a tool is blocked in Python (hybrid escalation).
- No `.uproject` edit (session-scoped `-EnablePlugins`); no asset saves (transient editor-world actors).
- No removal of the `:8090`/`:30040` bridges (still the verification/control path until convergence completes).

## Risks

- **Actor resolution in a headless editor world** — no PIE/player pawn; the verify spawns its own `ACharacter`. If the project's character class differs, fall back to the base `Character`.
- **MCP auto-start enablement** — the pref may need an ini entry rather than a CLI flag; if console-enable/ini both prove fiddly, fall back to verifying via Python remote-exec (still autonomous) and note the transport step as partially covered.
- **Restart-to-register** — new Python tools should appear after the registry re-polls; if not, an editor restart per change (already the Phase 0 cadence).
