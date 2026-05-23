# 06 · Textures & Materials

## Scope

Texture sourcing (PolyHaven, Leonardo, downloads), material authoring
(PBR maps, material instances, master materials), the
`MaterialEditingLibrary` UE Python toolchain, and the related material
expression conventions. Sits next to but separate from environment (05) —
this folder is *what surfaces look like*; environment is *what the
geometry is*.

## Current state

After PS-2 + PS-3 (2026-05-21 → 2026-05-22):

- The arena's three materials (`M_Arena_Floor`, `M_Arena_Wall`,
  `M_Arena_Pillar`) are built procedurally from UE Python — albedo +
  normal + roughness `TextureSample`s wired to BaseColor / Normal /
  Roughness, plus a shared `TextureCoordinate` for tiling scale.
- Texture sources used: **PolyHaven** (PS-2, asphalt / asbestos /
  concrete — generic industrial fallback) → **Leonardo `tiling: true`
  2D generation** (PS-3, themed dungeon stone — large visible improvement).
  Each Leonardo generation is download-then-deleted to keep the cloud
  account clean.
- The enemy's `M_EnemyRed` material is a tiny procedural Material
  (`Constant3Vector` → BaseColor + emissive) created by
  `setup_characters_ue.py`. **A subtle bug bit there:**
  `MaterialExpressionConstant3Vector`'s output pin is `""`, not `"RGB"` —
  `connect_material_property("RGB", ...)` silently returns `false` and
  produces a black material.
- The Leonardo *advanced* API is mostly unused: ControlNet (11 types),
  upscaling (Universal Upscaler up to 20 MP), inpainting/outpainting,
  custom-model training, **and the 3D-texture endpoint** (upload a
  UV-mapped OBJ, get PBR maps painted onto the mesh's UVs). The
  `leonardo-api-capabilities` memory documents what's available; this
  folder is where to plan using it.

## Key lessons

1. **Leonardo `tiling: true` produces seamless 2D textures cleanly.**
   Lucid Realism for surfaces, Lucid Origin for icons/UI. The
   PS-3 fetch script is a working reference.
2. **Download-then-delete is the right protocol** — store the result
   locally and delete the Leonardo generation so the account doesn't
   accumulate working assets. Codified in `feedback_leonardo_cleanup.md`.
3. **`Constant3Vector` pin name `""` not `"RGB"`** — a real UE-Python
   pitfall that produces a silently-black material. Captured in the
   gotchas pack.
4. **PBR completeness matters even at slice quality.** PS-3 took the
   spec's documented fallback (albedo only, kept PolyHaven normal /
   roughness). The result looks fine but not as good as a matched
   PBR set; future passes either use Leonardo's 3D-texture endpoint
   or derive a normal-from-albedo step.
5. **PolyHaven's free CC0 texture library** is a reliable fallback when
   Leonardo isn't a fit — PS-2 proved it. The fetch script pattern is
   reusable.

## Isolated-CLI session focus

A session works on:
- **UE project:** `Content/ArenaBuild/`, `Content/Materials/`,
  `Content/Python/build_arena_ue.py` (the material-build section),
  `Content/Python/setup_characters_ue.py` (the `M_EnemyRed` material).
- **PoF app:** `src/components/modules/content/materials/`,
  `src/components/modules/visual-gen/leonardo/`, the Leonardo skill
  (`personas/.claude/skills/leonardo/`) integration points,
  `src/lib/prompts/material-configurator.ts`.

It does *not* touch geometry (folder 05 — closely paired but separate),
characters, HUD, or combat.
