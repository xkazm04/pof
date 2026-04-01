'use client';

import { useCallback } from 'react';
import { Upload, X } from 'lucide-react';
import { useMaterialStore, BUILT_IN_PRESETS, type PreviewMesh } from './useMaterialStore';
import { StyledSlider } from '@/components/ui/StyledSlider';

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <StyledSlider
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      accentColor="var(--visual-gen)"
      label={label}
      displayValue={value.toFixed(2)}
    />
  );
}

function TextureSlot({
  label,
  channel,
  textureUrl,
}: {
  label: string;
  channel: 'albedo' | 'normal' | 'metallic' | 'roughness' | 'ao';
  textureUrl: string | null;
}) {
  const setTexture = useMaterialStore((s) => s.setTexture);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setTexture(channel, url);
    e.target.value = '';
  }, [channel, setTexture]);

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center justify-center w-10 h-10 rounded border border-border cursor-pointer hover:border-[var(--visual-gen)] transition-colors overflow-hidden">
        {textureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={textureUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Upload size={12} className="text-text-muted" />
        )}
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </label>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-text">{label}</span>
      </div>
      {textureUrl && (
        <button
          onClick={() => setTexture(channel, null)}
          className="text-text-muted hover:text-text"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

const MESH_OPTIONS: { value: PreviewMesh; label: string }[] = [
  { value: 'sphere', label: 'Sphere' },
  { value: 'cube', label: 'Cube' },
  { value: 'plane', label: 'Plane' },
  { value: 'cylinder', label: 'Cylinder' },
];

export function PBREditor() {
  const params = useMaterialStore((s) => s.params);
  const previewMesh = useMaterialStore((s) => s.previewMesh);
  const setParam = useMaterialStore((s) => s.setParam);
  const setParams = useMaterialStore((s) => s.setParams);
  const setPreviewMesh = useMaterialStore((s) => s.setPreviewMesh);

  const albedoTexture = useMaterialStore((s) => s.albedoTexture);
  const normalTexture = useMaterialStore((s) => s.normalTexture);
  const metallicTexture = useMaterialStore((s) => s.metallicTexture);
  const roughnessTexture = useMaterialStore((s) => s.roughnessTexture);
  const aoTexture = useMaterialStore((s) => s.aoTexture);

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Material Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setParams(preset.params)}
              className="px-2 py-1 text-xs rounded border border-border text-text-muted hover:text-text hover:border-[var(--visual-gen)] transition-colors"
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: preset.params.baseColor }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Base Color */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Base Color (Albedo)</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={params.baseColor}
            onChange={(e) => setParam('baseColor', e.target.value)}
            className="w-8 h-8 rounded border border-border cursor-pointer"
          />
          <span className="text-xs text-text-muted font-mono">{params.baseColor}</span>
        </div>
      </div>

      {/* Sliders */}
      <Slider label="Metallic" value={params.metallic} min={0} max={1} step={0.01} onChange={(v) => setParam('metallic', v)} />
      <Slider label="Roughness" value={params.roughness} min={0} max={1} step={0.01} onChange={(v) => setParam('roughness', v)} />
      <Slider label="Normal Strength" value={params.normalStrength} min={0} max={2} step={0.01} onChange={(v) => setParam('normalStrength', v)} />
      <Slider label="AO Strength" value={params.aoStrength} min={0} max={1} step={0.01} onChange={(v) => setParam('aoStrength', v)} />

      {/* Texture Maps */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Texture Maps</label>
        <div className="space-y-2">
          <TextureSlot label="Albedo" channel="albedo" textureUrl={albedoTexture} />
          <TextureSlot label="Normal" channel="normal" textureUrl={normalTexture} />
          <TextureSlot label="Metallic" channel="metallic" textureUrl={metallicTexture} />
          <TextureSlot label="Roughness" channel="roughness" textureUrl={roughnessTexture} />
          <TextureSlot label="AO" channel="ao" textureUrl={aoTexture} />
        </div>
      </div>

      {/* Preview mesh selector */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Preview Shape</label>
        <div className="flex gap-1.5">
          {MESH_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPreviewMesh(value)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                previewMesh === value
                  ? 'bg-[var(--visual-gen)] text-white'
                  : 'text-text-muted hover:text-text border border-border'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
