# /3d Studio Viewer — design

**Date:** 2026-06-20
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

A dedicated, studio-quality `/3d` route to **preview and rotate the generated 3D assets inside PoF before they reach Unreal**. Primary use: QA the zero-budget TripoSR pipeline's outputs (the `.glb`s under `generated/triposr/`) — and, by extension, test against the multimodal-LLM experiment's outputs that land in the same folder.

## Decisions (locked)

- **Per-asset content:** studio viewer + **live mesh stats** (verts/tris/materials/bounds/watertight, from the loaded mesh). The full QA cockpit (geometry scorecard / CLIP fidelity / VLM verdict per asset) is **deferred** — it gets a clean seam to add later.
- **Asset source:** **gallery + upload** — auto-list `generated/triposr/*.glb` as the gallery AND allow drag-drop / file-pick of any local `.glb`/`.gltf`.

## Architecture

The hard part already exists. `src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx` is a complete react-three-fiber + drei viewer (GLTFLoader, textured/solid/wireframe render modes, auto-fit + center, auto-rotate, OrbitControls with damping, studio `Environment`, lights, infinite grid, axis gizmo) and reports stats via `computeAssetStats`. `useViewerStore` holds model + view state; `ViewerToolbar` provides the controls, upload, and screenshot; `AssetInspector` renders the stats.

`/3d` is therefore mostly **reuse + a studio shell + two small APIs** to list/serve the generated meshes (which live under `generated/` — outside `public/`, gitignored — so Next can't serve them statically).

```
┌── Gallery ──┬─────── Viewport ────────┬── Stats ──┐
│ generated   │   SceneViewer (r3f)     │ verts/tris │
│ thumbnails  │   rotate · zoom · pan   │ materials  │
│ (preview    │   textured│solid│wire   │ bounds     │
│  .png)      │   grid · gizmo · rotate │ watertight │
│ + drop/pick │   studio env + lighting │ size       │
└─────────────┴─────────────────────────┴────────────┘
```

## Units

1. **Serving route** — `GET /api/visual-gen/asset/[name]/route.ts`
   - Serves a single file from `generated/triposr/<name>` (`.glb` → `model/gltf-binary`; `.png` → `image/png`).
   - **Safe by construction:** the name is sanitized (basename only, reject `/`, `\`, `..`), and the path is resolved strictly within the whitelisted `generated/triposr/` dir; anything outside → 404. Mirrors the experiment-screenshot route's "serve only a known path" pattern.

2. **Enumeration route** — `GET /api/visual-gen/assets/route.ts`
   - Lists `generated/triposr/*.glb` → `{ assets: [{ name, sizeBytes, url, previewUrl, mtimeMs }] }`, newest first.
   - `url` = `/api/visual-gen/asset/<name>`; `previewUrl` = the sibling `<base>.preview.png` via the same serving route when it exists, else null.
   - Pure listing/shaping logic extracted to a testable function (`listGeneratedAssets(dir, files)` style) so the route stays thin.

3. **`Studio3D` shell** — `src/app/3d/page.tsx` (server) → `src/components/studio-3d/Studio3D.tsx` (client)
   - 3-pane layout: `AssetGallery` (left) · viewport (center) · `AssetInspector` stats (right).
   - The viewport mounts `SceneViewer` via `dynamic(() => …, { ssr: false })` (Three.js needs the browser) plus a compact control bar (render mode, grid, axes, auto-rotate, screenshot) wired to `useViewerStore` — reusing `ViewerToolbar` (or the same store actions) and the existing screenshot handler.
   - Drag-drop / file-pick of a local `.glb`/`.gltf` → `URL.createObjectURL` → `setModel`.

4. **`AssetGallery`** — `src/components/studio-3d/AssetGallery.tsx`
   - Fetches `/api/visual-gen/assets` (via `apiFetch`/`tryApiFetch`), renders thumbnail cards (the `previewUrl` png, name, size). Click → `setModel(asset.url, asset.name)`. Loading / empty / error states.

5. **Nav** — a "3D Studio" link in `TopBar` (a styled `<a href="/3d">` with a Box/Cube icon), beside the existing "Experiment" link.

## Data flow

Mount → `AssetGallery` fetches `/api/visual-gen/assets` → cards. Click a card → `useViewerStore.setModel('/api/visual-gen/asset/<name>', name)` → `SceneViewer`'s `GLTFLoader` loads from that URL → `computeAssetStats` → `AssetInspector` shows stats. Upload → blob URL → same `setModel` path. No new global state — reuse `useViewerStore`.

## Error / empty states

- Gallery fetch fails → inline message + Retry.
- No asset selected → the existing placeholder cube (empty scene).
- `.glb` load fails → a visible "failed to load" overlay (today `SceneViewer` only `console.error`s; surface it).
- Serving route → 404 for a missing/invalid/out-of-whitelist name.

## Testing

- **Pure:** `listGeneratedAssets` shaping (names→url/previewUrl/size, ordering); the serving route's path-safety helper (`safeAssetPath(name)` accepts plain names, rejects traversal/separators).
- **Component:** `AssetGallery` render test (mock fetch → cards; empty + error states).
- **Not unit-tested:** the r3f canvas / WebGL rendering (no WebGL in jsdom — consistent with the existing `SceneViewer`, which has no test). Verified by running the app.

## File manifest

```
src/app/3d/page.tsx                                  (new)
src/components/studio-3d/Studio3D.tsx                (new)
src/components/studio-3d/AssetGallery.tsx            (new)
src/lib/visual-gen/generated-assets.ts              (new — listGeneratedAssets + safeAssetPath, pure)
src/app/api/visual-gen/assets/route.ts              (new)
src/app/api/visual-gen/asset/[name]/route.ts        (new)
src/components/layout/TopBar.tsx                     (edit — add "3D Studio" link)
src/__tests__/lib/visual-gen/generated-assets.test.ts   (new)
src/__tests__/components/studio-3d/AssetGallery.test.tsx (new)
reuse: SceneViewer, useViewerStore, ViewerToolbar, AssetInspector, computeAssetStats
```

## Out of scope (deferred)

- **QA cockpit** — geometry scorecard / CLIP fidelity / VLM critique per asset. Needs a persisted critique sidecar per generated mesh; the stats panel leaves room to slot it in once the LLM experiment lands.
- Editing/transform tools, multi-asset scene composition, UE-export from this route (UE import already exists via `ue-import.ts`).
