# 06 · Textures & Materials — Game Improvements

## Goals

Upgrade the slice's materials from "PS-3 albedo swap kept PolyHaven
normal/roughness" to a proper PBR set, plus a small library of reusable
master materials so future content can plug into a consistent shading
pipeline.

## Improvements

### 1. Matched PBR set on the arena

Once the 3D-texture endpoint pass lands ([[pof-app.md]] §2), `SM_Arena`
gets one coherent PBR set instead of mixed Leonardo-albedo + PolyHaven-
normal/roughness. The `M_Arena_*` materials are rebuilt to point at the
new texture set; the PS-1 functional test re-runs to confirm gameplay
is unaffected; a Gemini check confirms the surfaces read better.

If the 3D-texture endpoint isn't pursued, the fallback is the derive-
normal-from-albedo step ([[pof-app.md]] §3) — at least the normal
matches the albedo's mortar lines / cracks.

### 2. A master material pattern

Currently each material is a one-off built via `MaterialEditingLibrary`
(BaseColor + Normal + Roughness + TexCoord). Promote to a single
**`M_ARPG_Surface_Master`** master material with `VectorParameter`s for
tiling scale + colour tint + normal intensity + roughness adjust, and
3 `TextureSampleParameter2D`s for albedo/normal/rough. Materials become
`MaterialInstanceConstant`s of the master, set up via
`MaterialEditingLibrary.set_material_instance_*_value`. Future content
adds an MI per surface, not a whole material — faster to author, easier
to tweak shading globally.

The existing `Source/PoF/Materials/ARPGMasterMaterialConfig.h` (SP-B
generated) is intended for this — wire it.

### 3. Detail map for tiled surfaces

A small detail-normal/detail-noise added at high tiling rate on top of
the base PBR set breaks up the tiling-grid look without changing the
UVs. Implemented in the master material as one extra `TextureSample`
mixed in. Cheap visible polish — especially for floors viewed top-down.

### 4. A small reusable texture library at `/Game/Textures/`

After the first few generation passes, the project will accumulate a
handful of useful textures (stone floor, dungeon brick wall, metal
pillar, …). Move them into a stable `/Game/Textures/Surfaces/` library
so future levels reuse them — don't re-generate the same dungeon stone
five times. A `T_DungeonStone_01` becomes a reference asset.

The biome definitions ([[../05-environment/game.md]] §3) point at
library textures, not regenerate per dispatch.

### 5. Fix the `M_EnemyRed` material to use the master pattern

`setup_characters_ue.py` creates a one-off `M_EnemyRed` Material. Once
the master exists, replace it with an `MI_EnemyRed` instance of
`M_ARPG_Surface_Master` with `BaseColorTint = (0.7, 0.04, 0.04)` +
`Emissive` enabled. The Constant3Vector pin gotcha goes away
permanently (no manual material expression authoring needed).

### 6. Audio-cue equivalents

Not a material concern but worth flagging next to it: the project has
`ARPGSoundManager` + `ARPGAmbientSoundActor` C++ generated but no
sound assets. Either fold a small audio-sourcing capability into this
folder (PolyHaven hosts CC0 sound effects under `polyhaven.com/sounds`,
addressable via the same API the PS-2 fetch script uses), or split into
a new folder `09-audio/`. Note as a future sub-project.

## Verification this work succeeded

- `M_ARPG_Surface_Master` exists; all `M_Arena_*` and `M_EnemyRed`
  are now `MaterialInstanceConstant`s of it; the slice renders
  identically (no visual regression).
- A detail map applied to the floor visibly reduces the tiling grid
  (Gemini-confirmed).
- The `/Game/Textures/Surfaces/` library has at least 3 PBR sets
  (floor / wall / metal) that future levels can reuse.
- The PS-1 functional test still passes (gameplay unaffected by the
  material refactor).
