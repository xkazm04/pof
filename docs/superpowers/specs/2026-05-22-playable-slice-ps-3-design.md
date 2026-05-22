---
date: 2026-05-22
status: draft
sub_project: PS-3 (arena PBR texture pass — Leonardo 2D content)
parent_initiative: PoF ARPG vertical slice — "Playable Slice" phase (PS-1 → PS-3)
predecessor_docs:
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-22-ps-2-arena.md
  - docs/superpowers/specs/2026-05-22-playable-slice-ps-2-design.md
---

# Sub-project PS-3: Arena PBR texture pass (Leonardo 2D content)

## Context

PS-2 delivered a real combat arena (`SM_Arena` + the `M_Arena_Floor/Wall/Pillar`
materials, in `/Game/Maps/VerticalSlice`). Its weakest point, recorded in the
PS-2 findings: the textures are generic PolyHaven industrial materials
(asphalt / asbestos / concrete) and the cube-projection UVs tile them ~10×, so
the arena reads as a grid rather than a themed game space.

PS-3 is the third and final sub-project of the Playable Slice phase: use the
Leonardo AI image API to generate proper themed textures and swap them into the
arena's existing materials.

A Leonardo API capability review (2026-05-22) established: Leonardo has **no
text-to-3D mesh generation**; for textures it offers a `tiling: true` parameter
on the 2D `POST /generations` endpoint (seamless tileable images) and a
separate texture-on-OBJ endpoint. PS-3 uses the **tiling 2D path** (decided in
brainstorming — reliable; the OBJ endpoint is a riskier alternative). See the
`leonardo-api-capabilities` memory for the full capability map.

## Goals

1. Generate three seamless, themed dungeon-stone textures (floor, wall, pillar)
   with the Leonardo API.
2. Swap them into the arena's existing `M_Arena_*` materials, with the tiling
   scale corrected so the arena no longer reads as a grid.
3. Confirm the slice is visually improved and still plays.

## Non-goals

- **No geometry / UV change.** PS-3 does not touch `SM_Arena` or re-UV it —
  textures only. (Re-UVing was PS-2's domain; it is out of PS-3 scope.)
- **No HUD.** A HUD needs a UMG widget Blueprint that does not exist; that is a
  separate sub-project, not PS-3.
- **No 3D / OBJ-texture endpoint.** The brainstorm chose the reliable tiling-2D
  path; the Leonardo OBJ-texture endpoint is not used here.
- **No new gameplay, no PoF app source change.** PS-3 changes UE material
  assets only.

## Decision record (from brainstorming)

1. **PS-3 = arena PBR texture pass** (chosen over a HUD pass and over both —
   the HUD's blocker is the missing UMG widget, unaffected by Leonardo).
2. **A1 — Leonardo tiling 2D textures** (chosen over A2, the OBJ 3D-texture
   endpoint). `POST /generations` with `tiling: true`; reliable, the OBJ
   endpoint is legacy-flagged and uncertain over the arena's cube-projection
   UVs.
3. Albedo is the deliverable; a matching normal map is derived from each
   albedo; roughness is kept simple.

## Design

### Part 1 — generate textures (Leonardo)

A Node script `<UE>/Content/ArenaBuild/fetch_arena_textures.mjs` calls the
Leonardo API directly (`LEONARDO_API_KEY` from `personas/.env`):

For each of **floor / wall / pillar**:
- `POST https://cloud.leonardo.ai/api/rest/v1/generations` with
  `tiling: true`, a square resolution (1024×1024), the **Lucid Realism** model
  (best for material/surface textures), and a themed prompt — e.g. floor:
  "seamless tileable dungeon stone floor, weathered flagstones, dark fantasy,
  top-down, even lighting"; wall: "seamless tileable dungeon brick wall, mossy
  carved stone"; pillar: "seamless tileable carved stone column surface".
- Poll `GET /generations/{id}`; download the resulting albedo to
  `<UE>/Content/ArenaBuild/textures_v2/{slot}_albedo.png`.

Then for each albedo, **derive a tangent-space normal map** (treat luminance as
a height field, Sobel gradient → normal) to `{slot}_normal.png`, so the stone
reads with surface relief. The derivation is a small, self-contained image step
(implementation library chosen at plan time). If the derivation proves
impractical in the available environment, the fallback is to keep PS-2's
existing normal maps — recorded as a finding; the albedo swap is the gate.

### Part 2 — apply in UE

A UE Python script `<UE>/Content/Python/retexture_arena_ue.py`:
- Imports the 3 new albedos + 3 derived normals as UE Texture2D assets under
  `/Game/ArenaBuild/Textures/` (normals as `TC_NORMALMAP`, non-sRGB).
- Updates the existing `M_Arena_Floor/Wall/Pillar` materials: repoint the
  albedo and normal `TextureSample` nodes at the new textures; insert/adjust a
  `TextureCoordinate` so the tiling scale is sensible for the arena's UVs (no
  ~10× grid). Roughness is left as a simple constant or PS-2's existing value.
- Saves the materials. `SM_Arena`, the level, and all gameplay assets are
  untouched (the materials are already assigned to the mesh's slots).

### Part 3 — verify

- **Gameplay intact:** re-run the PS-1 functional test
  (`Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest`) — it must
  still report #2–#5 green. Texturing cannot affect gameplay, but the re-run
  confirms nothing was disturbed.
- **Visual check (the real PS-3 gate):** capture a screenshot and describe it
  with Gemini vision — confirm the arena now reads as a **themed dungeon-stone
  space**, not the industrial/grid look PS-2 left. Compare against the PS-2
  Gemini description.

## Verification (of PS-3 itself)

PS-3 passes when: three themed seamless textures are generated by Leonardo and
imported; the `M_Arena_*` materials use them at a corrected tiling scale; the
PS-1 functional test re-runs green; and the Gemini visual check confirms a
themed dungeon arena rather than a grid.

## Cross-cutting

- **The UE project is now a git repo** (`github.com/xkazm04/pof-exp`, branch
  `main` — see the `ue-project-git` memory). PS-3's two scripts live in the UE
  project and are committed there directly — the per-script archiving into the
  app repo's `ps-*-artifacts/` that PS-1/PS-2 used is no longer needed.
- The PS-3 **spec, plan, and findings doc** are committed to the PoF app repo
  (`docs/superpowers/` and `docs/features/arpg-vertical-slice/scenario-runs/`),
  as before.
- **Controller-driven** — Claude authors the Leonardo + UE Python scripts; the
  harness runs them. No PoF dev server.
- Leonardo API usage consumes credits — modest (≈6 generations including a few
  retries).

## Definition of done

1. `fetch_arena_textures.mjs` generates 3 themed seamless albedo textures via
   the Leonardo API and derives 3 normal maps.
2. `retexture_arena_ue.py` imports them and updates the `M_Arena_*` materials
   with a corrected tiling scale.
3. The PS-1 functional test re-runs green (#2–#5).
4. The Gemini visual check confirms a themed dungeon arena (vs PS-2's grid).
5. A findings doc records the outcome (the prompts used, the Gemini before/after
   read, any fallback taken) under `docs/features/arpg-vertical-slice/
   scenario-runs/`.
6. Scripts committed to the UE repo (`pof-exp`); spec/plan/findings committed
   to the app repo; chat summary.

**Success criterion:** the vertical-slice arena is visibly a themed
dungeon-stone combat space — Leonardo-generated textures at a correct scale —
with the gameplay loop provably intact. This completes the Playable Slice phase
(PS-1 gray-box → PS-2 real environment → PS-3 real textures).

## Risks & mitigations

- **Leonardo `tiling` seams** — a generated texture may not be perfectly
  seamless. Mitigation: regenerate (cheap); the Gemini check would also catch
  an obvious seam.
- **Aesthetic iteration** — "dungeon stone" may take a few generations to look
  right. Mitigation: budget a few retries per slot; the Gemini check gates the
  aesthetic.
- **Normal-map derivation environment** — the luminance→normal step needs an
  image library; availability is resolved at plan time. Mitigation: documented
  fallback — keep PS-2's normal maps (the albedo swap is the gate, not the
  normal).
- **UE material-graph editing from Python** — repointing `TextureSample` nodes
  via `MaterialEditingLibrary` can be fiddly. Mitigation: if editing the
  existing graph is unreliable, rebuild the three `M_Arena_*` materials fresh
  (PS-2 already built them from scratch in Python — the same code path works).

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews and approves.
3. `writing-plans` skill → implementation plan.
4. Execute: Leonardo texture generation → UE re-texture → verify.
5. PS-3 complete → the Playable Slice phase is done. Remaining initiative
   options: the deferred real-character sub-project, or a HUD sub-project.
