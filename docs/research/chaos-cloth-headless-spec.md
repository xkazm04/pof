# Chaos Cloth Asset (UE 5.8) as a PoF clothing-physics step — feasibility spec

> Source: /research run 2026-07-22 (Stefan 3D AI, "Easy Clothing with AI for Any Character — Best Workflow").
> Status: **NOT built — feasibility WEB-CONFIRMED, needs a live headless probe.** XL. Bucket C/E.
> The one automation-loop-shaped finding from an otherwise GUI-heavy asset-gen source.

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
| Create ClothAsset from preset | **Probe** — likely yes (Dataflow python) | mirror `metahuman-conform.ts` seam |
| Static-Mesh / Set-Physics-Asset / Solver-Config nodes | **Probe** — likely yes (set node params) | deterministic graph wiring |
| **Transfer Skin Weights** | **Probe — the key automatable step** | auto-skin; closest-point method needs no paint |
| **Weight Map painting** | **No — brush-interactive** | residual-manual, like MHA keypoints |
| Transform-Position offset | yes (a scalar) | penetration fix |
| AccuRig rig (new-char path) | **No — GUI-only** | already declined (user-pref); use MetaHuman-conform / ARDY skeletons instead |

Realistic ceiling: a **static-garment attach** (Transfer-Skin-Weights + Transform-Position, no weight map,
no rig) is plausibly **fully headless**; a **physics garment** needs one interactive weight-paint pass
(or an acceptance that closest-point auto-transfer is "good enough" for a first cut).

## Concrete next step (the reconsider trigger)

A single live headless introspection probe on the installed UE_5.8.0, exactly like the MetaHuman-conform /
Animator probes:

1. `-run=pythonscript -nullrhi` with `-EnablePlugins` for the Chaos Cloth Asset plugins
   (`ChaosClothAsset*`, `ChaosClothAssetDataflowNodes`). Confirm the classes resolve headless
   (`unreal.ChaosClothComponent`, the Dataflow asset + cloth Dataflow node types).
2. Try to **create a ClothAsset from a preset and wire the Static-Mesh + Transfer-Skin-Weights +
   Set-Physics-Asset nodes** on a real generated garment (`generated/tripo3d/*.glb` or a Hunyuan shape)
   against a VerticalSlice skeletal mesh — save the asset, check `does_asset_exist`.
3. If it saves + skins headless → build `src/lib/visual-gen/chaos-cloth.ts` (`buildClothPython` /
   `attachClothToCharacter`, mirroring `metahuman-conform.ts`, dispatched via the `ue-experiment` runner)
   + a Tier-1 gate (no penetration / collider set / weight-map coverage) analogous to `mesh-critique.ts`.
   The catalog-pipeline delta (candidate #5) becomes an **apparel** step wrapping this.

## Blockers before building

- **Live probe not yet run** — the Dataflow-python + ChaosClothComponent signal is doc-level, not
  ground-truthed on our project (the MetaHuman-conform run showed release-notes optimism must be verified).
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
