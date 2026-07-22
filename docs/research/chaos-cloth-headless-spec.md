# Chaos Cloth Asset (UE 5.8) as a PoF clothing-physics step — feasibility spec

> Source: /research run 2026-07-22 (Stefan 3D AI, "Easy Clothing with AI for Any Character — Best Workflow").
> Status: **ClothAsset create+save PROVEN headless (2026-07-22); graph-node wiring is the next probe.** XL. Bucket C/E.
> The one automation-loop-shaped finding from an otherwise GUI-heavy asset-gen source.

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
| Create + save ClothAsset | **YES — PROVEN 2026-07-22** | `ChaosClothAssetFactory` → `create_asset` → save → exists |
| Reach the authoring graph | **YES — PROVEN** | asset exposes `dataflow_asset` / `dataflow_terminal` |
| Add/connect the cloth Dataflow nodes | **Next probe** — `DataflowBlueprintLibrary` exposed | node types are graph-internal, not top-level classes |
| Static-Mesh / Set-Physics-Asset / Solver-Config nodes | **Next probe** (set node params via graph API) | deterministic once node-add works |
| **Transfer Skin Weights** | **Next probe — the key automatable step** | method is a reflected enum (`…TransferSkinWeightsMethod`); closest-point needs no paint |
| **Weight Map painting** | **No — brush-interactive** | residual-manual, like MHA keypoints |
| Transform-Position offset | yes (a scalar) | penetration fix |
| AccuRig rig (new-char path) | **No — GUI-only** | already declined (user-pref); use MetaHuman-conform / ARDY skeletons instead |

Realistic ceiling: a **static-garment attach** (Transfer-Skin-Weights + Transform-Position, no weight map,
no rig) is plausibly **fully headless**; a **physics garment** needs one interactive weight-paint pass
(or an acceptance that closest-point auto-transfer is "good enough" for a first cut).

## Concrete next step (probe 2 — graph-node wiring)

Probe 1 (create + save) is done. Probe 2 answers the shifted question: **can the cloth Dataflow graph be
built + driven headless?**

1. On the created `ChaosClothAsset`, get `dataflow_asset` and inspect `DataflowBlueprintLibrary` /
   `DataflowEditorBlueprintLibrary` for add-node / connect / set-param / evaluate entry points. Enumerate
   the node type names the graph accepts (they are registered graph nodes, not `unreal.*` classes — likely
   reachable by type name/string through the graph API).
2. Try to add a **Static Mesh** source node (a real generated garment: `generated/tripo3d/*.glb` imported
   as a static mesh) + a **Transfer Skin Weights** node targeting a VerticalSlice skeletal mesh (method =
   the `ChaosClothAssetTransferSkinWeightsMethod` "closest-point" enum — the no-paint path) + a
   **Set Physics Asset** node → evaluate the graph → confirm the cloth binds (a skinned render mesh exists).
3. If the graph builds + the transfer skins headless → build `src/lib/visual-gen/chaos-cloth.ts`
   (`buildClothPython` / `attachClothToCharacter`, mirroring `metahuman-conform.ts`, dispatched via the
   `ue-experiment` runner) + a Tier-1 gate (no penetration / collider set / weight-map coverage) analogous
   to `mesh-critique.ts`. The catalog-pipeline delta (candidate #5) becomes an **apparel** step wrapping this.
4. If graph-node authoring turns out to need the editor (not headless), fall back to the **static-garment**
   path (create asset + closest-point transfer, accept no weight-map) as the headless MVP, and gate
   physics-cloth behind an editor/bridge pass (like MHA's face-identity gate).

The reusable probe lives at `<UE project>/Content/Python/cloth_probe.py`.

## Blockers before building

- ~~**Live probe not yet run**~~ — **DONE 2026-07-22.** Classes resolve + ClothAsset create/save proven
  headless. Remaining feasibility question is graph-node wiring (probe 2 above), not class availability.
- **Graph-node authoring unverified** — the cloth Dataflow nodes are graph-internal; probe 2 must confirm
  `DataflowBlueprintLibrary` can add/connect/drive them headless. If not, the static-garment path is the MVP.
- **Weight-map paint is interactive** — accept closest-point auto-transfer as the headless default, or
  gate physics-cloth behind an editor/bridge pass (like MHA's face-identity gate).
- **New-character rig path is AccuRig (GUI-only)** — out of scope; feed PoF's own rigged skeletons
  (MetaHuman-conform / ARDY-retargeted Manny) as the cloth target instead.

## References
- `unreal.ChaosClothComponent` — Python API (UE 5.8): https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/ChaosClothComponent
- ChaosClothAssetDataflowNodes (5.8): https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosClothAssetDataflowNodes
- Chaos Cloth — Updates 5.8 (tutorial): https://dev.epicgames.com/community/learning/tutorials/Wb2V/unreal-engine-chaos-cloth-updates-5-8
- Precedent seams: `src/lib/visual-gen/metahuman-conform.ts`, `src/lib/visual-gen/ue-import.ts`,
  `docs/research/ardy-text-to-motion-spec.md`.
