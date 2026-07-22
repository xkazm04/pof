# Chaos Cloth Asset (UE 5.8) as a PoF clothing-physics step — feasibility spec

> Source: /research run 2026-07-22 (Stefan 3D AI, "Easy Clothing with AI for Any Character — Best Workflow").
> Status: **Headless authoring PROVEN end-to-end (2026-07-22) — create asset + build the full cloth
> Dataflow graph + regenerate, all headless via Python. Ready to BUILD `chaos-cloth.ts`.** XL. Bucket C/E.
> The one automation-loop-shaped finding from an otherwise GUI-heavy asset-gen source.

## PROBE 2 RESULT — 2026-07-22 (live, UE 5.8, `-nullrhi`) — the cloth Dataflow graph builds headless

The graph-editing API is `DataflowEditorBlueprintLibrary` (author) + `DataflowBlueprintLibrary` (drive),
both Python-exposed. Full chain built + driven headless (`Content/Python/cloth_probe2d.py`):

- **`add_dataflow_node(dataflow, node_type_name, base_name, location) -> Name`** — added all 4 nodes.
  **Node type name = the full struct name WITH the `F` prefix** (`FChaosClothAssetStaticMeshImportNode`,
  `FChaosClothAssetTransferSkinWeightsNode`, `FChaosClothAssetSetPhysicsAssetNode`,
  `FChaosClothAssetTerminalNode`); the un-prefixed name returns an empty Name.
- **`set_dataflow_node_property(dataflow, node, property, value:str) -> True`** — set `StaticMesh`,
  `SkeletalMesh`, `PhysicsAsset` (asset refs pass as **object-path strings**).
- **`connect_dataflow_nodes(dataflow, from, out_pin, to, in_pin) -> True`** — chained
  StaticMeshImport `Collection` → TransferSkinWeights `Collection` → SetPhysicsAsset `Collection` →
  Terminal **`CollectionLod0`** (the terminal's LOD-0 input pin; the display name "Collection LOD 0" does
  NOT work as the pin key — use the property name `CollectionLod0`).
- **`regenerate_asset_from_dataflow(clothAsset, False) -> True`** — the ClothAsset regenerated from the graph.
- `evaluate_dataflow -> False` **on this test only**: I fed a Hunyuan blob mesh → a Jedi skeleton (no
  spatial correspondence), so `TransferSkinWeightsNode: Transferring skin weights failed` — a **data**
  mismatch (garbage-in), not an API limit. The node executed headless; a real garment fitted to the target
  skeleton (what the pipeline produces per-character) is the correct input.

**Verdict: the entire authoring graph is scriptable headless.** No feasibility blocker remains for the
auto-skin / static-garment path. Remaining is build work: feed a real fitted garment, pick `TransferMethod`
(`EChaosClothAssetTransferSkinWeightsMethod` — `InpaintWeights` default vs closest-point), and add the
weight-map / solver-config nodes for a physics garment.

### Exact recipe (for the build)
```
udf   = AssetTools.create_asset("DF", path, None, DataflowAssetFactory())
n_sm  = DFEBL.add_dataflow_node(udf, "FChaosClothAssetStaticMeshImportNode",     "SMImport",   Vector2D())
n_tsw = DFEBL.add_dataflow_node(udf, "FChaosClothAssetTransferSkinWeightsNode",  "XferWeights",Vector2D())
n_ph  = DFEBL.add_dataflow_node(udf, "FChaosClothAssetSetPhysicsAssetNode",      "SetPhys",    Vector2D())
n_tm  = DFEBL.add_dataflow_node(udf, "FChaosClothAssetTerminalNode",             "Terminal",   Vector2D())
DFEBL.set_dataflow_node_property(udf, n_sm,  "StaticMesh",   "<garment SM object path>")
DFEBL.set_dataflow_node_property(udf, n_tsw, "SkeletalMesh", "<target SKM object path>")   # weight source
DFEBL.set_dataflow_node_property(udf, n_ph,  "PhysicsAsset", "<PA object path>")
DFEBL.connect_dataflow_nodes(udf, n_sm,  "Collection", n_tsw, "Collection")
DFEBL.connect_dataflow_nodes(udf, n_tsw, "Collection", n_ph,  "Collection")
DFEBL.connect_dataflow_nodes(udf, n_ph,  "Collection", n_tm,  "CollectionLod0")
cloth = AssetTools.create_asset("CA", path, None, ChaosClothAssetFactory())
DFBL.regenerate_asset_from_dataflow(cloth, False)   # or evaluate_dataflow(udf, cloth)
```
Reusable probes: `<UE project>/Content/Python/cloth_probe.py` (probe 1, class/create) +
`cloth_probe2d.py` (probe 2, full graph).

## PROBE RESULT — 2026-07-22 (live, installed UE 5.8, `-nullrhi`)

Ran `Content/Python/cloth_probe.py` via `UnrealEditor-Cmd PoF.uproject -run=pythonscript
-script=<ABS path> -EnablePlugins=ChaosClothAsset,ChaosClothAssetEditor,ChaosClothAssetDataflowNodes
-nullrhi -unattended -nopause -abslog=<log>`. **VERDICT: AUTHORABLE.** Findings:

- **Plugins load headless under `-nullrhi`** — `ChaosClothAsset` / `ChaosClothAssetEngine` /
  `ChaosClothAssetTools` / `ChaosClothAssetDataflowNodes` / `ChaosClothAssetEditor(Core)` all mount + load.
- **All decisive classes resolve** (70 cloth/dataflow classes exposed): `ChaosClothComponent`,
  `ChaosClothAsset`, `ChaosClothAssetFactory`, `DataflowSimulationAsset`, `Dataflow` — all present.
- **Create + save a ClothAsset headless WORKS:** `ChaosClothAssetFactory()` → `AssetTools.create_asset(...)`
  → a real `ChaosClothAsset` → `save_loaded_asset` → `does_asset_exist` **True** (probe asset then deleted).
  So the "create the Cloth Asset" step is no longer a question — it is proven headless.
- **The authoring graph is reachable on the asset:** the `ChaosClothAsset` exposes `dataflow_asset` +
  `dataflow_terminal` properties — the Dataflow graph that drives the cloth is a property on the asset,
  accessible from Python.
- **Transfer-skin-weights is reflected as API enums:** `ChaosClothAssetTransferSkinWeightsMethod`,
  `ChaosClothAssetTransferTargetMeshType`, `ChaosClothAssetTransferRenderMeshSource` are exposed — the two
  transfer methods from the video are API-level values.
- **`DataflowBlueprintLibrary` + `DataflowEditorBlueprintLibrary` are exposed** — the plausible path to
  programmatically add/connect/evaluate graph nodes (StaticMesh → TransferSkinWeights → SetPhysicsAsset).

**Residual boundary (shifted, not removed):** the specific cloth Dataflow NODE types (StaticMesh /
TransferSkinWeights / WeightMap / SetPhysicsAsset) are **not** top-level `unreal.*` python classes — they
live inside the Dataflow graph and must be added via the Dataflow graph-editing API (`DataflowBlueprintLibrary`)
or an editor pass. So the open question moved from *"can we create the asset?"* (now **YES**) to *"can we
add + connect the specific cloth nodes + drive the transfer headless?"* — the next probe. Weight-map
**painting** stays brush-interactive regardless.

**Launch gotcha discovered:** `-run=pythonscript -script=<relative>` resolves the path against the engine
`Binaries/Win64` CWD, **not** the project — the first run failed to find `Content/Python/cloth_probe.py`.
Pass an **absolute** `-script=` path (or set CWD to the project). Plugins enable fine via a comma-list
`-EnablePlugins=A,B,C` under `-nullrhi`.

## Why this matters

PoF's character pipeline covers **2D → 3D mesh → MetaHuman-conform rig → ARDY/retarget animation → UE**,
but has **no clothing/apparel modality at all** — generated characters wear only baked-in geometry, never
simulated garments. UE 5.8 makes clothing physics dramatically more automatable than before: the
node-based **Chaos Cloth Asset** editor is now the default/production cloth path (replacing the old
per-mesh clothing-data tabs), and **5.8 Dataflow added Python scripting support**, with a Python-exposed
`unreal.ChaosClothComponent` (`simulation_asset` → `DataflowSimulationAsset`). That is the same
"the authoring API loads/scripts headless" signal that unblocked **MetaHuman conform** and **ARDY import**.

If the ClothAsset Dataflow graph can be built + parameterized headless, PoF gains a **garment → ClothAsset
→ attach-to-character** step — its first clothing capability, and a natural extension of `metahuman-conform.ts`
/ `ue-import.ts`.

## The workflow to automate (from the source)

The reusable core is a small Dataflow node chain (captured in the `chaos-cloth-asset-5-8-workflow`
UE_GOTCHAS entry):

1. Create Cloth Asset **from a preset** ("Static Mesh Cloth") — never empty.
2. **Static Mesh** node → garment mesh for both simulation + render.
3. Preview-scene Skeletal Mesh = the target character.
4. **Transfer Skin Weights** node → auto-skins the garment to the character (two methods: skinning vs
   closest-point-on-surface). **This replaces most manual weight painting — it is the automatable core.**
5. **Weight Map** node → paints where/how-strongly physics applies (brush/vertex — interactive).
6. **Set Physics Asset** node → the collider the cloth interacts with (reuse the character's).
7. **Simulation Solver Config** → iteration count.
8. **Transform Position** node at the chain end → fixes cloth clipping into the body.

Three delivery shapes the source demonstrates, all reusing one saved graph:
- **new character** (full AccuRig rig first — GUI-only, off-domain for PoF),
- **existing character** (duplicate the cloth asset, re-point Transfer-Skin-Weights at the new char),
- **static garment, no physics** (only Transfer-Skin-Weights + Transform-Position — no rig step).

## What is automatable vs interactive (the honest boundary)

| Step | Headless-scriptable? | Notes |
|------|----------------------|-------|
| Create + save ClothAsset | **YES — PROVEN (probe 1)** | `ChaosClothAssetFactory` → `create_asset` → save → exists |
| Add the cloth Dataflow nodes | **YES — PROVEN (probe 2)** | `add_dataflow_node` w/ F-prefixed struct name |
| Set node asset properties | **YES — PROVEN (probe 2)** | `set_dataflow_node_property`, asset ref = object-path string |
| Connect the graph pins | **YES — PROVEN (probe 2)** | `connect_dataflow_nodes`; terminal pin = `CollectionLod0` |
| Regenerate the ClothAsset from the graph | **YES — PROVEN (probe 2)** | `regenerate_asset_from_dataflow` → True |
| **Transfer Skin Weights execution** | **runs headless** — needs a fitted garment | `TransferMethod` enum; failed on mismatched test data only |
| **Weight Map painting** | **No — brush-interactive** | residual-manual, like MHA keypoints |
| Transform-Position offset | yes (a scalar) | penetration fix |
| AccuRig rig (new-char path) | **No — GUI-only** | already declined (user-pref); use MetaHuman-conform / ARDY skeletons instead |

Realistic ceiling: a **static-garment attach** (Transfer-Skin-Weights + Transform-Position, no weight map,
no rig) is plausibly **fully headless**; a **physics garment** needs one interactive weight-paint pass
(or an acceptance that closest-point auto-transfer is "good enough" for a first cut).

## Build status — seam SCAFFOLDED 2026-07-22

**`src/lib/visual-gen/chaos-cloth.ts` is built + unit-tested** (mirrors `metahuman-conform.ts`):
- `buildClothGraphPython(opts)` — pure; emits the proven recipe (4 F-prefixed nodes → set
  StaticMesh/SkeletalMesh/PhysicsAsset → connect with the terminal `CollectionLod0` pin → save →
  `regenerate_asset_from_dataflow` + `evaluate_dataflow`). Optional garment-glb import (like conform) or an
  existing /Game static mesh; optional `transferMethod` (closest-point for the no-paint MVP).
- `attachClothToCharacter(opts)` — dispatches via the `ue-experiment` runner, **declares
  `CHAOS_CLOTH_PLUGINS` via the new `enablePlugins` runner option** (no global `.uproject` edit), parses the
  `POF_CLOTH_*` markers, and returns a layered `ClothResult`. **`bound` (from `evaluate_dataflow`) is the
  Tier-1 gate** — false ⇒ the garment isn't fitted to the target skeleton (the honest failure reason).
- Runner change: `ExperimentSpec.enablePlugins` + `buildExperimentArgs` merge extra plugins into the
  `-EnablePlugins` flag. TDD: 13 cloth tests + 2 runner tests; full ue-experiment + visual-gen suites green
  (157); tsc/eslint clean.

**Remaining (not yet done):**
1. **Live run** — `attachClothToCharacter` has NOT been run end-to-end on the editor yet; needs a real
   garment mesh **fitted to the target skeleton** (the probe's mismatched pair only proved the mechanism).
   The pipeline's per-character mesh output is the intended garment source.
2. **`apparel` catalog step** (candidate #5) wrapping the seam: garment → ClothAsset → attach.
3. **Weight-map painting stays interactive** — the MVP is auto skin-weight transfer only; a physics garment
   that needs region weighting is the one editor/bridge-gated part (add WeightMap / SolverConfig nodes to
   the graph the same way once needed).

Reusable probes: `<UE project>/Content/Python/cloth_probe.py` (probe 1) + `cloth_probe2d.py` (probe 2, the
full graph recipe).

## Blockers before building

- ~~**Live probe not yet run**~~ — **DONE 2026-07-22.** Classes resolve + ClothAsset create/save proven.
- ~~**Graph-node authoring unverified**~~ — **DONE (probe 2).** add / set-property / connect / regenerate
  all proven headless via `DataflowEditorBlueprintLibrary` + `DataflowBlueprintLibrary`.
- **Real fitted-garment input needed** — the transfer failed on a mismatched test pair; the build must feed
  a garment mesh actually fitted to the target skeleton (the pipeline's per-character mesh output).
- **Weight-map paint is interactive** — the MVP uses auto skin-weight transfer (no paint); gate physics
  region-weighting behind an editor/bridge pass (like MHA's face-identity gate).
- **New-character rig path is AccuRig (GUI-only)** — out of scope; feed PoF's own rigged skeletons
  (MetaHuman-conform / ARDY-retargeted Manny) as the cloth target instead.

## References
- `unreal.ChaosClothComponent` — Python API (UE 5.8): https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/ChaosClothComponent
- ChaosClothAssetDataflowNodes (5.8): https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes
- Chaos Cloth — Updates 5.8 (tutorial): https://dev.epicgames.com/community/learning/tutorials/Wb2V/unreal-engine-chaos-cloth-updates-5-8
- Precedent seams: `src/lib/visual-gen/metahuman-conform.ts`, `src/lib/visual-gen/ue-import.ts`,
  `docs/research/ardy-text-to-motion-spec.md`.
