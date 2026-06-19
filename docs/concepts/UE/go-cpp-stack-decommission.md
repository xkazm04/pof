# Go + C++ MCP stack — decommission

**Status (2026-06-19): descoped at the repo/config level.** The bespoke UE control stack
— the Go `mcp-unreal` proc + the `MCPUnreal` C++ HTTP plugin (`:8090`) — is **retired
from PoF's active workflow** in favour of UE 5.8's first-party MCP (`:8000`, Epic toolsets
+ `PoFToolset`). Decision + evidence: [mcp-bakeoff-verdict.md](mcp-bakeoff-verdict.md).

## Done (repo, non-destructive)

- **`.mcp.json`** — removed the `mcp-unreal` stdio server; added `unreal-official` (the official MCP at `http://127.0.0.1:8000/mcp`). Kept `pof-mcp`.
- **`mcp-config.ts`** — docstring updated (the resolver is config-agnostic; no behavior change).
- The autonomous-Claude UE surface is now: **`pof-mcp`** (app API, always up) + **`unreal-official` `:8000`** (live only when a 5.8 editor is up with `ModelContextProtocol.StartServer`; a failed connect is a non-fatal warning).

## Manual physical-removal steps (do when ready — destructive, outside the repo)

These touch the **shared UE project** and an **external dir**, so they're left manual:

1. **Stop / delete the Go binary:** `~/mcp-unreal-staging/` (the `mcp-unreal.exe` + source). Nothing in the repo references it after this descope.
2. **Remove the `MCPUnreal` UE plugin:** delete `<UE project>/Plugins/MCPUnreal/`. Confirm no other consumer (the concurrent `/research` session) still relies on `:8090` first.
3. Rebuild the project once after removal to drop the C++ module.

Until step 2, `MCPUnreal` remains physically present (harmless, just unused) and can serve as a **break-glass `:8090` fallback**.

## Deferred — `anim_blueprint` C++ re-home (do ONLY if needed)

`anim_blueprint` (AnimGraph state-machine query/modify) is the one `MCPUnreal` capability `:8000` doesn't reproduce — it's **C++-bound** (a 328-line editor-only lift: `UAnimGraphNode_StateMachine`/`UAnimStateNode`/`FBlueprintEditorUtils`). **Deferred unless a real need arises**, because PoF's ABPs are **blendspace-driven** (the tool returned 0 state machines on `ABP_VSPlayer`) and ABP edits were done via Python/editor. If a genuine AnimBP-state-machine authoring need appears:
- Add a **C++ module** to `PoFToolset` (it's currently content-only Python) with a `.Build.cs` (deps: `AnimGraph`, `BlueprintGraph`, `UnrealEd`, the AICallable/ToolsetRegistry framework) + a `Module` entry in `PoFToolset.uplugin`.
- Lift `MCPUnreal/Source/MCPUnreal/Private/AnimBlueprintRoutes.cpp` into `UFUNCTION(meta=(AICallable))` methods (Epic's GAS/PCG C++ toolsets are the registration pattern).
- Compile (full build — Live Coding doesn't propagate new `AICallable` UFUNCTIONs → restart-to-register), then verify via the official MCP, then it's safe to delete `MCPUnreal` entirely.

## Note

The Go server's config still listed `ue_editor_path: UE_5.7` (`ue_installed:false`) — it connected to a running 5.8 `:8090` fine (the path only matters for auto-*launch*). Moot once the Go binary is deleted.
