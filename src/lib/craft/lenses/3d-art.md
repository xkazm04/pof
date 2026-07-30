---
lensId: 3d-art
lensVersion: 1
ceiling: A2
appliesTo: 3d-art deliverables
---

# 3D Game Assets — craft lens

Gauges PoF's generative 3D output — Tripo image-to-3D meshes run through game-tier conversion
and UE Interchange import — against real studio asset standards: silhouette, topology, UVs,
texel density, PBR materials, bakes, and engine budgets. Every criterion is checkable against a
stored .glb (face/vertex/texture counts, bounds) plus its metadata and rendered views, with a
VLM assisting visual reads. PoF canon: single-player dark-fantasy ARPG.

## Benchmark anchors

- **A4 AAA-PARITY** — Naughty Dog's *Uncharted 4* / *The Last of Us Part II* asset work,
  Guerrilla's *Horizon Zero Dawn* environment and character assets, Blizzard's *Diablo IV*
  hero and gear art: sculpted high-poly sources, art-directed material storytelling, rigorous
  budget engineering. **Described for orientation only — this level is above the recorded A2
  ceiling for this lens, and the assumption is recorded as permanent.**
- **A3 AA** — professional mid-scale production such as *Path of Exile* gear/character assets or
  accepted Valve *Dota 2* Workshop items built to Valve's published budgets: clean retopology,
  authored bakes, consistent texel density — professional, but without the named
  AAA-differentiating sculpt and material depth above. Also above this lens's ceiling.
- **A2 INDIE** — shippable small-team 3D in the vein of *Valheim*'s deliberately budgeted,
  style-consistent assets: correct scale and orientation in engine, sane budgets, materials that
  read correctly, with systematic gaps versus professional retopology and bake craft. **This is
  the achievable roof for generative 3D under this lens.**
- **A1 HOBBY** — assets that would not survive a professional review: broken shading, wildly
  inconsistent texel density, no budget awareness, wrong scale in engine, raw unconverted scans.

## Criteria

### silhouette-form-fidelity — Silhouette and form fidelity
The mesh's silhouette must be clean and must match its source concept/image: identifiable
object class, no lumps, holes, or amputated forms visible in outline from the four cardinal
views. Valve's character art guidance makes silhouette identifiability the first gate for
accepting a model. Check rendered turnaround views of the stored .glb against the source image.
Source: Valve, "Dota 2 Workshop — Character Art Guide" (published Steam Workshop guide).

### triangle-budget-discipline — Triangle budget discipline
The asset must carry a recorded budget class in metadata (e.g. hero prop / gear / clutter) and
its triangle and vertex counts must sit within that class; Valve publishes explicit per-item
triangle budgets and notes budgets are counted in triangles. Polycount's standard adds that
in-engine vertex count (after UV/normal splits) is the real cost, so record both. A count with
no recorded budget intent, or 10x over class, fails.
Source: Valve, "Dota 2 Workshop — Item Model Requirements"; Polycount Wiki, "Polygon Count".

### topology-shading-integrity — Topology and shading integrity
Shading must be smooth where forms are smooth and hard where forms are hard: no faceting
artifacts, black-triangle smoothing errors, degenerate/zero-area faces, or non-manifold shells
visible in renders or detectable in the .glb. Polycount's normal-mapping standard requires hard
edges to coincide with UV splits so low-poly shading stays consistent. Generative meshes
typically fail here first — gauge renders plus mesh statistics.
Source: Polycount Wiki, "Normal Map Modeling".

### uv-texel-density-consistency — UV and texel density consistency
UVs must be non-overlapping in the 0–1 tile (mirrored shells offset), and texel density must be
consistent across the asset within a documented target (the widely used baseline is ~10.24
px/cm at 1024px/m; the target itself matters less than recording it and holding it). Check the
.glb UV layout and per-island density; unrecorded targets or >2x density swings between adjacent
visible surfaces fail.
Source: Leonardo Iezzi, "Texel Density: All You Need to Know", 80.lv / ArtStation, 2018.

### pbr-material-correctness — PBR material correctness
Textures must obey the metal/roughness PBR contract: base color inside the physically plausible
albedo value range, metallic effectively binary with correct metal reflectance values, and no
lighting or ambient occlusion baked into base color as painted shadows. These rules are
specified in Allegorithmic's published PBR handbook and are directly measurable from the stored
texture channels. Baked-in lighting is the signature generative-3D failure — check explicitly.
Source: Wes McDermott, "The PBR Guide: A Handbook for Physically Based Rendering",
Allegorithmic, 2018.

### bake-artifact-cleanliness — Bake and texture artifact cleanliness
Normal maps and baked textures must be clean: no seam lines at UV borders, no skewed or wavy
projected details, no mirrored-bake artifacts, tangent-space maps only (object-space is
non-standard for games). Polycount's texture-baking standard defines these checks; for
image-to-3D output the equivalent read is projection smearing and texture stretching on faces
the source image never saw. Gauge from close renders of seam regions plus the texture files.
Source: Polycount Wiki, "Texture Baking".

### lod-engine-budget-strategy — LOD / engine budget strategy
The asset must record an explicit engine strategy: either a LOD chain appropriate to its size
class, or a recorded Nanite decision — Epic's documentation scopes Nanite to meshes with many
or very small on-screen triangles and documents hybrid non-Nanite workflows for the rest. An
asset imported with neither LODs nor a recorded Nanite/no-Nanite rationale in metadata fails;
the strategy must be checkable from the stored asset record, not assumed.
Source: Epic Games, "Nanite Virtualized Geometry" and "Hybrid Non-Nanite and Nanite Content
Workflows", Unreal Engine 5 Documentation.

### import-integrity-in-engine — Import integrity in engine
The converted asset must be validated in the target engine, not just in the DCC/viewer: correct
real-world scale for its gameplay class (UE: 1uu = 1cm), upright orientation, pivot at the
sensible attachment/ground point, and conforming asset naming. Valve's workshop pipeline makes
in-engine preview the acceptance step precisely because viewer-correct assets routinely import
wrong. Check the stored .glb bounds/transform against recorded gameplay size and the UE
Interchange import record.
Source: Valve, "Dota 2 Workshop — Item Model Requirements" (in-game preview validation step).

### material-storytelling — Material storytelling and wear
Surfaces should read as specific materials with a history: edge wear where hands and impacts
land, material separation (metal vs leather vs wood) legible at gameplay camera distance, and
grime that follows gravity and cavities — not uniform procedural dirt. Naughty Dog's published
texturing workflow treats this layered, story-driven material definition as the craft bar.
VLM-gauge rendered views; uniform noise-wear over every surface reads as generated, not authored.
Source: Bradford Smith & Rogelio Olguin, "Texturing Uncharted 4: A Matter of Substance",
GDC 2016 (Allegorithmic-presented session).

## Scoring guidance

- **A1 HOBBY** — fails 3+ criteria or any disqualifier fires: raw generative output shipped
  without conversion discipline.
- **A2 INDIE** — passes silhouette-form-fidelity, triangle-budget-discipline,
  import-integrity-in-engine, and pbr-material-correctness, with at most systematic (recorded,
  bounded) gaps in topology-shading-integrity, bake-artifact-cleanliness, and
  material-storytelling. **This is the target grade and the roof — reaching it means the
  pipeline is doing its job, not falling short.**
- **A3 AA** — would additionally require professional retopology, authored bakes, and held
  texel density across the whole set. Above this lens's recorded ceiling; do not award.
- **A4 AAA-PARITY** — indistinguishable from the named A4 anchors. Permanently above the
  ceiling; do not award.

DISQUALIFIERS (any one caps the asset at A1):
1. Holes, non-manifold shells, or amputated forms visible in the silhouette from any cardinal view.
2. Lighting or shadows baked into base color (painted-in illumination in the albedo channel).
3. In-engine scale off by more than 2x from the recorded gameplay size class, or asset lying on
   its side / floating off its pivot after import.
4. No face/vertex/texture-resolution metadata recorded for the stored .glb.
5. Texel density swinging more than 4x between adjacent visible surfaces with no recorded intent.

## Ceiling statement

Recorded ceiling: **A2**, and the assumption is recorded as **permanent**: generative
image-to-3D (Tripo-class) will not reach top-tier AAA asset quality — sculpt-driven topology,
authored bakes, and art-directed material storytelling remain human-craft differentiators.
A2 is therefore the achievable maximum for this pipeline, not a failure grade: an asset set
that holds A2 across the board is this lens's definition of success.
