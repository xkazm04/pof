# /3d Studio Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A studio-quality `/3d` route to browse, preview, and rotate the generated TripoSR `.glb` assets (with live mesh stats) before they reach Unreal.

**Architecture:** Reuse the existing react-three-fiber `SceneViewer` engine + `useViewerStore` + `ViewerToolbar` + `AssetInspector`. Add a 3-pane studio shell, a gallery of the generated outputs, and two small APIs to list/serve those meshes (they live under `generated/triposr/` — outside `public/`, gitignored — so they can't be served statically).

**Tech Stack:** Next.js 16 (app router), React 19, TypeScript (strict), zustand, @react-three/fiber + @react-three/drei + three (already installed), vitest + @testing-library/react.

## Global Constraints

- Imports use the `@/` alias (maps to `src/`), never relative `../../`.
- API routes return the standard envelope: server-side `apiSuccess(data)` / `apiError(msg, status)` from `@/lib/api-utils`; client-side `tryApiFetch<T>(url)` (returns `Result<T,string>`).
- No raw `console.*` (use `logger` from `@/lib/logger`); no hardcoded hex colors (use Tailwind classes or CSS vars).
- `SceneViewer` MUST be mounted via `dynamic(() => …, { ssr: false })` — Three.js needs the browser.
- Generated assets live at `path.join(process.cwd(), 'generated', 'triposr')`. The dir may not exist → treat as empty, never throw.
- Tests: vitest. The setup file has NO `@testing-library/jest-dom` and NO `afterEach(cleanup)` — assert plain DOM (`textContent`/`getAttribute`), and add your own `afterEach(cleanup)` in multi-render component tests.

---

### Task 1: Pure asset-list + path-safety helpers

**Files:**
- Create: `src/lib/visual-gen/generated-assets.ts`
- Test: `src/__tests__/lib/visual-gen/generated-assets.test.ts`

**Interfaces:**
- Produces:
  - `interface GeneratedAsset { name: string; sizeBytes: number; mtimeMs: number; url: string; previewUrl: string | null }`
  - `safeAssetName(name: string): string | null` — returns the name iff it's a safe basename (`.glb`/`.gltf`/`.png`, no separators or `..`), else `null`.
  - `buildAssetList(glb: { name: string; sizeBytes: number; mtimeMs: number }[], previewNames: Set<string>): GeneratedAsset[]` — shapes the gallery list, newest first.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/visual-gen/generated-assets.test.ts
import { describe, it, expect } from 'vitest';
import { safeAssetName, buildAssetList } from '@/lib/visual-gen/generated-assets';

describe('safeAssetName', () => {
  it('accepts plain glb/gltf/png basenames', () => {
    expect(safeAssetName('chair.glb')).toBe('chair.glb');
    expect(safeAssetName('bestof_fg070.preview.png')).toBe('bestof_fg070.preview.png');
    expect(safeAssetName('a.gltf')).toBe('a.gltf');
  });
  it('rejects traversal, separators, and other extensions', () => {
    expect(safeAssetName('../secret.glb')).toBeNull();
    expect(safeAssetName('a/b.glb')).toBeNull();
    expect(safeAssetName('a\\b.glb')).toBeNull();
    expect(safeAssetName('chair.exe')).toBeNull();
    expect(safeAssetName('')).toBeNull();
  });
});

describe('buildAssetList', () => {
  it('maps glb files to urls + matches sibling previews, newest first', () => {
    const list = buildAssetList(
      [
        { name: 'chair.glb', sizeBytes: 100, mtimeMs: 1 },
        { name: 'bestof.glb', sizeBytes: 200, mtimeMs: 5 },
      ],
      new Set(['bestof.preview.png']),
    );
    expect(list.map((a) => a.name)).toEqual(['bestof.glb', 'chair.glb']); // newest first
    expect(list[0].url).toBe('/api/visual-gen/asset/bestof.glb');
    expect(list[0].previewUrl).toBe('/api/visual-gen/asset/bestof.preview.png');
    expect(list[1].previewUrl).toBeNull(); // no chair.preview.png
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/visual-gen/generated-assets.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/visual-gen/generated-assets"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/visual-gen/generated-assets.ts
/** Pure helpers for the /3d studio's generated-asset gallery + serving route. */

export interface GeneratedAsset {
  name: string;
  sizeBytes: number;
  mtimeMs: number;
  url: string;
  previewUrl: string | null;
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(glb|gltf|png)$/;

/** A safe basename to read from the whitelisted generated dir, or null. Pure. */
export function safeAssetName(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  return NAME_RE.test(name) ? name : null;
}

/** Shape the gallery list: each .glb → its serving url + sibling preview (if present), newest first. Pure. */
export function buildAssetList(
  glb: { name: string; sizeBytes: number; mtimeMs: number }[],
  previewNames: Set<string>,
): GeneratedAsset[] {
  return glb
    .map((g) => {
      const previewName = g.name.replace(/\.glb$/i, '.preview.png');
      return {
        name: g.name,
        sizeBytes: g.sizeBytes,
        mtimeMs: g.mtimeMs,
        url: `/api/visual-gen/asset/${encodeURIComponent(g.name)}`,
        previewUrl: previewNames.has(previewName) ? `/api/visual-gen/asset/${encodeURIComponent(previewName)}` : null,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/visual-gen/generated-assets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/visual-gen/generated-assets.ts src/__tests__/lib/visual-gen/generated-assets.test.ts
git commit -m "feat(3d): pure generated-asset list + path-safety helpers"
```

---

### Task 2: Asset-serving route

**Files:**
- Create: `src/app/api/visual-gen/asset/[name]/route.ts`

**Interfaces:**
- Consumes: `safeAssetName` (Task 1).
- Produces: `GET /api/visual-gen/asset/:name` → the file bytes (`.glb`→`model/gltf-binary`, `.gltf`→`model/gltf+json`, `.png`→`image/png`), or `apiError(...,404)`.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/visual-gen/asset/[name]/route.ts
import { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { apiError } from '@/lib/api-utils';
import { safeAssetName } from '@/lib/visual-gen/generated-assets';

const MIME: Record<string, string> = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  png: 'image/png',
};

/**
 * GET /api/visual-gen/asset/:name
 * Serves one generated mesh/preview from generated/triposr/. Safe by construction:
 * the name is validated to a plain basename (safeAssetName) and joined under the
 * whitelisted dir — no traversal surface.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = safeAssetName(decodeURIComponent(name));
  if (!safe) return apiError('invalid asset name', 400);
  const ext = safe.split('.').pop() ?? '';
  const path = join(process.cwd(), 'generated', 'triposr', safe);
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch {
    return apiError('asset not found', 404);
  }
}
```

- [ ] **Step 2: Verify by running**

Start the dev server (`npm run dev`) in another terminal. With at least one mesh present under `generated/triposr/` (e.g. `chair.glb`):
Run: `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/api/visual-gen/asset/chair.glb`
Expected: `200 model/gltf-binary`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/visual-gen/asset/..%2Fpackage.json"`
Expected: `400` or `404` (never serves outside the dir).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/visual-gen/asset/[name]/route.ts"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/visual-gen/asset/[name]/route.ts"
git commit -m "feat(3d): safe serving route for generated meshes"
```

---

### Task 3: Asset-enumeration route

**Files:**
- Create: `src/app/api/visual-gen/assets/route.ts`

**Interfaces:**
- Consumes: `buildAssetList`, `GeneratedAsset` (Task 1).
- Produces: `GET /api/visual-gen/assets` → `apiSuccess({ assets: GeneratedAsset[] })`.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/visual-gen/assets/route.ts
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { buildAssetList } from '@/lib/visual-gen/generated-assets';

/** GET /api/visual-gen/assets — list the generated TripoSR meshes (+ preview thumbnails). */
export async function GET() {
  const dir = join(process.cwd(), 'generated', 'triposr');
  try {
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return apiSuccess({ assets: [] }); // dir absent → empty gallery, not an error
    }
    const previewNames = new Set(files.filter((f) => f.toLowerCase().endsWith('.preview.png')));
    const glbNames = files.filter((f) => f.toLowerCase().endsWith('.glb'));
    const glb = await Promise.all(
      glbNames.map(async (name) => {
        const s = await stat(join(dir, name));
        return { name, sizeBytes: s.size, mtimeMs: s.mtimeMs };
      }),
    );
    return apiSuccess({ assets: buildAssetList(glb, previewNames) });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'failed to list assets', 500);
  }
}
```

- [ ] **Step 2: Verify by running**

Run: `curl -s http://localhost:3000/api/visual-gen/assets`
Expected: `{"success":true,"data":{"assets":[{"name":"...","url":"/api/visual-gen/asset/...","previewUrl":...},...]}}` (newest first; `assets: []` if the dir is empty/absent).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/visual-gen/assets/route.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/visual-gen/assets/route.ts
git commit -m "feat(3d): enumerate generated meshes for the gallery"
```

---

### Task 4: AssetGallery component

**Files:**
- Create: `src/components/studio-3d/AssetGallery.tsx`
- Test: `src/__tests__/components/studio-3d/AssetGallery.test.tsx`

**Interfaces:**
- Consumes: `GeneratedAsset` (Task 1); `tryApiFetch` from `@/lib/api-utils`.
- Produces: `<AssetGallery activeUrl={string | null} onPick={(asset: GeneratedAsset) => void} />` — fetches `/api/visual-gen/assets` on mount, renders cards; clicking a card calls `onPick`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/studio-3d/AssetGallery.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { AssetGallery } from '@/components/studio-3d/AssetGallery';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;
const ASSET = { name: 'chair.glb', sizeBytes: 1000, mtimeMs: 1, url: '/api/visual-gen/asset/chair.glb', previewUrl: null };

describe('AssetGallery', () => {
  it('lists generated assets and fires onPick on click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ assets: [ASSET] })));
    const onPick = vi.fn();
    render(<AssetGallery activeUrl={null} onPick={onPick} />);
    await waitFor(() => expect(screen.getByText('chair.glb')).toBeTruthy());
    fireEvent.click(screen.getByText('chair.glb'));
    expect(onPick).toHaveBeenCalledWith(ASSET);
  });

  it('shows the empty state when there are no assets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ assets: [] })));
    render(<AssetGallery activeUrl={null} onPick={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No generated assets/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/studio-3d/AssetGallery.test.tsx`
Expected: FAIL — cannot resolve `@/components/studio-3d/AssetGallery`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/studio-3d/AssetGallery.tsx
'use client';

import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
import { formatBytes } from '@/lib/format';
import { logger } from '@/lib/logger';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

export function AssetGallery({ activeUrl, onPick }: { activeUrl: string | null; onPick: (a: GeneratedAsset) => void }) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    tryApiFetch<{ assets: GeneratedAsset[] }>('/api/visual-gen/assets').then((r) => {
      if (!live) return;
      if (r.ok) { setAssets(r.data.assets); setError(null); }
      else { setError(r.error); logger.error('asset gallery fetch failed', r.error); }
    });
    return () => { live = false; };
  }, [reload]);

  return (
    <aside className="flex flex-col h-full w-[240px] shrink-0 border-r border-border bg-surface/40 overflow-hidden" aria-label="Generated assets">
      <header className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Boxes size={14} className="text-text-muted" />
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Generated ({assets.length})</span>
      </header>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {error ? (
          <div className="text-xs text-red-400">
            {error} <button onClick={() => setReload((n) => n + 1)} className="underline">Retry</button>
          </div>
        ) : assets.length === 0 ? (
          <p className="text-2xs text-text-muted p-2">No generated assets yet — run the asset pipeline.</p>
        ) : (
          assets.map((a) => (
            <button
              key={a.name}
              onClick={() => onPick(a)}
              className={`w-full flex items-center gap-2 rounded p-1.5 text-left transition-colors ${
                activeUrl === a.url ? 'bg-[var(--visual-gen)]/15 ring-1 ring-[var(--visual-gen)]' : 'hover:bg-surface'
              }`}
            >
              <div className="h-10 w-10 shrink-0 rounded bg-surface-deep overflow-hidden flex items-center justify-center">
                {a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Boxes size={16} className="text-text-muted" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-text" title={a.name}>{a.name}</div>
                <div className="text-2xs text-text-muted">{formatBytes(a.sizeBytes)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
```

Note: `formatBytes` exists in `@/lib/format` (verify the export name; if it differs, inline `(b) => \`${(b/1024/1024).toFixed(1)} MB\``).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/studio-3d/AssetGallery.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/studio-3d/AssetGallery.tsx src/__tests__/components/studio-3d/AssetGallery.test.tsx
git commit -m "feat(3d): generated-asset gallery rail"
```

---

### Task 5: Studio3D shell + /3d page

**Files:**
- Create: `src/components/studio-3d/Studio3D.tsx`
- Create: `src/app/3d/page.tsx`

**Interfaces:**
- Consumes: `AssetGallery` (Task 4); `GeneratedAsset` (Task 1); and the reused `useViewerStore` (`setModel(url, name?)`, `modelUrl`, `modelName`, `renderMode`, `showGrid`, `showAxes`, `autoRotate`, `setRenderMode`, `toggleGrid`, `toggleAxes`, `toggleAutoRotate`), `ViewerToolbar` (props per its interface), `AssetInspector` (`{ modelName }`), `SceneViewer` (`{ modelUrl, renderMode, showGrid, showAxes, autoRotate, canvasRef }`) from `@/components/modules/visual-gen/asset-viewer/*`.
- Produces: the `/3d` page.

- [ ] **Step 1: Write Studio3D**

```tsx
// src/components/studio-3d/Studio3D.tsx
'use client';

import { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ViewerToolbar } from '@/components/modules/visual-gen/asset-viewer/ViewerToolbar';
import { AssetInspector } from '@/components/modules/visual-gen/asset-viewer/AssetInspector';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { AssetGallery } from './AssetGallery';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

// Three.js needs the browser — never SSR the canvas.
const SceneViewer = dynamic(
  () => import('@/components/modules/visual-gen/asset-viewer/SceneViewer').then((m) => ({ default: m.SceneViewer })),
  { ssr: false },
);

export function Studio3D() {
  const modelUrl = useViewerStore((s) => s.modelUrl);
  const modelName = useViewerStore((s) => s.modelName);
  const renderMode = useViewerStore((s) => s.renderMode);
  const showGrid = useViewerStore((s) => s.showGrid);
  const showAxes = useViewerStore((s) => s.showAxes);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const setModel = useViewerStore((s) => s.setModel);
  const setRenderMode = useViewerStore((s) => s.setRenderMode);
  const toggleGrid = useViewerStore((s) => s.toggleGrid);
  const toggleAxes = useViewerStore((s) => s.toggleAxes);
  const toggleAutoRotate = useViewerStore((s) => s.toggleAutoRotate);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onPick = useCallback((a: GeneratedAsset) => setModel(a.url, a.name), [setModel]);
  const onFileLoad = useCallback((url: string, name: string) => setModel(url, name), [setModel]);
  const onScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${modelName?.replace(/\.[^.]+$/, '') ?? 'viewport'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [modelName]);

  return (
    <div className="flex h-screen flex-col bg-background text-text">
      <header className="flex items-center gap-2 border-b border-border px-4 h-11 shrink-0">
        <span className="text-sm font-semibold">3D Studio</span>
        <span className="text-xs text-text-muted">preview generated assets before Unreal</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <AssetGallery activeUrl={modelUrl} onPick={onPick} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ViewerToolbar
            renderMode={renderMode} showGrid={showGrid} showAxes={showAxes} autoRotate={autoRotate}
            modelName={modelName} onFileLoad={onFileLoad} onRenderModeChange={setRenderMode}
            onToggleGrid={toggleGrid} onToggleAxes={toggleAxes} onToggleAutoRotate={toggleAutoRotate}
            onScreenshot={onScreenshot}
          />
          <div className="min-h-0 flex-1 p-2">
            <SceneViewer modelUrl={modelUrl} renderMode={renderMode} showGrid={showGrid} showAxes={showAxes} autoRotate={autoRotate} canvasRef={canvasRef} />
          </div>
        </div>
        <AssetInspector modelName={modelName} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// src/app/3d/page.tsx
import { Studio3D } from '@/components/studio-3d/Studio3D';

/** /3d — studio viewer for the generated 3D assets (preview + rotate before Unreal). */
export default function Studio3DPage() {
  return <Studio3D />;
}
```

- [ ] **Step 3: Verify by running the app**

Start `npm run dev`. Open `http://localhost:3000/3d`. Confirm:
- The gallery rail lists generated `.glb`s (or the empty state); clicking one loads it in the viewport.
- The model rotates/zooms/pans (OrbitControls); render-mode toggle (Textured/Solid/Wire), Grid/Axes/Rotate toggles, and Screenshot all work.
- The right Inspector shows triangles/vertices/materials/bounding box for the loaded mesh.
- "Load Model" picks a local `.glb` and previews it.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/studio-3d/Studio3D.tsx src/app/3d/page.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/studio-3d/Studio3D.tsx src/app/3d/page.tsx
git commit -m "feat(3d): studio shell + /3d route"
```

---

### Task 6: TopBar nav link

**Files:**
- Modify: `src/components/layout/TopBar.tsx` (add a "3D Studio" link in the right-side cluster, next to the existing "Experiment" link added earlier)

**Interfaces:**
- Consumes: nothing new. Mirrors the existing `ExperimentLabLink` pattern in `TopBar.tsx`.

- [ ] **Step 1: Add the import**

In `TopBar.tsx`, add `Boxes` to the existing `lucide-react` import line (e.g. `} from 'lucide-react';` → include `Boxes`).

- [ ] **Step 2: Render the link in the right cluster**

Find the right-side cluster that renders `<ExperimentLabLink />` (added earlier) and add `<Studio3DLink />` next to it:

```tsx
<Studio3DLink />
<ExperimentLabLink />
```

- [ ] **Step 3: Add the component (next to the existing `ExperimentLabLink` function)**

```tsx
function Studio3DLink() {
  return (
    <a
      href="/3d"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text bg-background border border-border hover:border-border-bright transition-colors focus-ring"
      title="3D Studio — preview generated assets"
    >
      <Boxes className="w-3 h-3" aria-hidden="true" />
      <span className="hidden sm:inline">3D Studio</span>
    </a>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/layout/TopBar.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat(3d): TopBar link to the 3D Studio"
```

---

## Self-Review

**Spec coverage:**
- Studio viewer + live mesh stats → Task 5 (reuses SceneViewer + AssetInspector). ✓
- Gallery of generated outputs → Tasks 1/3/4. ✓
- Upload arbitrary local files → Task 5 (`ViewerToolbar.onFileLoad`). ✓
- Serving route (assets outside public/) → Task 2 (safe). ✓
- Enumeration route → Task 3. ✓
- Nav link → Task 6. ✓
- Testing (pure helpers + gallery render; r3f not unit-tested) → Tasks 1, 4. ✓
- Error/empty states → Task 4 (gallery error/empty), Task 2/3 (404/empty). ✓
- QA cockpit deferred → not in plan (correct). ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. The one judgment note (Task 4 `formatBytes` export name) includes an inline fallback. ✓

**Type consistency:** `GeneratedAsset` (Task 1) is consumed unchanged by Tasks 2/3/4/5. `safeAssetName`/`buildAssetList` signatures match across Tasks 1↔2↔3. `setModel(url, name?)`, `ViewerToolbar`/`AssetInspector`/`SceneViewer` props in Task 5 match the read source files. ✓
