# 06 · Textures & Materials — Test Coverage

## What we have

- PS-3 fetch script (the Leonardo download-then-delete loop) ran cleanly
  on first try.
- The Gemini check after PS-3 confirmed the textures read as themed
  dungeon stone, not industrial/grid.
- No dedicated material tests in the project.

## Tests to add — UE side (`AFunctionalTest`s + content checks)

1. **`AVSArenaMaterialBindingTest`** — for each arena material slot on
   `SM_Arena`, asserts the bound material is non-null, has a valid
   albedo texture parameter or texture sample, and the sampler is set
   non-sRGB for normal/roughness as expected. Detects the PS-2 sampler-
   type regression class (where a normal sampled as sRGB would render
   washed out).
2. **`AVSMaterialPinConnectionTest`** — constructs a `Material` in-memory
   via `MaterialFactoryNew`, adds a `Constant3Vector`, calls
   `connect_material_property(node, "", MP_BASE_COLOR)`; asserts the
   connection succeeded (returned `true`). The same call with `"RGB"`
   should return `false`. Codifies the Constant3Vector gotcha as a
   regression test.
3. **`AVSMasterMaterialInstanceTest`** — after [[game.md]] §2 lands,
   asserts each `M_Arena_*` is a `MaterialInstanceConstant` of
   `M_ARPG_Surface_Master` (`mi.parent.get_path_name() == master_path`).
   Detects "someone re-created a one-off material" regressions.

## Tests to add — PoF app side

1. **Leonardo-API-call snapshot tests** — vitest snapshots of the
   `generate(prompt, model, params)` calls for each known capability
   (`tiling`, `transparency`, `controlnets`, `3d-texture-upload`,
   `universal-upscaler`). Detects parameter-name regressions if the
   API surface changes.
2. **Download-then-delete protocol test** — vitest asserts every Leonardo
   API caller in the codebase wraps its generation in a `finally` that
   calls `DELETE /generations/{id}`. A naive grep test over `src/lib/
   leonardo/` flags any non-conforming call site.
3. **Material-configurator prompt snapshot** — asserts the prompt emits
   `""` (empty pin name) for `Constant3Vector`. Reverts to `"RGB"` fails
   the test.
4. **PolyHaven biome-prompt mapping test** — asserts each biome in
   `level-blockout.ts` has a non-empty texture-search prompt and a
   sensible category-search fallback. Stops the asphalt regression.

## E2E harness extensions

1. **`texture-pass.spec.ts`** — fresh UE project: dispatch Leonardo
   tileable generation for floor/wall/pillar; run PS-3's re-texture flow;
   re-run the PS-1 functional test green; Gemini-confirm themed dungeon
   stone. End-to-end success criterion for "texture pass."
2. **`texture-pass-3d-endpoint.spec.ts`** — alternative path: dispatch
   the OBJ-upload Leonardo 3D-texture flow; verify the resulting PBR
   set imports + applies cleanly. Compares the two paths' Gemini reads
   side-by-side.

## Lessons that motivate each test

- **The Constant3Vector pin name silently returned false.** The pin-
  connection functional test reproduces it deterministically; the
  prompt snapshot prevents prompts from re-emitting `"RGB"`.
- **PS-3's download-then-delete was a user-stated requirement.** The
  greppable protocol test stops a regression where a future caller
  forgets the `DELETE`.
- **PS-2 used asphalt; PS-3 chose better via Leonardo.** The biome-prompt
  mapping test ensures every biome has a thoughtful default search
  string, so the autonomous path still picks reasonable PolyHaven
  textures even when Leonardo is unavailable.
- **The 3D-texture endpoint is unproven in this project** — the e2e spec
  for it produces a concrete artifact to compare, turning "we should
  try it" into "we tried it and here's the Gemini read."

## What this folder does *not* test

Geometry / UV strategy (folder 05 — closely paired), characters and AI
(folder 02), gameplay abilities (folder 03), HUD (folder 04), packaging
(folder 07).
