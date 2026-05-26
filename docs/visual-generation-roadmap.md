# Visual Asset Generation Roadmap

> 10 development directions for bringing AI-powered visual generation into PoF, based on the 2025-2026 tooling landscape.

## Current Gap

PoF excels at structuring the *logic* side of UE5 C++ game development: checklists, prompts, evaluators, feature tracking. What's missing is any ability to generate, manage, or pipeline the *visual* side: meshes, textures, materials, concept art, animations. An indie dev using PoF still has to leave the app entirely to produce any visual assets.

The goal: make PoF a unified cockpit where a solo developer can go from text description to in-engine asset without leaving the tool.

---

## Direction 1: Concept Art Studio (ComfyUI + Flux/DALL-E Backend)

**What**: A concept art generation panel integrated into PoF that produces reference art, character sheets, environment moods, prop concepts, and UI mockups from text prompts with UE5 game context injected automatically.

**Why first**: Lowest barrier to entry, highest immediate value. 2D generation is mature, cheap, and fast. Every asset pipeline starts with a concept.

**Technical approach**:
- **Primary backend**: Self-hosted ComfyUI running as a persistent HTTP/WebSocket server (`python main.py --listen 0.0.0.0 --port 8188`). Send workflow JSON to `/prompt`, monitor via WebSocket, retrieve images from `/view`.
- **Cloud fallback**: DALL-E 3 / GPT Image 1 API ($0.04-0.12/image), Flux.2 Pro API ($0.03/megapixel), or Stability API ($0.002-0.01/image) for users without local GPU.
- **ControlNet integration**: Depth maps, canny edges, OpenPose for guided generation. Feed existing concept art as style reference via IP-Adapter.
- **Context injection**: Reuse PoF's `buildProjectContextHeader()` to append game genre, art style, color palette, and existing asset descriptions to prompts automatically.

**Key workflows**:
- "Generate a dark fantasy warrior character in the style of Elden Ring" with consistent style across angles
- "Create 4 prop concepts for treasure chests at varying rarity tiers"
- ControlNet depth-guided environment art that matches a blockout screenshot

**New PoF components**:
- `ConceptArtStudio` module (new content module category: `visual-gen/`)
- ComfyUI connection manager (similar pattern to existing `pof-bridge/connection-manager.ts`)
- Image gallery with tagging, favorites, and "send to 3D pipeline" action
- Prompt templates per art category (character, environment, prop, UI)

**Cost**: Free (self-hosted ComfyUI + open-weight Flux.2 Dev) or ~$0.03-0.12/image (cloud APIs).

**Dependencies**: ComfyUI installed locally OR cloud API key configured in project settings.

---

## Direction 2: AI 3D Asset Forge (Multi-Provider Mesh Generation)

**What**: Text-to-3D and image-to-3D generation from within PoF, aggregating multiple providers behind a unified interface with quality/speed/cost comparison.

**Why**: This is the core pain point. Generating 3D meshes from descriptions eliminates the biggest bottleneck for solo devs.

**Technical approach**:
- **Provider abstraction layer**: Unified `MeshGenerationProvider` interface wrapping multiple backends:

| Provider | Type | Speed | Cost | Quality | API |
|----------|------|-------|------|---------|-----|
| Meshy | Cloud API | 20-60s | ~$1/model | Game-focused | REST |
| Tripo 3.0 | Cloud API | 10-30s | ~$0.20-0.40/model | Clean quad topology | REST |
| Hyper3D Rodin | Cloud API | 30-60s | ~$0.40/model | Highest fidelity | REST |
| TripoSR | Local (MIT) | <1s | Free (6GB VRAM) | Good base mesh | Python subprocess |
| TRELLIS.2 | Local (MIT) | ~3s | Free (16GB+ VRAM) | High, textured | Python subprocess |
| Hunyuan3D 2.1 | Local (Apache) | ~10s | Free (GPU) | High, PBR | Python subprocess |
| Stable Fast 3D | Local (open) | 0.5s | Free (GPU) | Good rapid draft | Python subprocess |

- **Generation pipeline**: Prompt -> select provider -> generate -> preview in-browser -> refine -> export FBX/glTF -> push to UE5
- **Batch generation**: Queue multiple assets (all enemies for a dungeon, all props for a room) and generate in parallel across providers
- **Comparison mode**: Same prompt sent to 2-3 providers simultaneously; user picks the best result

**New PoF components**:
- `AssetForge` module with provider selector, prompt builder (reusing `PromptBuilder` pattern), generation queue
- `MeshGenerationService` in `lib/mesh-generation/` with provider adapters
- API routes: `/api/mesh-generation/generate`, `/api/mesh-generation/status`, `/api/mesh-generation/providers`
- Generated asset DB table for tracking lineage (prompt -> provider -> output -> refinements)

**Output formats**: glTF/GLB (web preview), FBX (UE5 import), OBJ (universal).

---

## Direction 3: In-Browser 3D Asset Viewer & Gallery

**What**: React Three Fiber powered 3D viewport embedded in PoF for previewing generated meshes, reviewing imported assets, and managing the visual asset library.

**Why**: You can't manage what you can't see. Without a 3D viewer, every generated asset is a black box until you import it into UE5.

**Technical approach**:
- **React Three Fiber** (`@react-three/fiber`) + `@react-three/drei` for the viewer component
- `useGLTF` hook loads `.glb` files directly
- `OrbitControls` for camera manipulation, `Environment` presets for PBR lighting
- **Asset gallery**: Thumbnail grid generated via headless Three.js rendering or Blender background render
- **Inspection tools**: Vertex/triangle count, UV visualization, material channel preview (albedo, normal, roughness individually), wireframe overlay

**Viewer features**:
- Orbit, pan, zoom with mouse/touch
- PBR environment presets (studio, outdoor, dark dungeon) matching game art style
- Wireframe / UV / normal map overlay toggles
- Side-by-side comparison of two assets
- Annotation system: click on mesh to add notes ("this edge needs cleanup")
- Export actions: "Send to Blender", "Import to UE5", "Retexture with AI"

**New PoF components**:
- `AssetViewer` component in `components/ui/` (reusable across modules)
- `AssetGallery` module in `visual-gen/`
- Asset metadata DB table (file path, poly count, provider, prompt, tags, rating)
- Thumbnail generation service (background Blender render or Three.js snapshot)

**Package additions**: `three`, `@react-three/fiber`, `@react-three/drei`.

---

## Direction 4: PBR Material Lab (AI Texture Generation + Decomposition)

**What**: Generate full PBR material sets (albedo, normal, roughness, metallic, AO, height) from text descriptions or reference photos, preview them on 3D meshes in-browser, and export ready for UE5 Material Instances.

**Why**: Texturing is the other half of the visual asset problem. A generated mesh with placeholder grey material is useless until it has proper PBR maps.

**Technical approach**:
- **GenPBR API**: REST API for decomposing any image into PBR maps. Batch processing (50 images/batch on Pro). Sub-second response. $299 lifetime or free tier for testing.
- **Ubisoft CHORD** (open-source, SIGGRAPH Asia 2025): Three-stage pipeline — texture generation, PBR decomposition, upscaling to 2K/4K. Available as ComfyUI nodes.
- **ComfyUI workflows**: Stable Diffusion + ControlNet for generating tileable textures, then CHORD or GenPBR for PBR decomposition.
- **Free PBR sources**: Poly Haven API (`api.polyhaven.com`) and ambientCG API (`ambientcg.com/api/v2/`) — both CC0, full programmatic access, 8K+ PBR materials.

**Material workflows**:
1. **Text-to-Material**: "Dark weathered stone with moss in cracks" -> AI generates base texture -> decompose to PBR maps
2. **Photo-to-Material**: Upload a photo of real material -> CHORD decomposes into full PBR set -> tile and upscale
3. **Browse free libraries**: Search Poly Haven / ambientCG by category, preview in 3D, download with one click
4. **Retexture existing mesh**: Apply new AI-generated material to a mesh from the Asset Gallery

**New PoF components**:
- `MaterialLab` module in `visual-gen/`
- Material preview sphere/cube using React Three Fiber with PBR channel toggling
- `PBRDecompositionService` wrapping GenPBR API and/or local CHORD model
- Free asset browser component for Poly Haven / ambientCG integration
- Material export helper that generates UE5 Material Instance parameter JSON

**UE5 integration**: Export PBR maps as named texture files following UE5 conventions (`T_MaterialName_D`, `_N`, `_R`, `_M`, `_AO`). Auto-generate a Material Instance parameter set that the PoF Bridge can apply.

---

## Direction 5: Blender Pipeline Engine (Headless Mesh Processing)

**What**: A managed Blender subprocess that PoF controls for mesh processing operations: format conversion, retopology, UV unwrapping, LOD generation, FBX export for UE5, and batch processing.

**Why**: AI-generated meshes are rarely import-ready. They need decimation, UV cleanup, proper normals, collision mesh generation, and FBX export with UE5-compatible settings. Blender does all of this and can run headlessly.

**Technical approach**:
- **Blender headless**: `blender --background --python script.py -- <args>`. Spawn via Node.js `child_process.spawn()`.
- **Script library**: Pre-built Python scripts for common operations:
  - `import_and_convert.py` — import any format, export FBX with UE5 settings (triangulate, correct axes, bake modifiers)
  - `retopology.py` — decimate to target poly count, optionally Quadriflow remesh
  - `uv_unwrap.py` — smart UV project or auto-unwrap
  - `generate_lods.py` — create LOD chain (100%, 50%, 25% poly counts)
  - `collision_mesh.py` — generate simplified convex hull collision (UE5 `UCX_` naming convention)
  - `apply_material.py` — assign PBR textures to material slots
- **Job queue**: Queue multiple Blender jobs, track progress, report results back to UI
- **Blender detection**: Auto-detect Blender installation path on Windows/Mac/Linux

**Key FBX export settings for UE5**:
```python
bpy.ops.export_scene.fbx(
    filepath=output,
    use_triangles=True,
    axis_forward='-Z', axis_up='Y',
    global_scale=1.0,
    apply_scale_options='FBX_SCALE_ALL',
    use_mesh_modifiers=True,
    primary_bone_axis='Y',
    secondary_bone_axis='X',
)
```

**New PoF components**:
- `BlenderPipeline` service in `lib/blender-pipeline/`
- `BlenderJobQueue` with progress tracking (similar to existing CLI task queue)
- `MeshProcessing` panel in Asset Gallery: select operations, preview before/after, execute
- Blender path configuration in Project Setup module
- API routes: `/api/blender/process`, `/api/blender/status`

**Advanced**: Blender AI addons (StableGen, 3D-Agent) can be invoked through the same headless pipeline for AI-powered operations directly in Blender.

---

## Direction 6: Auto-Rig & Animation Pipeline

**What**: Automatically rig AI-generated character meshes for UE5's skeleton and apply/generate animations, bridging the gap between a static mesh and a playable character.

**Why**: An unrigged character mesh is unusable in-game. Auto-rigging turns a generated mesh into something that can actually move in UE5, which is the critical step from "cool demo" to "usable game asset."

**Technical approach**:

**Rigging**:
- **UniRig** (SIGGRAPH 2025, Apache 2.0): GPT-like transformer that predicts skeleton hierarchies. 215% accuracy improvement over prior methods. Works on diverse body types. Available as ComfyUI nodes and standalone Python. Requires CUDA GPU.
- **Mixamo**: Free Adobe service. Web-based auto-rigger + 2,500 animation library. No official API but well-documented retarget workflow to UE5 Mannequin.
- **AccuRIG 2** (Reallusion): Free standalone app. AI body part identification, superior skin weights for stylized characters. Outputs compatible with UE5.

**Animation**:
- **Mixamo animation library**: Apply pre-made animations to rigged characters. Retarget to UE5 skeleton.
- **Cascadeur**: AI inbetweening, physics-based posing. UE5 Live Link plugin for real-time streaming. Free tier available. Pro $49/mo.
- **Video-to-mocap**: MediaPipe BlazePose (33 landmarks, real-time, runs in browser/Python) or MoveNet (TensorFlow, 17 landmarks). Record video -> extract landmarks -> export BVH -> retarget in UE5.

**Pipeline**: Generate mesh (Direction 2) -> Auto-rig with UniRig/Mixamo -> Apply animations from library or video mocap -> Export rigged FBX -> Import to UE5 via PoF Bridge

**New PoF components**:
- `AnimationPipeline` module in `visual-gen/`
- Rigging provider abstraction (UniRig local, Mixamo web, AccuRIG CLI)
- Animation browser: search and preview Mixamo animations, tag favorites
- Video mocap recorder: webcam capture -> MediaPipe -> skeleton data -> BVH export
- Skeleton retarget configurator for mapping to UE5 Mannequin

---

## Direction 7: Procedural Content Engine (Terrain, Vegetation, Architecture)

**What**: A custom procedural generation system built into PoF for creating game environments programmatically: terrain heightmaps, vegetation placement, building/dungeon layouts, and prop scattering.

**Why**: Environment art is the most time-consuming part of game development. Procedural generation can produce infinite variations for levels, letting the dev focus on gameplay tuning rather than hand-placing every rock and tree.

**Technical approach**:
- **Terrain generation**: Python subprocess using `opensimplex` noise (Perlin/Simplex) + `scikit-image` marching cubes for heightmap generation. Export as 16-bit PNG heightmaps directly importable by UE5 Landscape.
- **Vegetation placement**: Poisson disk sampling for natural distribution. Ecosystem simulation (species competition, shade tolerance). L-system tree generation for unique procedural trees.
- **Architecture**: SDF-based building generation using `fogleman/sdf` library. Compose primitives (box, cylinder) via union/intersection/difference. Export via marching cubes to mesh.
- **Dungeon/level layouts**: Graph-based room generation (BSP trees, wave function collapse). Export as blockout meshes or UE5 Data Table CSV for in-engine spawning.
- **Python stack**: `trimesh` for mesh creation/export, `opensimplex` for noise, `scikit-image` for marching cubes, `Open3D` for surface reconstruction.

**UE5 integration paths**:
- Heightmaps: Import as UE5 Landscape (16-bit PNG, r16 raw)
- Meshes: Export FBX via Blender pipeline (Direction 5)
- Placement data: Export as JSON/CSV, import via UE5 Data Tables or Python scripting
- Runtime: Feed parameters to UE5's built-in PCG framework via PoF Bridge

**New PoF components**:
- `ProceduralEngine` module in `visual-gen/`
- Parameter editor UI: sliders for noise octaves, scale, biome thresholds, vegetation density
- 2D heightmap preview (canvas-based) with 3D terrain preview (React Three Fiber)
- Template library: "Souls-like swamp", "Mountain fortress approach", "Underground cavern system"
- Seed management: save/reload seeds for reproducible results

---

## Direction 8: UE5 Asset Import Automation

**What**: Automated pipeline that takes assets generated/processed in PoF and imports them into the UE5 project with correct settings, folder structure, material assignments, and collision setup — all without manual editor interaction.

**Why**: The "last mile" problem. Even if PoF can generate and process assets beautifully, the dev still has to manually drag files into UE5, configure import settings, assign materials, and set up collision. Automating this closes the loop.

**Technical approach**:
- **PoF Bridge extension**: Extend the existing `pof-bridge/` system to send import commands to the UE5 companion plugin.
- **UE5 Python scripting**: The companion plugin runs `unreal.AssetTools.import_asset_tasks()` with pre-configured `FbxImportUI` options.
- **Commandlet mode**: For CI/batch scenarios, `UnrealEditor-Cmd.exe -run=ImportCommandlet` processes a queue of import jobs without opening the editor GUI.
- **Smart import rules**: Based on asset type (character, prop, environment), auto-configure:
  - Static mesh: enable Nanite, generate collision, set LOD policy
  - Skeletal mesh: map to UE5 Mannequin skeleton, import animations
  - Textures: set compression, sRGB vs linear, texture group
  - Materials: auto-create Material Instance from PBR map set

**Import flow**:
1. Asset finalized in PoF (generated, processed, previewed)
2. Click "Import to UE5"
3. PoF writes asset files to a staging directory in the UE5 project
4. PoF Bridge sends import command with configuration JSON
5. Companion plugin executes Python import script
6. Plugin reports success/failure back to PoF
7. Asset appears in Content Browser, material assigned, collision ready

**New PoF components**:
- `ImportAutomation` service in `lib/import-automation/`
- Import rule configurator (per-module defaults: character meshes get skeletal import, props get static)
- Import history log with rollback capability
- Bulk import panel: select N assets, configure shared settings, import all
- Extension to PoF Bridge protocol for import commands

**Convention enforcement**: Auto-apply UE5 naming conventions (`SM_`, `SK_`, `T_`, `M_`, `MI_` prefixes), folder structure (`/Game/Characters/`, `/Game/Props/`, etc.).

---

## Direction 9: Free Asset Aggregator & Browser

**What**: Integrated browser for discovering, previewing, and importing free CC0 assets from Poly Haven, ambientCG, and other open libraries directly within PoF.

**Why**: Not every asset needs to be AI-generated. Thousands of production-quality CC0 PBR materials, HDRIs, and 3D models already exist for free. Making them discoverable from within PoF saves time and ensures proper pipeline integration.

**Technical approach**:
- **Poly Haven API** (`api.polyhaven.com`): Full REST API for all assets. CC0 license, 8K+ PBR textures, HDRIs, and 3D models. Filter by category, resolution, and type.
- **ambientCG API** (`ambientcg.com/api/v2/full_json`): 2,000+ PBR materials and HDRIs. CC0 license. Filter by category, resolution, format. Returns metadata + download links.
- **Additional sources** (future): Sketchfab (CC assets), Kenney.nl (game assets CC0), OpenGameArt.

**Browser features**:
- Unified search across all sources with category filters (stone, wood, metal, fabric, etc.)
- PBR material preview on a sphere/cube (React Three Fiber)
- Resolution selector (1K/2K/4K/8K)
- One-click download to project asset directory
- Auto-rename to UE5 naming conventions on download
- "Apply to mesh" action — assign downloaded material to a mesh from Asset Gallery
- Favorites and collections for project-specific curation

**New PoF components**:
- `AssetBrowser` module in `visual-gen/`
- `FreeAssetService` in `lib/free-assets/` with provider adapters for each API
- Cached search index (SQLite) for offline browsing of metadata
- Download manager with progress tracking
- API routes: `/api/free-assets/search`, `/api/free-assets/download`

**Integration**: Downloaded assets feed into Direction 4 (Material Lab) for customization and Direction 8 (Import Automation) for UE5 import.

---

## Direction 10: Animation Reference & Motion Capture Studio

**What**: Generate animation reference videos using AI video generation APIs and extract motion data from video (AI or recorded) for use as UE5 animation source.

**Why**: Animation is the most expensive and specialized skill in game development. AI video generation can provide motion reference, and browser-based mocap can capture real motion without expensive hardware.

**Technical approach**:

**Reference generation**:
- **Kling 3.0 API**: Text-to-video and image-to-video. 1080p/48fps. REST API with Python/Node SDKs. Pay-as-you-go.
- **Runway Gen-4.5 API**: Highest quality video generation. Official REST API. $12/mo standard plan.
- **Pika 2.2 API** (via fal.ai): Text-to-video, image-to-video. Self-serve API access.
- Use case: "Generate a 5-second reference of a knight performing a heavy overhead sword swing"

**Video-to-motion capture**:
- **MediaPipe BlazePose**: Google's framework, 33 body landmarks, runs in browser via TensorFlow.js or in Python. Real-time webcam capture.
- **MoveNet**: TensorFlow model, optimized for speed. Lightning (fast) and Thunder (accurate) variants.
- **Pipeline**: Video (AI-generated or webcam) -> landmark extraction -> smooth/filter -> export BVH/JSON -> retarget to UE5 skeleton

**Browser-based mocap**:
- Webcam capture directly in PoF's UI using MediaPipe JS SDK
- Real-time skeleton overlay preview
- Record, trim, and export motion clips
- Library of captured motions with tagging

**New PoF components**:
- `MotionStudio` module in `visual-gen/`
- Video generation panel: prompt, select provider, generate, preview
- Webcam mocap recorder with MediaPipe overlay
- Motion clip library with preview (skeleton animation in Three.js)
- BVH exporter for UE5 import
- Integration with Cascadeur Live Link for real-time animation preview in UE5

---

## Implementation Priority

Recommended order based on impact, complexity, and dependencies:

| Phase | Direction | Why This Order |
|-------|-----------|----------------|
| **Phase 1** | 3 - Asset Viewer | Foundation: every other direction needs a way to preview 3D assets |
| **Phase 1** | 1 - Concept Art Studio | Quick win: 2D generation is mature and immediately useful |
| **Phase 2** | 2 - AI 3D Asset Forge | Core value: mesh generation is the biggest pain point |
| **Phase 2** | 4 - PBR Material Lab | Completes the asset: generated mesh + generated material |
| **Phase 3** | 5 - Blender Pipeline | Processing: makes generated meshes import-ready |
| **Phase 3** | 9 - Free Asset Browser | Low effort, high value: free CC0 assets via existing APIs |
| **Phase 4** | 8 - UE5 Import Automation | Closes the loop: assets go from PoF to UE5 automatically |
| **Phase 4** | 6 - Auto-Rig & Animation | Enables characters: rigging + animation library |
| **Phase 5** | 7 - Procedural Engine | Advanced: environment-scale generation |
| **Phase 5** | 10 - Motion Studio | Advanced: AI video + mocap pipeline |

## Cost Summary

| Direction | Free Option | Paid Option |
|-----------|------------|-------------|
| 1 - Concept Art | ComfyUI + Flux.2 Dev (local GPU) | DALL-E 3 ($0.04/image), Flux.2 Pro ($0.03/MP) |
| 2 - 3D Asset Forge | TripoSR / TRELLIS.2 (local GPU) | Tripo ($14/mo), Meshy ($16/mo), Rodin ($24/mo) |
| 3 - Asset Viewer | React Three Fiber (MIT) | n/a |
| 4 - Material Lab | CHORD + Poly Haven + ambientCG | GenPBR ($299 lifetime), Scenario AI |
| 5 - Blender Pipeline | Blender (GPL, free) | n/a |
| 6 - Auto-Rig | UniRig (Apache 2.0) + Mixamo (free) | Cascadeur Pro ($49/mo) |
| 7 - Procedural Engine | trimesh + opensimplex (all MIT/BSD) | Houdini Indie ($269/yr) |
| 8 - Import Automation | UE5 Python scripting (built-in) | n/a |
| 9 - Free Assets | Poly Haven + ambientCG (CC0, free APIs) | n/a |
| 10 - Motion Studio | MediaPipe (free, Apache 2.0) | Kling/Runway API ($12+/mo) |

## Architecture Fit

All 10 directions follow PoF's existing patterns:

- **Module system**: Each direction becomes a new module under `visual-gen/` category in the module registry
- **API routes**: Each external service gets an API route following the `{ success, data/error }` envelope
- **Stores**: Each module gets a Zustand store with persist (excluding transient generation state)
- **CLI integration**: Generation prompts can be dispatched via the existing CLI terminal with new skill packs
- **Event bus**: Generation events on `asset.*` namespace for cross-module communication
- **PoF Bridge**: UE5 import commands extend the existing bridge protocol
- **DB layer**: Asset metadata, generation history, and provider credentials stored in SQLite

No fundamental architectural changes required. The existing module system, API pattern, store pattern, and PoF Bridge all extend naturally to support visual generation.
