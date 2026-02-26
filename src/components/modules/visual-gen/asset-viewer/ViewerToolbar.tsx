'use client';

import { useRef, useCallback } from 'react';
import { Upload, Grid3x3, Compass, RotateCcw, Camera, Box } from 'lucide-react';
import type { RenderMode } from './useViewerStore';

interface ViewerToolbarProps {
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

const RENDER_MODES: { value: RenderMode; label: string }[] = [
  { value: 'textured', label: 'Textured' },
  { value: 'solid', label: 'Solid' },
  { value: 'wireframe', label: 'Wire' },
];

const ACCEPTED_FORMATS = '.glb,.gltf,.fbx';

export function ViewerToolbar({
  renderMode,
  showGrid,
  showAxes,
  autoRotate,
  modelName,
  onFileLoad,
  onRenderModeChange,
  onToggleGrid,
  onToggleAxes,
  onToggleAutoRotate,
  onScreenshot,
}: ViewerToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous URL if any
    const url = URL.createObjectURL(file);
    onFileLoad(url, file.name);

    // Reset input so the same file can be re-loaded
    e.target.value = '';
  }, [onFileLoad]);

  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-border bg-surface/50">
      {/* File picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                   bg-[var(--visual-gen)] text-white hover:brightness-110 transition-all"
      >
        <Upload size={14} />
        Load Model
      </button>

      {/* Current model name */}
      {modelName && (
        <span className="text-xs text-text-muted truncate max-w-[150px]" title={modelName}>
          {modelName}
        </span>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Render mode selector */}
      <div className="flex items-center gap-0.5 bg-surface rounded p-0.5">
        {RENDER_MODES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onRenderModeChange(value)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              renderMode === value
                ? 'bg-[var(--visual-gen)] text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Toggle buttons */}
      <ToggleButton active={showGrid} onClick={onToggleGrid} icon={Grid3x3} label="Grid" />
      <ToggleButton active={showAxes} onClick={onToggleAxes} icon={Compass} label="Axes" />
      <ToggleButton active={autoRotate} onClick={onToggleAutoRotate} icon={RotateCcw} label="Rotate" />

      <div className="flex-1" />

      {/* Screenshot */}
      <button
        onClick={onScreenshot}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted
                   hover:text-text hover:bg-surface transition-colors"
        title="Capture screenshot"
      >
        <Camera size={14} />
        Screenshot
      </button>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
        active
          ? 'text-[var(--visual-gen)] bg-[var(--visual-gen)]/10'
          : 'text-text-muted hover:text-text'
      }`}
      title={`Toggle ${label}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
