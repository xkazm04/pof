---
subject: game-production/engine-integration-safety (resolving the anim_blueprint blocker on retiring MCPUnreal)
project: pof
raised_by: App Master charter technical-decision-capture, 2026-10-22 (headless builder, branch autopilot/technical-decision-capture-a300fa49)
source: docs/concepts/UE/mcp-bakeoff-verdict.md, mcp-parity-audit.md, go-cpp-stack-decommission.md and followups.md (all dated 2026-06-19)
stage: UE editor MCP surface (:8000 Epic toolsets + PoFToolset); the retired MCPUnreal plugin (:8090) and Go mcp-unreal proc
size: decision record only; no source or doc changed (S)
status: proposed
---

# anim_blueprint: the retire blocker is resolved by descope

## 1. How to read this

- This records a decision the evidence already supports; no source or doc was changed by this record. Status is `proposed` until the operator accepts it.
- Every fact below comes from four committed docs dated 2026-06-19. None of it was re-measured today: no UE project exists in this checkout, and nothing was run for this record.

## 2. The constraint

- The bake-off verdict (`docs/concepts/UE/mcp-bakeoff-verdict.md:7`) said RETIRE `MCPUnreal` and the Go proc, gated on one item: re-home `anim_blueprint` as a C++ AICallable toolset, or keep that single tool. Line 32 records the other nine gap-fillers as ported to `PoFToolset`; line 37 marks `anim_blueprint_query/modify` as the single C++-bound gap, and line 39 says "zero residual gaps except `anim_blueprint`".
- The parity audit (`docs/concepts/UE/mcp-parity-audit.md:14`, `:25`) explains why: AnimGraph state-machine editing is C++/editor-only, so it does not re-home as a Python toolset. It called this the one genuine retire blocker.
- `PoFToolset` is content-only Python today (`docs/concepts/UE/go-cpp-stack-decommission.md:26`), so a re-home means adding a C++ module, not another script.

## 3. The alternatives

1. **Build the C++ AICallable toolset now.** Lost for now. The decommission doc sizes it as a 328-line editor-only lift (`UAnimGraphNode_StateMachine`, `UAnimStateNode`, `FBlueprintEditorUtils`, `go-cpp-stack-decommission.md:24`) plus a new C++ module, `.Build.cs` and `.uplugin` entry. `followups.md:16` calls it "a real chunk of work". The cost is real and no need for it has been demonstrated.
2. **Keep MCPUnreal alive for that one tool.** Moot. The plugin and the Go binary were both physically deleted on 2026-06-19 (`go-cpp-stack-decommission.md:15-18`), recoverable only from the UE project's git history and by re-cloning the Go repo.
3. **Drop and defer.** Chosen.

## 4. The decision

The blocker is resolved by descope. `anim_blueprint` is dropped, and the C++ re-home is deferred until a genuine AnimBP-state-machine authoring need appears. The grounds, from `followups.md:20` and `go-cpp-stack-decommission.md:24`: PoF's ABPs are blendspace-driven, the tool returned 0 state machines on `ABP_VSPlayer`, and ABP edits were done via Python/editor. That reading is from 2026-06-19 and was not re-checked.

## 5. What would reopen it

A real need to author or read AnimBP state machines (for example, a state-machine ABP replacing blendspace-driven locomotion). The re-home steps are in `go-cpp-stack-decommission.md:25-28` (the C++ module, the `.Build.cs` and `.uplugin` entries, lifting `AnimBlueprintRoutes.cpp`, a full build rather than Live Coding); they are not restated here.

## 6. What this does NOT decide

- Nothing about the `:30040` bridge (`PillarsOfFortuneBridge`).
- Nothing about the L3/L4 verification spine.
- Nothing about the production project's engine version.
