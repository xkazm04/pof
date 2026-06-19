# Go + C++ MCP stack — decommission

**Status (2026-06-19): descoped at the repo/config level.** The bespoke UE control stack
— the Go `mcp-unreal` proc + the `MCPUnreal` C++ HTTP plugin (`:8090`) — is **retired
from PoF's active workflow** in favour of UE 5.8's first-party MCP (`:8000`, Epic toolsets
+ `PoFToolset`). Decision + evidence: [mcp-bakeoff-verdict.md](mcp-bakeoff-verdict.md).

## Done (repo, non-destructive)

- **`.mcp.json`** — removed the `mcp-unreal` stdio server; added `unreal-official` (the official MCP at `http://127.0.0.1:8000/mcp`). Kept `pof-mcp`.
- **`mcp-config.ts`** — docstring updated (the resolver is config-agnostic; no behavior change).
- The autonomous-Claude UE surface is now: **`pof-mcp`** (app API, always up) + **`unreal-official` `:8000`** (live only when a 5.8 editor is up with `ModelContextProtocol.StartServer`; a failed connect is a non-fatal warning).

## Physical removal — ✅ DONE 2026-06-19

Both deleted (recoverable):
1. **Go binary/staging** — `~/mcp-unreal-staging/` deleted. Recoverable by re-cloning `https://github.com/remiphilippe/mcp-unreal.git`.
2. **`MCPUnreal` UE plugin** — `<UE project>/Plugins/MCPUnreal/` deleted (only `PillarsOfFortuneBridge` — the `:30040` moat — remains). It was git-tracked in the UE project (39 source files), so the deletion is **recoverable via UE git history** (`git checkout -- Plugins/MCPUnreal`). The deletions were left **unstaged** in the UE working tree (branch `feature/arpg-movement-feel`, which also holds the concurrent session's UE WIP) — to be committed by that session alongside their changes; this repo did not commit into the shared UE git.

**Clean removal — no follow-up needed:** `PoF.uproject` did **not** reference `MCPUnreal` (it was auto-discovered, not pinned) and no UE `Source/` module depended on it → no dangling references, no `.uproject` edit, no rebuild required to avoid errors.

## Deferred — `anim_blueprint` C++ re-home (do ONLY if needed)

`anim_blueprint` (AnimGraph state-machine query/modify) is the one `MCPUnreal` capability `:8000` doesn't reproduce — it's **C++-bound** (a 328-line editor-only lift: `UAnimGraphNode_StateMachine`/`UAnimStateNode`/`FBlueprintEditorUtils`). **Deferred unless a real need arises**, because PoF's ABPs are **blendspace-driven** (the tool returned 0 state machines on `ABP_VSPlayer`) and ABP edits were done via Python/editor. If a genuine AnimBP-state-machine authoring need appears:
- Add a **C++ module** to `PoFToolset` (it's currently content-only Python) with a `.Build.cs` (deps: `AnimGraph`, `BlueprintGraph`, `UnrealEd`, the AICallable/ToolsetRegistry framework) + a `Module` entry in `PoFToolset.uplugin`.
- Lift `MCPUnreal/Source/MCPUnreal/Private/AnimBlueprintRoutes.cpp` into `UFUNCTION(meta=(AICallable))` methods (Epic's GAS/PCG C++ toolsets are the registration pattern).
- Compile (full build — Live Coding doesn't propagate new `AICallable` UFUNCTIONs → restart-to-register), then verify via the official MCP, then it's safe to delete `MCPUnreal` entirely.

## Note

The Go server's config still listed `ue_editor_path: UE_5.7` (`ue_installed:false`) — it connected to a running 5.8 `:8090` fine (the path only matters for auto-*launch*). Moot once the Go binary is deleted.
