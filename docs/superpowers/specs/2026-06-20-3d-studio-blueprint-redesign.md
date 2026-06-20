# /3d Studio — Blueprint redesign

**Date:** 2026-06-20
**Status:** approved (brainstorming) → ready for implementation plan

## Goal

Redesign the `/3d` studio UI from the legacy app tokens (`bg-surface`, `text-text-muted`, `var(--visual-gen)`) into the lab's **Blueprint** visual identity — the same `--lab-*` token system the `/layout` lab uses — including a component-level redesign of the chrome.

## Decisions (locked)

- **Blueprint-only** — lock to the Blueprint (light) theme; no Light/Studio-Dark toggle.
- **Chrome + blueprint grid** — restyle all UI chrome (header, gallery rail, toolbar, inspector) AND tint the 3D floor grid to the blueprint line color so the viewport reads as a drafting table.
- **New Blueprint components for `/3d`** — do NOT restyle the *shared* `AssetInspector`/`ViewerToolbar` (the asset-viewer module uses them); build `/3d`-specific Blueprint versions instead.

## Theme mechanism

`lab-tokens.css` is already imported globally (`src/app/globals.css:10`), defining the `--lab-*` tokens per `[data-theme]`. So Blueprint is activated by setting `data-theme="blueprint"` (= `themeAttr('light')`) + `className={labFontVars}` on the `Studio3D` root — exactly how `LayoutLab.tsx:92-93` does it. The active theme object is `LIGHT` from `theme.ts`. All chrome styling reads `var(--lab-*)` (or the lab primitives, which already do).

## Units

1. **`Studio3D` shell (modify `src/components/studio-3d/Studio3D.tsx`)**
   - Root: `<div data-theme="blueprint" className={labFontVars} style={{ background: 'var(--lab-bg)', color: 'var(--lab-ink)', fontFamily: 'var(--lab-font-body)' }}>`.
   - Header: a Blueprint title-block (`borderBottom: 1px solid var(--lab-line)`, `background: var(--lab-panel)`) with a mono brand `PoF·3D STUDIO` (`var(--lab-font-mono)`, uppercase, `var(--lab-muted)`/`var(--lab-ink)`).
   - Replace the legacy `ViewerToolbar` with the new `StudioToolbar`; replace the legacy `AssetInspector` with the new `StudioInspector`. Keep `AssetGallery` (restyled) and `SceneViewer` (with new props).

2. **`StudioToolbar` (new `src/components/studio-3d/StudioToolbar.tsx`)**
   - Lab `Button`s: render-mode group (Textured/Solid/Wire, `active` = current mode), Grid/Axes/Rotate toggles (`active` = on), Load Model (hidden `<input type=file accept=".glb,.gltf">` → `onFileLoad(url, name)` via `URL.createObjectURL`), Screenshot.
   - Props mirror the controls it drives: `{ renderMode, showGrid, showAxes, autoRotate, modelName, onFileLoad, onRenderModeChange, onToggleGrid, onToggleAxes, onToggleAutoRotate, onScreenshot }` (same shape as the legacy `ViewerToolbar`, so `Studio3D` wiring is unchanged).

3. **`AssetGallery` (restyle `src/components/studio-3d/AssetGallery.tsx`)**
   - Wrap in the lab `Rail` (title `GENERATED (n)`). Cards: `background: var(--lab-panel)`, `border: 1px solid var(--lab-line)`, mono filename (`var(--lab-font-mono)`, `var(--lab-ink)`), size in `var(--lab-muted)`; **active** card = `border-color: var(--lab-accent)` + `var(--lab-accent-bg)` fill. Empty/error states use `var(--lab-muted)` / `var(--lab-bad)`. Behavior unchanged (fetch `/api/visual-gen/assets`, `onPick`).

4. **`StudioInspector` (new `src/components/studio-3d/StudioInspector.tsx`)**
   - Lab `Rail` (title `INSPECTOR`). Reads `useViewerStore((s) => s.stats)` (`AssetStats`). When `stats` is null → a muted "Load a model" line. When present → a grid of lab `Stat` tiles: Triangles, Vertices, Meshes, Materials, Textures, and a Bounding-Box block (W/H/D via `formatMeters`) + the model name (mono). Uses `formatNumber`/`formatMeters` from `asset-viewer/assetStats`.

5. **`SceneViewer` (modify `src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx`)**
   - Add two **optional, backward-compatible** props: `gridColor?: string` (applied to the `<Grid>` `cellColor` AND `sectionColor`; default keeps `#374151`/`#4b5563`) and `backgroundColor?: string` (the canvas container bg; default keeps `bg-[var(--surface-deep)]`). `/3d` passes `gridColor` = the blueprint line color and `backgroundColor` = `var(--lab-bg)` so the viewport reads as paper with a blueprint grid. The asset-viewer module passes neither → unchanged.

## Data flow

Unchanged. Same `useViewerStore` (`setModel`/`renderMode`/toggles/`stats`), same `/api/visual-gen/assets` + `/asset/:name`. This is a presentation-only change plus one backward-compatible prop pair on `SceneViewer`.

## Error / empty states

- Gallery fetch fail → inline `var(--lab-bad)` message + Retry (Blueprint-styled).
- No model → inspector muted "Load a model"; viewport shows the existing placeholder cube.
- All existing route/serving error behavior is unchanged.

## Testing

- `AssetGallery.test.tsx` MUST stay green — it asserts text content + `onPick`, not classes, so the restyle doesn't break it.
- Add `StudioInspector.test.tsx`: with a stubbed store stats object, the tiles render the triangle/vertex numbers; with null stats, the empty line shows. (Use the real `useViewerStore` — set stats via `useViewerStore.setState({ stats })` in the test, reset after.)
- `StudioToolbar` is presentational (lab `Button`s) — covered by tsc/eslint + the live `/3d` run, no dedicated unit test.
- tsc + eslint 0; verify live at `/3d` (Blueprint chrome, blueprint grid, controls + stats work).

## File manifest

```
src/components/studio-3d/Studio3D.tsx        (modify — Blueprint shell + data-theme + swap toolbar/inspector)
src/components/studio-3d/AssetGallery.tsx    (modify — Blueprint restyle, wrap in Rail)
src/components/studio-3d/StudioToolbar.tsx   (new — Blueprint toolbar with lab Buttons)
src/components/studio-3d/StudioInspector.tsx (new — Blueprint Stat-tile inspector)
src/components/modules/visual-gen/asset-viewer/SceneViewer.tsx  (modify — add gridColor?/backgroundColor? props, default unchanged)
src/__tests__/components/studio-3d/StudioInspector.test.tsx     (new)
reuse: ui/Rail, ui/Button, ui/Stat, ui/Panel, theme.ts (LIGHT/labPanelStyle), fonts.ts (labFontVars), assetStats (formatNumber/formatMeters)
```

## Out of scope (deferred)

- Light/Studio-Dark theme toggle (Blueprint-only by decision).
- Restyling the shared `AssetInspector` / `ViewerToolbar` (the asset-viewer module keeps them).
- The QA cockpit (critique/CLIP/VLM per asset) — still deferred from the original `/3d` spec.
- The UE5-budget editor that the shared `AssetInspector` has — `StudioInspector` shows stats only (budget editing stays in the asset-viewer module).
