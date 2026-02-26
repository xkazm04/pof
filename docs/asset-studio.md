# Asset Studio

Asset Studio is a category of 8 sub-modules for visual asset creation, processing, and UE5 pipeline integration. It covers the full journey from 3D model generation to in-engine import, accessible from the **Asset Studio** section in the sidebar.

## Modules

| Module | Description |
|--------|-------------|
| [Asset Viewer](#1-asset-viewer) | In-browser 3D model viewer (Three.js) |
| [Asset Forge](#2-asset-forge) | AI-powered text/image-to-3D generation |
| [Material Lab](#3-material-lab) | PBR material editor with live 3D preview |
| [Blender Pipeline](#4-blender-pipeline) | Headless Blender automation for batch processing |
| [Asset Browser](#5-asset-browser) | Browse and download free CC0 assets |
| [Import Automation](#6-import-automation) | Generate UE5 C++ import scripts and DataAssets |
| [Auto-Rig](#7-auto-rig) | Skeleton rigging workflow with Mixamo integration |
| [Procedural Engine](#8-procedural-engine) | Procedural terrain, dungeon, and vegetation generation |

---

## 1. Asset Viewer

**Tab: 3D Viewer**

An in-browser 3D viewport powered by React Three Fiber (`@react-three/fiber`, `@react-three/drei`, `three`).

### Features

- **File loading** — Load `.glb`, `.gltf`, and `.fbx` files via file picker. Models are auto-scaled and centered in the viewport.
- **Render modes** — Switch between Textured, Solid (grey clay), and Wireframe views.
- **Scene controls** — Toggle grid overlay, axis gizmo (RGB XYZ), and auto-rotate.
- **Orbit controls** — Mouse-driven orbit, pan, and zoom with damping.
- **Screenshot** — Capture the current viewport as a timestamped PNG download.
- **Studio lighting** — Three-point directional lighting plus HDRI environment for PBR reflections.

### Technical details

- Three.js canvas rendered client-side only via `next/dynamic` with `ssr: false`.
- State managed by `useViewerStore` (Zustand, not persisted).
- Model loading uses `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`.
- Canvas uses `preserveDrawingBuffer: true` for screenshot support.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/asset-viewer/AssetViewerView.tsx` | Module view shell |
| `src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx` | R3F canvas, model loading, lighting |
| `src/components/modules/visual-gen/asset-viewer/ViewerToolbar.tsx` | File picker, mode selector, toggle buttons |
| `src/components/modules/visual-gen/asset-viewer/useViewerStore.ts` | Zustand store for viewer state |

---

## 2. Asset Forge

**Tab: Generate**

AI-powered 3D model generation from text prompts or reference images.

### Features

- **Two generation modes** — Text-to-3D (describe your model) and Image-to-3D (upload a reference PNG/JPG/WebP).
- **Provider selector** — Choose between free local providers and paid cloud providers:

  | Provider | Status | Modes | VRAM | License |
  |----------|--------|-------|------|---------|
  | TripoSR | Free | Image-to-3D | ~6 GB | MIT |
  | TRELLIS.2 | Free | Text + Image | ~16 GB | MIT |
  | Hunyuan3D | Free | Text + Image | ~12 GB | Apache 2.0 |
  | Meshy | Coming Soon | Text + Image | Cloud | Paid API |
  | Tripo3D | Coming Soon | Text + Image | Cloud | Paid API |
  | Rodin | Coming Soon | Text + Image | Cloud | Paid API |

- **Generation queue** — Track pending, processing, completed, and failed jobs with progress indicators.
- **Prompt history** — Recent prompts saved for reuse.

### Technical details

- Provider registry in `src/lib/visual-gen/providers.ts`.
- Jobs managed by `useForgeStore` (Zustand, not persisted).
- Placeholder API endpoint at `POST /api/visual-gen/generate` — returns a queued response. Actual provider integration (Python subprocess for local models, REST for cloud) is designed to plug in here.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/asset-forge/AssetForgeView.tsx` | Module view |
| `src/components/modules/visual-gen/asset-forge/GenerationPanel.tsx` | Mode/provider/prompt UI |
| `src/components/modules/visual-gen/asset-forge/GenerationQueue.tsx` | Job cards with status |
| `src/components/modules/visual-gen/asset-forge/useForgeStore.ts` | Jobs, provider, prompt history |
| `src/lib/visual-gen/providers.ts` | Provider definitions |
| `src/app/api/visual-gen/generate/route.ts` | Generation API endpoint |

---

## 3. Material Lab

**Tab: Editor**

PBR material editor with live 3D preview on configurable geometry.

### Features

- **PBR parameter sliders** — Metallic, Roughness, Normal Strength, AO Strength with real-time 3D feedback.
- **Base color picker** — Color input for albedo.
- **Texture map uploads** — Upload images for Albedo, Normal, Metallic, Roughness, and AO channels. Each slot shows a thumbnail preview and supports clear.
- **Built-in presets** — Quick-apply material presets (Gold, Plastic, Rubber, Chrome, Wood, Stone, etc.) that set all PBR parameters at once.
- **Preview mesh selector** — View material on Sphere, Cube, Plane, or Cylinder geometry.
- **Live 3D preview** — Side-by-side layout with controls on the left and a React Three Fiber canvas on the right showing `MeshStandardMaterial` with live parameter binding.

### Technical details

- Material presets can be saved to SQLite (`materials` table) via the `POST /api/visual-gen/materials` endpoint.
- Full CRUD API: `GET` (list), `POST` (create), `PUT` (update), `DELETE` (remove).
- DB operations in `src/lib/visual-gen/material-db.ts` following the standard `ensureTable()` + `getDb()` pattern.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/material-lab/MaterialLabView.tsx` | Module view with side-by-side layout |
| `src/components/modules/visual-gen/material-lab/PBREditor.tsx` | Sliders, color picker, texture slots, presets |
| `src/components/modules/visual-gen/material-lab/MaterialPreview.tsx` | R3F canvas with live PBR material |
| `src/components/modules/visual-gen/material-lab/useMaterialStore.ts` | PBR params, textures, presets, preview mesh |
| `src/lib/visual-gen/material-db.ts` | SQLite CRUD for saved materials |
| `src/app/api/visual-gen/materials/route.ts` | REST API for material presets |

---

## 4. Blender Pipeline

**Tab: Pipeline**

Headless Blender automation for mesh processing, format conversion, and batch operations.

### Features

- **Auto-detect** — Detects Blender installation path and version on Windows, macOS, and Linux via the `/api/visual-gen/blender/detect` endpoint. Checks common install locations for each platform.
- **Status display** — Shows detected Blender path, version, or a prompt to install Blender 3.0+.
- **Script runner** — Lists executed script jobs with status indicators (idle, running, completed, failed), elapsed time, stdout/stderr output, and error messages.
- **Script history** — Track and clear completed jobs.

### Intended workflow

The Pipeline tab provides the infrastructure for running headless Blender scripts. The actual pipeline operations (FBX conversion, LOD generation, mesh optimization) are driven through the module's Roadmap checklist, which contains prompts for:
- Converting FBX to glTF with UE5-compatible settings
- Batch mesh optimization and decimation
- LOD chain generation (100%/50%/25%)
- UV unwrapping and normal map baking
- Collision mesh generation with UE5 `UCX_` naming

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/blender-pipeline/BlenderPipelineView.tsx` | Module view |
| `src/components/modules/visual-gen/blender-pipeline/BlenderSetup.tsx` | Blender detection UI |
| `src/components/modules/visual-gen/blender-pipeline/ScriptRunner.tsx` | Job cards with output display |
| `src/components/modules/visual-gen/blender-pipeline/useBlenderStore.ts` | Blender path, script jobs |
| `src/app/api/visual-gen/blender/detect/route.ts` | Platform-specific Blender detection |

---

## 5. Asset Browser

**Tab: Browse**

Search and download free CC0-licensed assets from Poly Haven and ambientCG.

### Features

- **Dual source** — Toggle between Poly Haven and ambientCG.
- **Category filtering** — Filter by asset type:
  - **Poly Haven**: Textures, HDRIs, 3D Models
  - **ambientCG**: PBR Materials
- **Search** — Text search across the active source with Enter-to-search.
- **Results grid** — Responsive thumbnail grid (2-5 columns) with asset cards showing name, source badge, CC0 license indicator, and download overlay.
- **Download** — Opens the asset download page in a new tab (direct download integration designed for future expansion).

### Technical details

- API proxy at `GET /api/visual-gen/browse` aggregates both sources, preventing CORS issues.
- Poly Haven client calls `https://api.polyhaven.com/assets?t={category}` and builds thumbnail URLs from their CDN.
- ambientCG client calls `https://ambientcg.com/api/v2/full_json` with type/sort/limit/offset parameters.
- All assets are CC0 (Creative Commons Zero) — free for commercial use without attribution.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/asset-browser/AssetBrowserView.tsx` | Module view |
| `src/components/modules/visual-gen/asset-browser/BrowsePanel.tsx` | Source/category/search UI, results grid |
| `src/components/modules/visual-gen/asset-browser/AssetCard.tsx` | Thumbnail card with download overlay |
| `src/components/modules/visual-gen/asset-browser/useAssetBrowserStore.ts` | Search state, results, downloads |
| `src/lib/visual-gen/asset-sources.ts` | Poly Haven + ambientCG API clients |
| `src/app/api/visual-gen/browse/route.ts` | Proxy API route |

---

## 6. Import Automation

**Tab: Config**

Generate UE5 C++ import scripts and DataAsset definitions from a visual configuration form.

### Features

- **Import config form** — Configure:
  - Asset name (PascalCase)
  - Source format (FBX, glTF, GLB)
  - Mesh type (Static or Skeletal)
  - Scale factor (slider, 0.01-100)
  - Content path (UE5 `/Game/...` directory)
  - Auto-generate collision (checkbox)
  - Import materials (checkbox)

- **Live C++ code preview** — Two output modes:
  - **Import Script** — Full `UEditorUtilityWidget` subclass with `UAssetImportTask` configuration, `UFbxFactory` settings, and `IAssetTools::ImportAssetTasks()` call.
  - **DataAsset** — `UPrimaryDataAsset` subclass with mesh reference, material overrides, LOD screen sizes, tags, and metadata fields.

- **Copy to clipboard** — One-click copy of the generated C++ code.

### Technical details

- Code generation is purely client-side via template functions in `src/lib/visual-gen/ue5-import-templates.ts`.
- Templates produce compilable UE5 C++ code with proper `GENERATED_BODY()`, `UPROPERTY`, `UFUNCTION` macros, and UE5-style includes.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/import-automation/ImportAutomationView.tsx` | Config form + code preview |
| `src/lib/visual-gen/ue5-import-templates.ts` | `generateImportScript()` and `generateDataAsset()` |

---

## 7. Auto-Rig

**Tab: Rig Setup**

Character rigging workflow with skeleton presets and Mixamo integration guide.

### Features

- **Skeleton preset selector** — Choose from three target skeletons:

  | Preset | Bones | Fingers | Face Rig | Use Case |
  |--------|-------|---------|----------|----------|
  | UE5 Mannequin | 67 | Yes | No | Marketplace compatibility |
  | MetaHuman | 584 | Yes | Yes | High-fidelity characters |
  | Minimal Humanoid | 25 | No | No | Indie games, lower overhead |

- **IK chain display** — Shows Spine, Left/Right Arm, Left/Right Leg chains with start/end bones for each preset.
- **Mixamo workflow guide** — Step-by-step instructions for the free Mixamo rigging process:
  1. Export mesh as FBX (mesh only, no armature)
  2. Upload to mixamo.com (free Adobe account)
  3. Place bone markers
  4. Select skeleton type and process
  5. Preview with test animations
  6. Download as FBX (with skin, 30 fps)
  7. Import into UE5 and retarget to selected preset

- **Bone mapping table** — Shows the Mixamo-to-target bone name mapping for UE5 Mannequin and Minimal Humanoid presets (20 and 18 mappings respectively). MetaHuman requires a custom retargeting workflow.

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx` | Preset selector, workflow guide, bone table |
| `src/lib/visual-gen/rig-presets.ts` | `RIG_PRESETS` definitions with bone mappings |

---

## 8. Procedural Engine

**Tab: Generator**

Procedural content generation with configurable algorithms and 2D canvas previews.

### Generators

#### Terrain Heightmap (Diamond-Square algorithm)

Generates 2D heightmaps with natural-looking terrain elevation.

- **Parameters**: Size (65/129/257), Roughness (0.1-1.0), Seed
- **Output**: 2D grid of normalized float values [0, 1]
- **Preview**: Color-mapped canvas (green-brown terrain palette)
- **Export ready**: `heightmapToUint16()` converts to 16-bit data for UE5 Landscape import

#### Dungeon Layout (BSP — Binary Space Partitioning)

Generates dungeon floor plans with rooms connected by corridors.

- **Parameters**: Width (32-128), Height (32-128), BSP Iterations (2-8), Min/Max Room Size, Corridor Width (1-3), Seed
- **Output**: 2D grid of cell types (empty, floor, wall, door, corridor) plus a room list
- **Preview**: Color-coded top-down canvas view
- **Algorithm**: BSP splits space into partitions, places rooms in leaf nodes, connects rooms with L-shaped corridors, then adds wall tiles around all floor/corridor cells

#### Vegetation Scatter (Poisson Disk Sampling — Bridson's algorithm)

Generates natural-looking point distributions for vegetation placement.

- **Parameters**: Area Width/Height (50-200), Max Attempts (10-60), Seed
- **Species**: Multi-species scatter with per-species radius (Oak 8, Pine 6, Bush 3 by default)
- **Output**: Array of scatter points with x, y, speciesId, rotation (0-360), and scale (0.7-1.3)
- **Preview**: Color-coded dot canvas with species-specific colors and sizes

### Technical details

- All generators use a seeded PRNG (Mulberry32) for reproducible results.
- Generation runs client-side via `requestAnimationFrame` to avoid blocking the UI thread.
- Preview canvases use `imageRendering: pixelated` for clean pixel-art rendering.
- State managed by `useProceduralStore` (Zustand, not persisted).

### Files

| Path | Purpose |
|------|---------|
| `src/components/modules/visual-gen/procedural-engine/ProceduralEngineView.tsx` | Generator selector, param editors, canvas previews |
| `src/components/modules/visual-gen/procedural-engine/useProceduralStore.ts` | Config, preview data, generator state |
| `src/lib/visual-gen/generators/terrain.ts` | Diamond-Square heightmap generation |
| `src/lib/visual-gen/generators/dungeon.ts` | BSP dungeon with rooms and corridors |
| `src/lib/visual-gen/generators/vegetation.ts` | Poisson disk scatter for multiple species |

---

## Architecture

### Registration

All 8 modules are registered through the standard PoF module system:

- **Type union**: `'asset-viewer' | 'asset-forge' | ... | 'procedural-engine'` added to `SubModuleId` in `src/types/modules.ts`
- **Category**: `visual-gen` in `CATEGORIES` array (`src/lib/module-registry.ts`) with `Shapes` icon and cyan accent (`#06b6d4`)
- **Sub-modules**: Each module has a `SUB_MODULES` entry with checklist items, quick actions, and knowledge tips
- **Feature graph**: Dependencies declared in `MODULE_PREREQUISITES` (`src/lib/feature-definitions.ts`):
  - `asset-forge` and `material-lab` depend on `asset-viewer`
  - `import-automation` depends on `asset-viewer` and `blender-pipeline`
  - `auto-rig` and `procedural-engine` depend on `asset-viewer`
  - `blender-pipeline` and `asset-browser` are standalone
- **Renderer**: All views mapped in `MODULE_COMPONENTS` (`src/components/layout/ModuleRenderer.tsx`)

### State management

Each module has its own Zustand store under `use<Module>Store.ts`. None are persisted — all state is runtime-only, following the pattern established for transient UI state that should not survive page reloads.

### API routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/visual-gen/generate` | POST | 3D generation (placeholder) |
| `/api/visual-gen/materials` | GET, POST, PUT, DELETE | Material preset CRUD |
| `/api/visual-gen/blender/detect` | GET | Blender installation detection |
| `/api/visual-gen/browse` | GET | Proxy for Poly Haven / ambientCG |

### Database

The `materials` table in `~/.pof/pof.db` stores saved material presets:

```sql
CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  thumbnail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### CSS

The category accent color is `#06b6d4` (cyan), available as `var(--visual-gen)` in CSS and `MODULE_COLORS['visual-gen']` in chart-colors.

### Dependencies

Three.js packages added for 3D rendering:

```
three
@react-three/fiber
@react-three/drei
@types/three (devDependency)
```

All Three.js components use `next/dynamic` with `ssr: false` to avoid server-side rendering issues.
