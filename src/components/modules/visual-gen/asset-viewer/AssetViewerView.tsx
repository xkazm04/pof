'use client';

import { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Eye } from 'lucide-react';
import { ReviewableModuleView } from '../../shared/ReviewableModuleView';
import type { ExtraTab } from '../../shared/ReviewableModuleView';
import { SUB_MODULE_MAP, getCategoryForSubModule, getModuleChecklist } from '@/lib/module-registry';
import { ViewerToolbar } from './ViewerToolbar';
import { useViewerStore } from './useViewerStore';

// Dynamic import of SceneViewer to avoid SSR issues with Three.js
const SceneViewer = dynamic(
  () => import('./SceneViewer').then((mod) => ({ default: mod.SceneViewer })),
  { ssr: false },
);

function ViewerTab() {
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

  const handleScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = modelName?.replace(/\.[^.]+$/, '') ?? 'viewport';
    link.download = `${name}_${timestamp}.png`;
    link.href = dataUrl;
    link.click();
  }, [modelName]);

  const handleFileLoad = useCallback((url: string, name: string) => {
    setModel(url, name);
  }, [setModel]);

  return (
    <div className="flex flex-col h-full">
      <ViewerToolbar
        renderMode={renderMode}
        showGrid={showGrid}
        showAxes={showAxes}
        autoRotate={autoRotate}
        modelName={modelName}
        onFileLoad={handleFileLoad}
        onRenderModeChange={setRenderMode}
        onToggleGrid={toggleGrid}
        onToggleAxes={toggleAxes}
        onToggleAutoRotate={toggleAutoRotate}
        onScreenshot={handleScreenshot}
      />
      <div className="flex-1 min-h-0">
        <SceneViewer
          modelUrl={modelUrl}
          renderMode={renderMode}
          showGrid={showGrid}
          showAxes={showAxes}
          autoRotate={autoRotate}
          canvasRef={canvasRef}
        />
      </div>
    </div>
  );
}

export function AssetViewerView() {
  const mod = SUB_MODULE_MAP['asset-viewer'];
  const cat = getCategoryForSubModule('asset-viewer');

  if (!mod || !cat) return null;

  const extraTabs: ExtraTab[] = [
    {
      id: 'viewer',
      label: '3D Viewer',
      icon: Eye,
      render: () => <ViewerTab />,
    },
  ];

  return (
    <ReviewableModuleView
      moduleId="asset-viewer"
      moduleLabel={mod.label}
      moduleDescription={mod.description}
      moduleIcon={mod.icon}
      accentColor={cat.accentColor}
      checklist={getModuleChecklist('asset-viewer')}
      quickActions={mod.quickActions}
      extraTabs={extraTabs}
    />
  );
}
