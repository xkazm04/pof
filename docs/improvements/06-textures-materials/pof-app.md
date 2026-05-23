# 06 · Textures & Materials — PoF App Improvements

## Goals

Expose Leonardo's full API surface through PoF (`tiling` was the easy
win; ControlNet + the 3D-texture endpoint + upscaling are richer
capabilities the slice has not yet used), formalise the download-then-
delete protocol, and ship the Constant3Vector pin gotcha so future
material generation does not silently render black.

## Improvements

### 1. A Leonardo "advanced" panel in PoF

The Leonardo skill at `personas/.claude/skills/leonardo/tools/leonardo-
image.mjs` covers basic image generation + remove-bg. Build a richer
PoF-side wrapper at `src/lib/leonardo/` that exposes the documented
capabilities (see [[../../.claude/projects/.../memory/reference_leonardo_api.md]]
for the API map):

- `tiling: true` (used — keep)
- `transparency` — alpha output for icons / UI overlays
- `controlnets[]` — depth / normal / edge / pose / style / character /
  content reference; useful for "generate a texture matching this UV
  layout" or "generate an icon matching this silhouette"
- `POST /universal-upscaler` — 4× / 20-MP upscale for hero textures
- `canvas_request: INPAINT` — fix a region of an existing texture
- `unzoom` — extend a texture beyond its borders
- The 3D-texture endpoint (`/models-3d/upload` + `/generations-texture`)
  — upload a UV-mapped OBJ, get back a PBR texture set painted to its UVs

Each capability gets a single PoF UI tile under a `Leonardo Advanced`
panel, with PoF managing API keys + the standard download-then-delete
protocol.

### 2. Use the 3D-texture endpoint for the arena

The arena's `SM_Arena` is the perfect test case for the 3D-texture
endpoint: instead of generating tileable 2D textures and tiling them,
upload the arena as a UV-mapped OBJ and let Leonardo paint a coherent
PBR set onto its actual UVs. Pros: no tiling grid, normal/roughness/
albedo all generated together, mesh-specific. Cons: the endpoint is
flagged "legacy" in their docs; OBJ-only; result quality depends on UV
unwrap. Worth trying once. The arena's `build_arena.py` already exports
FBX; add an OBJ export pass (`bpy.ops.export_scene.obj`) for this.

### 3. PBR completeness — derive normals from albedo if missing

When a texture set comes back albedo-only (Leonardo's 2D `tiling` path),
PoF can derive a normal map from the albedo's luminance gradient. A
tiny Node script using `sharp` (the pof app already depends on Next.js
which ships sharp) does a Sobel filter → normal RGB. Add it as a
post-fetch step in the texture-generation flow. The PS-3 plan deferred
this; the improvement folder picks it up.

### 4. Constant3Vector gotcha → first-class in the gotchas pack

Already noted in [[../01-generation-quality/pof-app.md]] §3. The
material-configurator prompt (`src/lib/prompts/material-configurator.ts`)
must include it explicitly; the prompt's generated code must use `""`
(empty string), not `"RGB"`, on `connect_material_property` for any
`Constant3Vector` output. A vitest snapshot in `src/__tests__/prompts/`
catches a regression.

### 5. PolyHaven library browser

The PS-2 fetch script picks a PolyHaven asset blindly from a category.
A PoF panel at `src/components/modules/content/materials/PolyHaven.tsx`
shows the category's first 12 results with thumbnails (PolyHaven's API
returns thumb URLs), the operator clicks one, PoF downloads albedo +
normal + roughness. Manual curation when the operator wants something
specific; falls back to "pick first usable" for autonomous.

### 6. A texture-quality Gemini check

After any texture generation, the standard screenshot step
([[../04-hud-ui/pof-app.md]] §5) applies. For materials, capture the
texture itself (the PNG) and ask Gemini: "is this a seamless tileable
texture? Note any obvious seam, baked-in lighting, or non-tileable
feature." PS-3 used this manually; promote it to a standard post-fetch
step.

### 7. Stop reusing the asphalt PolyHaven default

PS-2 picked `aerial_asphalt_01` for the floor — industrial, not dungeon.
The PolyHaven fetch script's prompt now defaults to a *themed* search
(`"floor stone dungeon"` not `category=floor`) when the level's biome
is dungeon-themed. Biome ↔ texture-prompt mapping lives in
`src/lib/blender-mcp/scripts/level-blockout.ts` next to the biome
config.

## Verification this work succeeded

- One arena re-texture pass uses the 3D-texture endpoint and produces a
  visibly-different (non-grid) PBR set; Gemini-confirmed.
- A test ControlNet generation (e.g. a UI icon constrained to a silhouette)
  succeeds via the new PoF panel.
- Universal Upscaler is reachable from a PoF UI tile; one PS-3 texture
  upscaled to 2k produces a visibly sharper result.
- A regression-snapshot of the material-configurator prompt fails if the
  Constant3Vector pin name reverts to `"RGB"`.
