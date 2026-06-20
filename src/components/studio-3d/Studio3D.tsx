'use client';

import { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { labFontVars } from '@/components/layout-lab/fonts';
import { LIGHT } from '@/components/layout-lab/theme';
import { useViewerStore } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';
import { AssetGallery } from './AssetGallery';
import { StudioToolbar } from './StudioToolbar';
import { StudioInspector } from './StudioInspector';
import type { GeneratedAsset } from '@/lib/visual-gen/generated-assets';

// Three.js needs the browser — never SSR the canvas.
const SceneViewer = dynamic(
  () => import('@/components/modules/visual-gen/asset-viewer/SceneViewer').then((m) => ({ default: m.SceneViewer })),
  { ssr: false },
);

// Blueprint floor-grid line color, sourced from the lab theme (a concrete hex —
// three.js can't read CSS vars). LIGHT.gridLine is non-null for the Blueprint theme.
const BLUEPRINT_GRID = LIGHT.gridLine ?? undefined;

/** Blueprint-themed 3D studio: gallery rail · viewport · inspector, locked to the
 *  lab's Blueprint (light) theme via data-theme + --lab-* tokens. */
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
    <div
      data-theme="blueprint"
      className={labFontVars}
      style={{ display: 'flex', height: '100vh', flexDirection: 'column', background: 'var(--lab-bg)', color: 'var(--lab-ink)', fontFamily: 'var(--lab-font-body)' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s3)', height: 44, flexShrink: 0, padding: '0 var(--lab-s4)', borderBottom: '1px solid var(--lab-line)', background: 'var(--lab-panel)' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--lab-ink)' }}>PoF · 3D Studio</span>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)' }}>preview generated assets before Unreal</span>
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <AssetGallery activeUrl={modelUrl} onPick={onPick} />
        <div style={{ display: 'flex', flex: 1, minWidth: 0, flexDirection: 'column' }}>
          <StudioToolbar
            renderMode={renderMode} showGrid={showGrid} showAxes={showAxes} autoRotate={autoRotate}
            modelName={modelName} onFileLoad={onFileLoad} onRenderModeChange={setRenderMode}
            onToggleGrid={toggleGrid} onToggleAxes={toggleAxes} onToggleAutoRotate={toggleAutoRotate}
            onScreenshot={onScreenshot}
          />
          <div style={{ flex: 1, minHeight: 0, padding: 'var(--lab-s2)' }}>
            <SceneViewer
              modelUrl={modelUrl} renderMode={renderMode} showGrid={showGrid} showAxes={showAxes} autoRotate={autoRotate}
              canvasRef={canvasRef} gridColor={BLUEPRINT_GRID} backgroundColor="var(--lab-bg)"
            />
          </div>
        </div>
        <StudioInspector modelName={modelName} />
      </div>
    </div>
  );
}
