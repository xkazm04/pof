# Blender MCP Integration Design Spec

**Date**: 2026-03-30
**Status**: Approved
**Scope**: Integrate Blender MCP into PoF visual-gen and content modules
**Review**: Spec review passed — blockers B1/B2, warnings W1-W6, suggestions S1-S4/S6 resolved

---

## 1. Problem Statement

PoF's visual-gen modules cover 3D viewing, material editing, procedural generation, and asset browsing — but most lack a connection to actual 3D authoring software. The `blender-pipeline` module is an empty shell. `asset-forge` has a job queue UI with no backend. `auto-rig` is a text guide. Procedural outputs are 2D canvas previews only.

Blender MCP (`ahujasid/blender-mcp`, 18k+ stars) exposes 23 tools including arbitrary Blender Python execution, scene inspection, viewport screenshots, and integrations with Poly Haven, Sketchfab, Hyper3D Rodin, and Hunyuan3D. This bridges the gap between PoF's design UIs and actual 3D asset creation.

## 2. Architecture Decision

**Option A (chosen): Next.js API route proxy.**

PoF backend manages the MCP server process. Modules call `/api/blender-mcp/[tool]` endpoints. Connection state is server-side.

Rationale:
- Matches existing `apiSuccess`/`apiError` envelope pattern
- Modules use `apiFetch`/`tryApiFetch` — no new client patterns needed
- Server-side process management follows `cli-service.ts` subprocess model
- Connection lifecycle (spawn, health check, reconnect) stays out of React components

## 3. System Architecture

```
 PoF Frontend (React)
    │
    │  apiFetch('/api/blender-mcp/scene-info')
    │  apiFetch('/api/blender-mcp/execute', { body: { code } })
    │
    ▼
 Next.js API Routes (/api/blender-mcp/)
    │  route.ts — connection management (connect/disconnect/status)
    │  [tool]/route.ts — per-tool endpoints
    │
    ▼
 BlenderMCPService (src/lib/blender-mcp/service.ts)
    │  Singleton. Manages TCP socket to Blender addon.
    │  JSON-RPC over TCP to localhost:9876.
    │
    ▼
 Blender (with MCP addon active on TCP :9876)
```

**Why skip the MCP server Python process?** The MCP server (`blender-mcp` PyPI package) is a thin stdio↔TCP bridge. Since PoF's backend is Node.js and can speak TCP directly, we bypass the Python middleman. We send JSON commands to port 9876 (the Blender addon's socket) directly from Node.js. This eliminates a dependency on Python/uvx and simplifies deployment.

## 4. Core Infrastructure

### 4.1 BlenderMCPService (`src/lib/blender-mcp/service.ts`)

Singleton service managing the TCP connection to Blender's addon socket.

All service methods use `Result<T, string>` from `@/types/result.ts` for fallible operations. All logging uses `logger` from `@/lib/logger`.

```typescript
interface BlenderConnection {
  host: string;       // default 'localhost'
  port: number;       // default 9876
  connected: boolean;
  blenderVersion?: string;
}

class BlenderMCPService {
  // Connection
  connect(host?: string, port?: number): Promise<Result<BlenderConnection, string>>
  disconnect(): void
  getStatus(): BlenderConnection

  // Core tools
  getSceneInfo(): Promise<Result<SceneInfo, string>>
  getObjectInfo(name: string): Promise<Result<ObjectInfo, string>>
  executeCode(code: string): Promise<Result<ExecuteOutput, string>>
  getViewportScreenshot(): Promise<Result<string, string>>  // base64 PNG

  // Asset sourcing
  searchPolyHaven(query: string, category?: string): Promise<Result<AssetResult[], string>>
  downloadPolyHaven(id: string, resolution?: string): Promise<Result<ImportedObject, string>>
  searchSketchfab(query: string): Promise<Result<AssetResult[], string>>
  downloadSketchfab(id: string): Promise<Result<ImportedObject, string>>

  // Generation
  generateHyper3D(prompt: string): Promise<Result<JobResult, string>>
  generateHunyuan3D(prompt: string): Promise<Result<JobResult, string>>
  pollJobStatus(jobId: string): Promise<Result<JobStatus, string>>
  importGeneratedAsset(jobId: string): Promise<Result<ImportedObject, string>>
}
```

**TCP Protocol Reference** (verified against `ahujasid/blender-mcp` addon.py source):

The Blender addon opens a TCP socket server on `localhost:9876`. The protocol is **raw JSON over TCP with try-parse framing** — no newline delimiter, no length prefix.

- **Sending**: `socket.sendall(JSON.stringify(command))` — raw UTF-8 JSON bytes
- **Receiving**: Accumulate `recv(8192)` chunks into a buffer; after each chunk, attempt `JSON.parse(buffer)`. If it parses, consume the message and clear the buffer. If `SyntaxError`, wait for more data.
- **Protocol is serial**: One command at a time per connection. The addon processes a command, sends the response, then waits for the next command. No multiplexing or pipelining.
- **No handshake**: Connection opens and commands are sent immediately. Use `get_scene_info` as initial health check.
- **Timeout**: Addon client socket has no timeout (blocking recv). Service-side timeout should be 30s for normal operations, configurable.

**Command format** (Node.js → Blender):
```json
{ "type": "execute_code", "params": { "code": "bpy.ops.mesh.primitive_cube_add()" } }
```

**Response format** (Blender → Node.js):
```json
{ "status": "success", "result": { ... } }
{ "status": "error", "message": "Error description" }
```

**Addon version check**: After connecting, send `get_scene_info` to validate the addon is responsive. Parse response to extract Blender version from scene metadata.

### 4.2 Types (`src/lib/blender-mcp/types.ts`)

```typescript
// Connection
interface BlenderConnection { host: string; port: number; connected: boolean; blenderVersion?: string }

// Scene
interface SceneInfo { objects: ObjectSummary[]; activeObject?: string; collections: string[]; frameRange: [number, number] }
interface ObjectSummary { name: string; type: string; location: [number, number, number]; visible: boolean }
interface ObjectInfo extends ObjectSummary { rotation: [number, number, number]; scale: [number, number, number]; modifiers: string[]; materials: string[] }

// Execution — success payload only; errors carried by Result<T, string> wrapper
interface ExecuteOutput { output: string }

// Assets
interface AssetResult { id: string; name: string; source: 'polyhaven' | 'sketchfab'; category: string; thumbnailUrl?: string }
interface ImportedObject { objectName: string }

// Generation
interface JobResult { jobId: string; status: 'pending' | 'processing' }
interface JobStatus { jobId: string; status: 'pending' | 'processing' | 'completed' | 'failed'; progress: number; resultUrl?: string }
```

### 4.3 API Routes (`src/app/api/blender-mcp/`)

```
api/blender-mcp/
  route.ts              — POST: connect/disconnect/status actions
  scene/route.ts        — GET: scene info
  object/route.ts       — GET ?name=: object info
  execute/route.ts      — POST { code }: execute Blender Python
  screenshot/route.ts   — GET: viewport screenshot (base64)
  assets/route.ts       — GET ?source=&query=: search assets
  assets/download/route.ts — POST { source, id }: download and import
  generate/route.ts     — POST { provider, prompt }: start generation
  generate/status/route.ts — GET ?jobId=: poll job status
  generate/import/route.ts — POST { jobId }: import generated asset
```

All routes use `apiSuccess`/`apiError` from `@/lib/api-utils`. All accept/return the standard `ApiResponse<T>` envelope.

### 4.4 Zustand Store (`src/stores/blenderMCPStore.ts`)

File requires `'use client'` directive.

```typescript
interface BlenderMCPState {
  // Persisted settings (survive page refresh)
  host: string;          // default 'localhost'
  port: number;          // default 9876
  autoConnect: boolean;  // default false

  // Transient runtime state (NOT persisted — reset on rehydration via merge)
  connection: BlenderConnection;
  isConnecting: boolean;
  lastError: string | null;
  recentScreenshots: string[];  // last 3 object URLs (not base64 — memory-safe)

  // Actions
  connect: (host?: string, port?: number) => Promise<void>;
  disconnect: () => void;
  refreshStatus: () => Promise<void>;
  setSettings: (host: string, port: number, autoConnect: boolean) => void;
}
```

Uses `persist` middleware with custom `merge` to reset transient fields on rehydration (same pattern as `cliPanelStore`). Only `host`, `port`, `autoConnect` are persisted. Screenshots stored as object URLs via `URL.createObjectURL()` to avoid multi-MB base64 strings in React state.

### 4.5 Connection UI (`src/components/blender-mcp/BlenderConnectionBar.tsx`)

A small status bar component that any visual-gen/content module can embed:
- Shows connection status (disconnected/connecting/connected + Blender version)
- Connect/disconnect button
- Host:port configuration (collapsed by default)
- Appears at the top of modules that use Blender MCP

## 5. Module Upgrades

### 5.1 Tier 1: Visual-Gen Modules

#### 5.1.1 `blender-pipeline` — Full MCP-Powered Pipeline

**Current state**: UI shell with no subprocess implementation.

**Changes**:
- Replace planned headless subprocess with MCP service calls
- `BlenderSetup.tsx` — replace "detect Blender" with MCP connection UI
- `ScriptRunner.tsx` — wire "Run Script" to `executeCode()` API
- Add new conversion panel: select FBX files → call `executeCode()` with batch conversion script → show results
- Add LOD generation panel: select object → call `executeCode()` with decimation script at configured ratios
- Add mesh optimization panel: remove doubles, recalculate normals via `executeCode()`
- Show viewport screenshot after each operation for visual confirmation

**New files**:
- `src/lib/blender-mcp/scripts/convert-fbx.ts` — Python template for FBX→glTF
- `src/lib/blender-mcp/scripts/generate-lods.ts` — Python template for LOD decimation
- `src/lib/blender-mcp/scripts/optimize-mesh.ts` — Python template for mesh cleanup

#### 5.1.2 `asset-forge` — MCP-Backed 3D Generation

**Current state**: Job queue UI, provider registry, no backend wiring.

**Changes**:
- Wire `useForgeStore` job creation to `/api/blender-mcp/generate` endpoint
- Map existing providers to MCP tools:
  - Hunyuan3D → `generateHunyuan3D()` + `pollJobStatus()` + `importGeneratedAsset()`
  - Rodin (Hyper3D) → `generateHyper3D()` + `pollJobStatus()` + `importGeneratedAsset()`
- Add polling loop in store for active jobs (uses `UI_TIMEOUTS.pollInterval`)
- On completion, auto-import into Blender scene and capture screenshot for preview
- Keep TripoSR/TRELLIS.2 as local-only providers (no MCP needed)

**Modified files**:
- `useForgeStore.ts` — add MCP job submission and polling actions
- `GenerationPanel.tsx` — show Blender connection requirement for MCP providers
- `GenerationQueue.tsx` — show live progress from polling

#### 5.1.3 `asset-browser` — Unified Asset Sourcing via MCP

**Current state**: Poly Haven + ambientCG via custom API in `asset-sources.ts`.

**Changes**:
- Add Sketchfab as third source via `/api/blender-mcp/assets?source=sketchfab`
- Add "Import to Blender" button on each asset card (calls `/api/blender-mcp/assets/download`)
- Keep existing Poly Haven/ambientCG direct API calls for browsing (faster, no Blender needed)
- Add "Import to Blender" as optional action when Blender is connected
- Show viewport screenshot after import

**Modified files**:
- `AssetBrowserView.tsx` — add Sketchfab tab, import-to-Blender button
- `BrowsePanel.tsx` — source selector update
- `useAssetBrowserStore.ts` — add Sketchfab search + import actions

#### 5.1.4 `material-lab` — Blender Material Authoring

**Current state**: PBR editor with Three.js preview, material presets.

**Changes**:
- Add "Send to Blender" button that creates a Blender material matching current PBR params
- Execute `bpy.data.materials.new()` + Principled BSDF node setup via `executeCode()`
- Add "Apply Texture" using MCP `set_texture` equivalent via `executeCode()`
- Add "Blender Preview" tab showing viewport screenshot of material on selected geometry
- Existing Three.js preview remains as instant local preview

**New files**:
- `src/lib/blender-mcp/scripts/create-material.ts` — Python template: create Principled BSDF with params
- `src/lib/blender-mcp/scripts/apply-texture.ts` — Python template: assign texture maps to material

**Modified files**:
- `MaterialLabView.tsx` — add Blender send/preview actions
- `useMaterialStore.ts` — add `sendToBlender` action

#### 5.1.5 `auto-rig` — Automated Rigging in Blender

**Current state**: Text-based Mixamo guide, rig preset browser.

**Changes**:
- Add "Create Rig in Blender" button for each preset
- Generate armature from `rig-presets.ts` bone hierarchies via `executeCode()`
- Add IK constraint setup from preset `ikChains[]` definitions
- Add weight paint automation (automatic weights from Blender)
- Show viewport screenshot of created rig
- Keep Mixamo guide as alternative manual workflow

**New files**:
- `src/lib/blender-mcp/scripts/create-armature.ts` — Python template: create bones from hierarchy
- `src/lib/blender-mcp/scripts/setup-ik.ts` — Python template: add IK constraints
- `src/lib/blender-mcp/scripts/auto-weights.ts` — Python template: automatic weight painting

**Modified files**:
- `AutoRigView.tsx` — add Blender rig creation UI, viewport preview

#### 5.1.6 `procedural-engine` — 3D Procedural Output

**Current state**: 2D canvas previews for terrain, dungeon, vegetation.

**Changes**:
- Add "Export to Blender" for each generator:
  - **Terrain**: Push heightmap as displaced plane mesh via `executeCode()`
  - **Dungeon**: Create 3D geometry from grid (walls as cubes, floors as planes) via `executeCode()`
  - **Vegetation**: Instance scatter points as Blender particle system or individual objects
- Show viewport screenshot after export
- Keep 2D canvas as instant local preview

**New files**:
- `src/lib/blender-mcp/scripts/terrain-to-mesh.ts` — Python template: create displaced grid from heightmap data
- `src/lib/blender-mcp/scripts/dungeon-to-geometry.ts` — Python template: extrude dungeon grid to 3D
- `src/lib/blender-mcp/scripts/scatter-vegetation.ts` — Python template: place objects at scatter points

**Modified files**:
- `ProceduralEngineView.tsx` — add "Export to Blender" buttons per generator
- `useProceduralStore.ts` — add export actions

### 5.2 Tier 2: Content Module Upgrades

#### 5.2.1 `content/materials` — Shader Prototyping in Blender

**Current state**: Material Parameter Configurator, Pattern Catalog, Post-Process Stack — all generate UE5 code.

**Changes**:
- Add "Preview in Blender" for Material Pattern Catalog entries:
  - Water Surface → Blender shader nodes (wave texture + color ramp + glass BSDF)
  - Fire/Embers → Blender shader nodes (noise + emission + color ramp)
  - Dissolve Effect → Blender shader nodes (noise + mix shader + transparent)
- Add "Preview in Blender" for Post-Process Stack → Blender compositor nodes
- Viewport screenshot for visual comparison

**New files**:
- `src/lib/blender-mcp/scripts/shader-patterns/water.ts` — Water surface node graph
- `src/lib/blender-mcp/scripts/shader-patterns/fire.ts` — Fire/embers node graph
- `src/lib/blender-mcp/scripts/shader-patterns/dissolve.ts` — Dissolve effect node graph
- `src/lib/blender-mcp/scripts/compositor-stack.ts` — Post-process compositor setup

**Modified files**:
- `MaterialPatternCatalog.tsx` — add Blender preview button per pattern
- `PostProcessStackBuilder.tsx` — add Blender compositor preview

#### 5.2.2 `content/animations` — Animation Preview in Blender

**Current state**: State machine editor, combo choreographer — all 2D SVG diagrams.

**Changes**:
- Add "Preview in Blender" for combo sequences from AIComboChoreographer:
  - Create armature with basic humanoid rig
  - Apply keyframed animation matching hit timings, root motion distances
  - Play animation and capture viewport screenshot sequence
- Add "Create State Machine" that sets up NLA strips in Blender matching state graph

**New files**:
- `src/lib/blender-mcp/scripts/combo-animation.ts` — Python template: keyframe combo sequence on armature
- `src/lib/blender-mcp/scripts/nla-state-machine.ts` — Python template: NLA strip setup from state graph

**Modified files**:
- `AIComboChoreographer.tsx` — add Blender preview button
- `AnimationStateMachine.tsx` — add Blender NLA export

#### 5.2.3 `content/level-design` — 3D Level Blockout

**Current state**: SVG flow editor with room nodes, procedural level wizard.

**Changes**:
- Add "Blockout in Blender" for Level Flow Editor:
  - Each room → box mesh sized by room type (combat rooms larger, transition corridors narrow)
  - Connections → corridor geometry between rooms
  - Color-code by room type matching SVG colors
- Wire Procedural Level Wizard output → 3D geometry (same as procedural-engine dungeon but with level-design metadata: difficulty zones, spawn points as empties)

**New files**:
- `src/lib/blender-mcp/scripts/level-blockout.ts` — Python template: rooms as boxes, corridors as extruded paths
- `src/lib/blender-mcp/scripts/level-metadata.ts` — Python template: add empties for spawn points, zone markers

**Modified files**:
- `LevelFlowEditor.tsx` — add "Blockout in Blender" button
- `ProceduralLevelWizard.tsx` — add "Export to Blender" button

### 5.3 Tier 3: New Module

#### 5.3.1 `scene-composer` — Full Scene Composition

**Purpose**: The "glue" module. Combine assets, materials, animations, and procedural content into complete Blender scenes ready for UE5 export.

**Components**:
- `SceneComposerView.tsx` — Main view with scene tree, viewport preview, export panel
- `SceneTree.tsx` — Hierarchical view of Blender scene objects (from `getSceneInfo()`)
- `ViewportPreview.tsx` — Live viewport screenshots with auto-refresh
- `AssetPlacer.tsx` — Drag assets from asset-browser/forge into scene with transform controls
- `SceneExporter.tsx` — Export entire scene as FBX/glTF for UE5 import
- `useSceneComposerStore.ts` — Scene state, selected objects, transform mode

**New files**:
- `src/components/modules/visual-gen/scene-composer/SceneComposerView.tsx`
- `src/components/modules/visual-gen/scene-composer/SceneTree.tsx`
- `src/components/modules/visual-gen/scene-composer/ViewportPreview.tsx`
- `src/components/modules/visual-gen/scene-composer/AssetPlacer.tsx`
- `src/components/modules/visual-gen/scene-composer/SceneExporter.tsx`
- `src/components/modules/visual-gen/scene-composer/useSceneComposerStore.ts`
- `src/lib/blender-mcp/scripts/export-scene.ts` — Python template: export full scene

**Registry additions**:
- Add `scene-composer` to `visual-gen` category in `module-registry.ts` with checklist items, quick actions, and knowledge tips (matching existing module patterns)
- Add to `feature-definitions.ts` with deps: `['asset-viewer', 'blender-pipeline']`
- Add evaluation criteria to `module-eval-prompts.ts` (3-pass: structure → quality → performance)

## 6. Blender Python Script Templates

All scripts live in `src/lib/blender-mcp/scripts/`. They are TypeScript template functions that return Python code strings with interpolated parameters.

```typescript
// Example: src/lib/blender-mcp/scripts/create-material.ts
export function createMaterialScript(params: {
  name: string;
  baseColor: [number, number, number];
  metallic: number;
  roughness: number;
}): string {
  return `
import bpy

mat = bpy.data.materials.new(name="${params.name}")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (${params.baseColor[0]}, ${params.baseColor[1]}, ${params.baseColor[2]}, 1.0)
bsdf.inputs["Metallic"].default_value = ${params.metallic}
bsdf.inputs["Roughness"].default_value = ${params.roughness}

# Apply to active object if any
obj = bpy.context.active_object
if obj and obj.type == 'MESH':
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)

print(f"Created material: {mat.name}")
`;
}
```

Scripts are `.ts` files exporting functions (not `.py` files) to enable type-safe parameter interpolation and reuse across modules.

## 7. Timing Constants

New entries in `UI_TIMEOUTS` (`src/lib/constants.ts`):

```typescript
blenderTcpTimeout: 30_000,       // TCP operation timeout (30s)
blenderHealthCheck: 15_000,      // Connection health check interval
blenderReconnectBase: 2_000,     // Reconnect backoff base
blenderReconnectMax: 30_000,     // Max reconnect delay
blenderGenPollInterval: 5_000,   // Generation job polling (slower than CLI poll)
blenderScreenshotDebounce: 500,  // Debounce viewport screenshot requests
```

## 8. Error Handling & Reconnection

- **Connection failures**: `connect()` returns `Result<BlenderConnection, string>`. Store sets `lastError`. UI shows reconnect prompt.
- **Execution failures**: `executeCode()` returns `Result<ExecuteOutput, string>` where error carries Blender's Python traceback. Modules show error inline.
- **Generation failures**: Job polling returns `status: 'failed'`. Store updates job status. Queue UI shows failure reason.
- **Timeout**: TCP operations timeout after `UI_TIMEOUTS.blenderTcpTimeout`. Long operations use polling pattern.

**Reconnection strategy**: Exponential backoff with jitter, matching the UE5 Bridge pattern:
- On socket error/close, set `connection.connected = false`
- If `autoConnect` is enabled, begin reconnect loop
- Backoff: `min(blenderReconnectBase * 2^attempt, blenderReconnectMax)` + random jitter
- Health check: periodic `get_scene_info` every `blenderHealthCheck` ms when connected
- Max 10 reconnect attempts before giving up (user must manually reconnect)

## 9. Security

The `executeCode()` endpoint runs arbitrary Python in Blender. Mitigations:
- API routes are localhost-only by design (Next.js dev server, not exposed publicly)
- Input validation: max code length 100KB, reject empty code
- No file system operations outside the project scope are encouraged (but not enforced — Blender Python has full OS access)
- The connection bar UI shows a warning indicator when `executeCode` is available
- This is an inherent design tradeoff: full Blender Python access is the core value proposition

## 10. Testing Strategy

- **Unit tests**: `BlenderMCPService` with mocked TCP socket. Script template functions with snapshot tests.
- **Integration tests**: API routes with mocked service. Store actions with mocked API.
- **No E2E Blender tests**: Blender is an external dependency. Manual testing against running Blender instance.

## 11. Implementation Order (Phased)

**Phase A — Infrastructure** (foundation, must complete first):
1. `BlenderMCPService` + types + TCP client
2. API routes (`/api/blender-mcp/`)
3. Zustand store (`blenderMCPStore`)
4. Connection UI (`BlenderConnectionBar`)
5. `UI_TIMEOUTS` entries in `constants.ts`

**Phase B — High-Value Integrations** (proves infrastructure, delivers core value):
6. `blender-pipeline` — first module wired, validates infrastructure end-to-end
7. `asset-forge` — generation via MCP (Hunyuan3D, Hyper3D)
8. `asset-browser` — Sketchfab + import-to-Blender

**Phase C — Visual-Gen Completions** (remaining Tier 1 modules):
9. `material-lab` — Send-to-Blender workflow
10. `auto-rig` — automated rigging
11. `procedural-engine` — 3D export of procedural content

**Phase D — Content Module Upgrades** (Tier 2):
12. `content/materials` — shader pattern preview
13. `content/animations` — combo animation preview
14. `content/level-design` — 3D blockout

**Phase E — New Module** (Tier 3, depends on all above):
15. `scene-composer` — full scene composition (new module)

## 12. Files Summary

**New directories**:
- `src/lib/blender-mcp/` — service, types, scripts
- `src/components/blender-mcp/` — shared connection UI
- `src/app/api/blender-mcp/` — API routes
- `src/components/modules/visual-gen/scene-composer/` — new module

**New file count**: ~40-45 files
**Modified file count**: ~15-20 files

## 13. Dependencies

**New npm packages**: None required. TCP socket via Node.js `net` module. No Python/uvx dependency.

**External requirements**: Blender 3.x+ with MCP addon installed and socket server running on port 9876.
