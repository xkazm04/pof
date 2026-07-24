'use client';

import { useRef, useCallback } from 'react';
import { Upload, Grid3x3, Compass, RotateCcw, Camera } from 'lucide-react';
import { Button } from '@/components/layout-lab/ui/Button';
import type { RenderMode } from '@/components/modules/visual-gen/asset-viewer/useViewerStore';

interface StudioToolbarProps {
  renderMode: RenderMode;
  showGrid: boolean;
  showAxes: boolean;
  autoRotate: boolean;
  modelName: string | null;
  onFileLoad: (url: string, name: string) => void;
  onRenderModeChange: (mode: RenderMode) => void;
  onToggleGrid: () => void;
  onToggleAxes: () => void;
  onToggleAutoRotate: () => void;
  onScreenshot: () => void;
}

const MODES: { value: RenderMode; label: string }[] = [
  { value: 'textured', label: 'Textured' },
  { value: 'solid', label: 'Solid' },
  { value: 'wireframe', label: 'Wireframe' },
];

const groupStyle = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--lab-s2)' } as const;

/** Blueprint toolbar for /3d — lab Buttons for load / render-mode / grid·axes·rotate / screenshot. */
export function StudioToolbar({
  renderMode, showGrid, showAxes, autoRotate, modelName,
  onFileLoad, onRenderModeChange, onToggleGrid, onToggleAxes, onToggleAutoRotate, onScreenshot,
}: StudioToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileLoad(URL.createObjectURL(file), file.name);
    e.target.value = '';
  }, [onFileLoad]);

  const hasModel = !!modelName;

  return (
    <div role="group" aria-label="Viewport controls" style={{ ...groupStyle, padding: 'var(--lab-s2) var(--lab-s4)', borderBottom: '1px solid var(--lab-line)', background: 'var(--lab-panel)' }}>
      <input ref={fileRef} type="file" accept=".glb,.gltf" onChange={onFileChange} style={{ display: 'none' }} />
      <Button variant="solid" onClick={() => fileRef.current?.click()} title="Open a .glb or .gltf model from your computer"><Upload size={13} aria-hidden /> Load model</Button>
      {modelName && (
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: 'var(--lab-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={modelName}>
          {modelName}
        </span>
      )}
      <Sep />
      <div role="group" aria-label="Render mode" style={groupStyle}>
        {MODES.map((m) => (
          <Button key={m.value} active={renderMode === m.value} onClick={() => onRenderModeChange(m.value)}>{m.label}</Button>
        ))}
      </div>
      <Sep />
      <div role="group" aria-label="Viewport helpers" style={groupStyle}>
        <Button active={showGrid} onClick={onToggleGrid}><Grid3x3 size={13} aria-hidden /> Grid</Button>
        <Button active={showAxes} onClick={onToggleAxes}><Compass size={13} aria-hidden /> Axes</Button>
        <Button active={autoRotate} onClick={onToggleAutoRotate}><RotateCcw size={13} aria-hidden /> Rotate</Button>
      </div>
      <div style={{ flex: 1 }} />
      <Button
        onClick={onScreenshot}
        disabled={!hasModel}
        title={hasModel ? 'Save a PNG of the current viewport' : 'Load a model to capture the viewport'}
        style={hasModel ? undefined : { opacity: 0.5, cursor: 'not-allowed' }}
      >
        <Camera size={13} aria-hidden /> Screenshot
      </Button>
    </div>
  );
}

function Sep() {
  return <div aria-hidden style={{ width: 1, height: 18, background: 'var(--lab-line)', margin: '0 var(--lab-s1)' }} />;
}
