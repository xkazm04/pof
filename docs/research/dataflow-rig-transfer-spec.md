# Dataflow Rig-Transfer — headless rig reuse for generated characters (spec)

> **Status: feasibility PROVEN headless (2026-07-27) — build not started.**
> Source: Epic, *"State of Rigging and Animation Tools in UE 5.8"* (Unreal Fest Chicago 2026,
> youtube `yi-oDmC1nqU`) — the Zebra→Monster rig transfer + low-res→high-res up-res — verified by
> engine-source inspection + a live headless probe on the installed UE 5.8.0.
> Probe: `<UE project>/Content/Python/rig_transfer_probe.py` (markers `POF_RIGXFER:`).

## What this is

Epic built one production rig (Zebra) and **transferred it to a different character (Monster)** —
skin weights, sculpted morph targets, DMC polygroups, skeleton — via the 5.8 Dataflow
`TransferMeshAttributes` node, and used the same tech to move a rig from a low-res working mesh to
a high-res final mesh. 5.8 Dataflow gained **skeletal-mesh authoring + Python scripting**, and the
graph API is the same `DataflowEditorBlueprintLibrary` already proven headless by the Chaos-Cloth
probes.

For PoF this is the missing **"generated mesh gets a real rig" engine**: instead of per-character
auto-rigging (MetaHuman conform = humans only + cloud auto-rig gate; Tripo rig = credits +
bind-pose fragility), transfer the rig from a template we already own (Manny, a conformed
MetaHuman, or any previously-rigged character) onto the new generated mesh — UE-native, headless,
$0. It is the in-UE generalization of the `metahuman-body-weight-transfer-garments` Blender
practice, and it works for non-humanoids (Zebra→Monster were different species).

## Proven headless (probe, 2026-07-27)

All under `-run=pythonscript -nullrhi -EnablePlugins=Dataflow,GeometryCollectionPlugin,GeometryDataflow,ChaosClothAsset,ChaosClothAssetEditor,ChaosClothAssetDataflowNodes,ControlRigDynamics`:

- `DataflowAssetFactory` + `AssetTools.create_asset` → a Dataflow asset created + saved headless.
- `DataflowEditorBlueprintLibrary.add_dataflow_node(dataflow, node_type_name, base_name, location)`
  — **all 4 args required** (`location` is `unreal.Vector2D`); returns the node **Name**.
  Node type = full struct name **with the `F` prefix** (the cloth-probe rule holds).
- All 8 node types of the transfer chain added, properties set, and the full graph connected
  (every `connect_dataflow_nodes` → True), then saved:

```
FGetSkeletalMeshDataflowNode ─▶ FSkeletalMeshToCollectionDataflowNode ─▶ FCollectionToMeshDataflowNode_v2
      (rig donor, e.g. SKM_Manny)                                              │ (source DataflowMesh)
                                                                               ▼
FGetStaticMeshDataflowNode ─▶ FStaticMeshToMeshDataflowNode_v2 ─▶ FTransferMeshAttributesDataflowNode
      (generated target mesh)             (target DataflowMesh → `Mesh` pin)   │  (SourceMesh = donor)
                                                                               ▼
                                              FMeshToSkeletalMeshTerminalNode_v2
                                    (SkeletalMeshAssetPath / SkeletonAssetPath → writes a
                                     rigged USkeletalMesh + USkeleton to /Game/...)
```

- `FTransferMeshAttributesDataflowNode` (engine source, `Dataflow` plugin `DataflowNodes` module,
  Experimental): `Mesh` = destination (in/out, modified in-place), `SourceMesh` = donor; the
  `AttributeProxies` instanced-struct array selects **SkinWeights / MorphTarget / Polygroup /
  Skeleton / TriangleLabels** proxies (per-proxy Source/Destination names).
- Also available: `FBindSkeletonToMeshDataflowNode_v2` (bind a skeleton to an unrigged mesh),
  `FGetPhysicsAssetFromSkeletalMeshDataflowNode`, `FDataflowCollectionEditSkinWeightsNode`.
- Bonus verification (same probe): the **ControlRigDynamics** plugin's full surface is
  Python-exposed (`RigUnit_SpawnDynamicsChains`/`SpawnDynamicsSolver`/`StepDynamicsSolver`,
  colliders/limits/confiners) — see the `control-rig-dynamics-secondary-motion` gotcha.

## Not yet proven (the probe-2 analog)

Graph AUTHORING is proven; **evaluation on real data is not**. Open questions, in order:
1. Does `evaluate_dataflow` / terminal invalidation on this graph transfer skin weights onto a real
   generated mesh (e.g. a Tripo/Hunyuan glb imported as StaticMesh) from SKM_Manny, and does the
   terminal write a loadable, skinned USkeletalMesh? (The cloth lesson: a mismatched test pair
   fails at evaluate with a data error, not an API error.)
2. `AttributeProxies` is a `TArray<FInstancedStruct>` — is it settable via
   `set_dataflow_node_property` string values, or does it need the node's `All` function property /
   a different call? (The transfer node has an `All` FDataflowFunctionProperty that adds every
   proxy — that may be the scriptable path.)
3. Transfer QUALITY on off-template proportions (the classic weight-transfer failure: webbing
   between limbs) — gate with mesh-critique + a posed-frame render, not authoring success.
4. Does the donor need pose alignment with the target (the Blender practice says yes)?

## Build plan (when picked up)

- `src/lib/visual-gen/dataflow-rig-transfer.ts` — mirror `chaos-cloth.ts`: a pure
  `buildRigTransferPython(donorSkelMeshPath, targetMeshPath, outSkelMeshPath)` recipe emitter +
  a dispatch via the `ue-experiment` runner with `enablePlugins: DATAFLOW_RIG_PLUGINS`; Tier-1 gate
  = terminal-written asset exists + bone/vertex-influence counts sane (probe the output with
  `get_mesh_data_for_conforming`-style introspection).
- Wire as the rig step of `character-pipeline` for non-MetaHuman characters (creatures/props with
  skeletons), and as the low→high-res up-res step after retopo/bake
  (`ai-lowpoly-generation-not-final` pairs: transfer the rig from the working mesh to the baked
  final).
- Status impact: powers-engine for the character-pipeline rigging steps (animation = the largest
  unpowered /status class).

Effort: **M-L** (the seam pattern is established; the risk is all in evaluate-time data quality).
