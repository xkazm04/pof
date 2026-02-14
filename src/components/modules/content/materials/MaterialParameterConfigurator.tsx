'use client';

import { useState, useCallback } from 'react';
import {
  Zap, Gem, Shirt, User, Droplets, Flame, Leaf, Blocks, CircleDot,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type SurfaceType = 'metal' | 'cloth' | 'skin' | 'glass' | 'water' | 'emissive' | 'foliage' | 'stone';
export type RenderFeature = 'subsurface' | 'parallax' | 'emissive' | 'refraction' | 'tessellation' | 'worldPositionOffset';
export type MaterialOutputType = 'master' | 'instance';

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
}

export interface MaterialConfiguratorConfig {
  surfaceType: SurfaceType;
  features: RenderFeature[];
  outputType: MaterialOutputType;
  params: Record<string, ParameterRange>;
}

// ── Static Data ──

interface SurfaceDef {
  id: SurfaceType;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  defaultFeatures: RenderFeature[];
}

const SURFACES: SurfaceDef[] = [
  { id: 'metal',    label: 'Metal',    icon: Gem,       color: '#94a3b8', description: 'PBR metallic: high metallic, low roughness, sharp reflections', defaultFeatures: [] },
  { id: 'cloth',    label: 'Cloth',    icon: Shirt,     color: '#a78bfa', description: 'Fabric shading with fuzz, thread detail, anisotropy', defaultFeatures: ['subsurface'] },
  { id: 'skin',     label: 'Skin',     icon: User,      color: '#fb923c', description: 'Subsurface skin: SSS profile, pore detail, translucency', defaultFeatures: ['subsurface'] },
  { id: 'glass',    label: 'Glass',    icon: Droplets,  color: '#38bdf8', description: 'Translucent glass with refraction, IOR, tint color', defaultFeatures: ['refraction'] },
  { id: 'water',    label: 'Water',    icon: Droplets,  color: '#22d3ee', description: 'Animated water surface with depth fade, caustics', defaultFeatures: ['refraction', 'worldPositionOffset'] },
  { id: 'emissive', label: 'Emissive', icon: Flame,     color: '#f97316', description: 'Self-illuminating surfaces: neon, lava, magic effects', defaultFeatures: ['emissive'] },
  { id: 'foliage',  label: 'Foliage',  icon: Leaf,      color: '#22c55e', description: 'Two-sided foliage with subsurface, wind animation', defaultFeatures: ['subsurface', 'worldPositionOffset'] },
  { id: 'stone',    label: 'Stone',    icon: Blocks,    color: '#78716c', description: 'Rock/brick with parallax occlusion depth detail', defaultFeatures: ['parallax'] },
];

interface FeatureDef {
  id: RenderFeature;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}

const FEATURES: FeatureDef[] = [
  { id: 'subsurface',          label: 'Subsurface Scattering', shortLabel: 'SSS',       description: 'Light passes through material (skin, wax, leaves)', color: '#fb923c' },
  { id: 'parallax',            label: 'Parallax Occlusion',    shortLabel: 'Parallax',   description: 'Depth illusion from heightmap without extra geometry', color: '#78716c' },
  { id: 'emissive',            label: 'Emissive',              shortLabel: 'Emissive',   description: 'Self-illumination channel for glowing regions', color: '#fbbf24' },
  { id: 'refraction',          label: 'Refraction',            shortLabel: 'Refract',    description: 'Light bending through translucent surfaces', color: '#38bdf8' },
  { id: 'tessellation',        label: 'Tessellation / Nanite', shortLabel: 'Tess',       description: 'Subdivide mesh for displacement detail (UE5.4+ Nanite)', color: '#a78bfa' },
  { id: 'worldPositionOffset', label: 'World Position Offset', shortLabel: 'WPO',        description: 'Vertex animation: wind, waves, breathing', color: '#22c55e' },
];

interface ParamDef {
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step: number;
  /** Which surface types this param applies to. Empty = all. */
  surfaces?: SurfaceType[];
}

const BASE_PARAMS: ParamDef[] = [
  { name: 'Roughness',  label: 'Roughness',  min: 0, max: 1, defaultValue: 0.5, step: 0.05 },
  { name: 'Metallic',   label: 'Metallic',   min: 0, max: 1, defaultValue: 0,   step: 0.1 },
  { name: 'Opacity',    label: 'Opacity',    min: 0, max: 1, defaultValue: 1,   step: 0.05, surfaces: ['glass', 'water'] },
  { name: 'IOR',        label: 'IOR',        min: 1, max: 2.5, defaultValue: 1.5, step: 0.1, surfaces: ['glass', 'water'] },
  { name: 'EmissiveIntensity', label: 'Emissive Intensity', min: 0, max: 20, defaultValue: 5, step: 0.5, surfaces: ['emissive'] },
  { name: 'SubsurfaceRadius',  label: 'SSS Radius',        min: 0.1, max: 5, defaultValue: 1.2, step: 0.1, surfaces: ['skin', 'cloth', 'foliage'] },
  { name: 'ParallaxDepth',     label: 'Parallax Depth',    min: 0.01, max: 0.2, defaultValue: 0.05, step: 0.01, surfaces: ['stone'] },
];

// ── Helpers ──

function getDefaultMetallic(surface: SurfaceType): number {
  return surface === 'metal' ? 1 : 0;
}

function getDefaultRoughness(surface: SurfaceType): number {
  switch (surface) {
    case 'metal': return 0.2;
    case 'glass': return 0.05;
    case 'water': return 0.02;
    case 'skin': return 0.6;
    case 'cloth': return 0.8;
    case 'stone': return 0.7;
    default: return 0.5;
  }
}

function getApplicableParams(surface: SurfaceType): ParamDef[] {
  return BASE_PARAMS.filter((p) => !p.surfaces || p.surfaces.includes(surface));
}

// ── Component ──

const ACCENT = '#f59e0b';

interface MaterialParameterConfiguratorProps {
  onGenerate: (config: MaterialConfiguratorConfig) => void;
  isGenerating: boolean;
}

export function MaterialParameterConfigurator({ onGenerate, isGenerating }: MaterialParameterConfiguratorProps) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('metal');
  const [features, setFeatures] = useState<RenderFeature[]>([]);
  const [outputType, setOutputType] = useState<MaterialOutputType>('master');
  const [paramValues, setParamValues] = useState<Record<string, number>>({});

  const selectSurface = useCallback((s: SurfaceType) => {
    setSurfaceType(s);
    const def = SURFACES.find((x) => x.id === s);
    setFeatures(def?.defaultFeatures ?? []);
    // Reset params to surface defaults
    setParamValues({
      Roughness: getDefaultRoughness(s),
      Metallic: getDefaultMetallic(s),
    });
  }, []);

  const toggleFeature = useCallback((f: RenderFeature) => {
    setFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }, []);

  const setParam = useCallback((name: string, value: number) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const applicableParams = getApplicableParams(surfaceType);
  const surfaceDef = SURFACES.find((s) => s.id === surfaceType)!;

  const handleGenerate = useCallback(() => {
    const params: Record<string, ParameterRange> = {};
    for (const p of applicableParams) {
      const val = paramValues[p.name] ?? p.defaultValue;
      params[p.name] = { name: p.name, min: p.min, max: p.max, defaultValue: val, step: p.step };
    }
    onGenerate({ surfaceType, features, outputType, params });
  }, [surfaceType, features, outputType, paramValues, applicableParams, onGenerate]);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CircleDot className="w-4 h-4" style={{ color: ACCENT }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Material Configurator</h3>
          <p className="text-2xs text-text-muted">Configure surface, features, and parameters</p>
        </div>
      </div>

      {/* ─── Surface Type ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Surface Type</h4>
        <div className="grid grid-cols-4 gap-1.5">
          {SURFACES.map((s) => {
            const isActive = surfaceType === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => selectSurface(s.id)}
                className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-all text-center"
                style={{
                  backgroundColor: isActive ? `${s.color}15` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${s.color}50` : 'var(--border)'}`,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? s.color : '#4a4e6a' }} />
                <span className="text-2xs font-medium" style={{ color: isActive ? s.color : 'var(--text-muted)' }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-2xs text-text-muted px-1">{surfaceDef.description}</p>
      </div>

      {/* ─── Output Type ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Output Type</h4>
        <div className="flex gap-2">
          {([
            { id: 'master' as const, label: 'Master Material', desc: 'Full shader with parameters and switches' },
            { id: 'instance' as const, label: 'Material Instance', desc: 'Instance of existing master material' },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setOutputType(opt.id)}
              className="flex-1 px-3 py-2 rounded-lg text-left transition-all"
              style={{
                backgroundColor: outputType === opt.id ? `${ACCENT}12` : 'var(--surface-deep)',
                border: `1px solid ${outputType === opt.id ? `${ACCENT}40` : 'var(--border)'}`,
              }}
            >
              <span
                className="text-xs font-semibold block"
                style={{ color: outputType === opt.id ? ACCENT : 'var(--text-muted)' }}
              >
                {opt.label}
              </span>
              <span className="text-2xs text-[#4a4e6a]">{opt.desc}</span>
            </button>
          ))}
        </div>
        {outputType === 'instance' && (
          <p className="text-2xs px-1 py-1 rounded bg-[#f59e0b08] border border-[#f59e0b15] text-[#f59e0bcc]">
            Recommended: Use Material Instances for per-object variation without recompiling shaders.
          </p>
        )}
      </div>

      {/* ─── Rendering Features ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">Rendering Features</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {FEATURES.map((f) => {
            const isActive = features.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFeature(f.id)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all"
                style={{
                  backgroundColor: isActive ? `${f.color}10` : 'var(--surface-deep)',
                  border: `1px solid ${isActive ? `${f.color}40` : 'var(--border)'}`,
                }}
              >
                {/* Toggle dot */}
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-all"
                  style={{
                    borderColor: isActive ? f.color : 'var(--border-bright)',
                    backgroundColor: isActive ? f.color : 'transparent',
                  }}
                />
                <div className="min-w-0">
                  <span
                    className="text-2xs font-semibold block"
                    style={{ color: isActive ? f.color : 'var(--text-muted)' }}
                  >
                    {f.shortLabel}
                  </span>
                  <span className="text-2xs text-[#4a4e6a] block truncate">{f.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Parameter Ranges ─── */}
      <div className="space-y-2">
        <h4 className="text-2xs font-semibold text-text-muted uppercase tracking-widest">
          Parameters
          <span className="ml-1.5 font-normal normal-case text-[#4a4e6a]">({applicableParams.length} for {surfaceDef.label})</span>
        </h4>
        <div className="space-y-2">
          {applicableParams.map((p) => {
            const val = paramValues[p.name] ?? p.defaultValue;
            return (
              <div
                key={p.name}
                className="px-3 py-2 rounded-lg bg-surface-deep border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-medium text-[#c0c4e0]">{p.label}</span>
                  <span className="text-2xs font-mono text-[#9b9ec0]">{val.toFixed(p.step < 1 ? 2 : 0)}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={(e) => setParam(p.name, parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${surfaceDef.color} 0%, ${surfaceDef.color} ${((val - p.min) / (p.max - p.min)) * 100}%, var(--border) ${((val - p.min) / (p.max - p.min)) * 100}%, var(--border) 100%)`,
                  }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-2xs text-[#3a3e5a]">{p.min}</span>
                  <span className="text-2xs text-[#3a3e5a]">{p.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Generate Button ─── */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${ACCENT}15`,
          color: ACCENT,
          border: `1px solid ${ACCENT}30`,
        }}
      >
        <Zap className="w-3.5 h-3.5" />
        {isGenerating
          ? 'Generating...'
          : `Generate ${outputType === 'master' ? 'Master Material' : 'Material Instance'} — ${surfaceDef.label}`
        }
      </button>
    </div>
  );
}
