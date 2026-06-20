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
