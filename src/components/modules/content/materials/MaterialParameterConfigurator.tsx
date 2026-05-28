'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Zap, Gem, Shirt, User, Droplets, Flame, Leaf, Blocks, CircleDot, Plug, BookOpen, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useManifest } from '@/hooks/useManifest';
import { MODULE_COLORS } from '@/lib/constants';
import { ACCENT_VIOLET, STATUS_BLOCKER, STATUS_IMPROVED, ACCENT_ORANGE, STATUS_SUCCESS, STATUS_WARNING, STATUS_MUTED, ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import { ParamCue } from '@/components/modules/evaluator/ParamCue';
import type { PPParamPlain } from '@/types/post-process-studio';
import { MaterialBudgetBar } from './MaterialBudgetBar';

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
  /** Plain-English one-liner for the Explain Mode toggle. */
  plain: string;
}

const SURFACES: SurfaceDef[] = [
  { id: 'metal',    label: 'Metal',    icon: Gem,       color: STATUS_MUTED, description: 'PBR metallic: high metallic, low roughness, sharp reflections', defaultFeatures: [], plain: 'A shiny, reflective surface — think steel, gold, or polished armor.' },
  { id: 'cloth',    label: 'Cloth',    icon: Shirt,     color: ACCENT_VIOLET, description: 'Fabric shading with fuzz, thread detail, anisotropy', defaultFeatures: ['subsurface'], plain: 'Fabric that looks soft and threaded — capes, banners, upholstery.' },
  { id: 'skin',     label: 'Skin',     icon: User,      color: STATUS_BLOCKER, description: 'Subsurface skin: SSS profile, pore detail, translucency', defaultFeatures: ['subsurface'], plain: 'Skin that lets a little light pass through, the way a real face does.' },
  { id: 'glass',    label: 'Glass',    icon: Droplets,  color: STATUS_IMPROVED, description: 'Translucent glass with refraction, IOR, tint color', defaultFeatures: ['refraction'], plain: 'Clear or tinted glass that bends what you see behind it.' },
  { id: 'water',    label: 'Water',    icon: Droplets,  color: ACCENT_CYAN_LIGHT, description: 'Animated water surface with depth fade, caustics', defaultFeatures: ['refraction', 'worldPositionOffset'], plain: 'A living water surface — ripples, refraction, depth fade in the shallows.' },
  { id: 'emissive', label: 'Emissive', icon: Flame,     color: ACCENT_ORANGE, description: 'Self-illuminating surfaces: neon, lava, magic effects', defaultFeatures: ['emissive'], plain: 'A surface that gives off its own light — runes, lava, magic, neon signs.' },
  { id: 'foliage',  label: 'Foliage',  icon: Leaf,      color: STATUS_SUCCESS, description: 'Two-sided foliage with subsurface, wind animation', defaultFeatures: ['subsurface', 'worldPositionOffset'], plain: 'Leaves and grass that glow gently when the sun is behind them and sway in wind.' },
  { id: 'stone',    label: 'Stone',    icon: Blocks,    color: '#78716c', description: 'Rock/brick with parallax occlusion depth detail', defaultFeatures: ['parallax'], plain: 'Rocky, chiseled surface with real-feeling cracks and depth.' },
];

interface FeatureDef {
  id: RenderFeature;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  /** Plain-language label + explanation rendered in Explain Mode. */
  plain: { label: string; explanation: string };
}

const FEATURES: FeatureDef[] = [
  { id: 'subsurface',          label: 'Subsurface Scattering', shortLabel: 'SSS',       description: 'Light passes through material (skin, wax, leaves)', color: STATUS_BLOCKER,
    plain: { label: 'Light passes through', explanation: 'Lets a little light shine through the surface — what makes ears glow red against a sunset.' } },
  { id: 'parallax',            label: 'Parallax Occlusion',    shortLabel: 'Parallax',   description: 'Depth illusion from heightmap without extra geometry', color: '#78716c',
    plain: { label: 'Fake depth in cracks', explanation: "Makes cracks and bricks look properly deep without adding real geometry. Expensive — use it on hero stones only." } },
  { id: 'emissive',            label: 'Emissive',              shortLabel: 'Emissive',   description: 'Self-illumination channel for glowing regions', color: STATUS_WARNING,
    plain: { label: 'Glows on its own', explanation: 'The surface emits light by itself — runes, screens, lava cracks. Works even in pitch dark.' } },
  { id: 'refraction',          label: 'Refraction',            shortLabel: 'Refract',    description: 'Light bending through translucent surfaces', color: STATUS_IMPROVED,
    plain: { label: 'Bends what is behind', explanation: "Distorts what you see through the surface, like glass or water. Costs more than plain transparency." } },
  { id: 'tessellation',        label: 'Tessellation / Nanite', shortLabel: 'Tess',       description: 'Subdivide mesh for displacement detail (UE5.4+ Nanite)', color: ACCENT_VIOLET,
    plain: { label: 'Sculpts real bumps', explanation: 'Adds real geometry along the surface so bumps cast shadows. Heaviest option — Nanite handles most cases now.' } },
  { id: 'worldPositionOffset', label: 'World Position Offset', shortLabel: 'WPO',        description: 'Vertex animation: wind, waves, breathing', color: STATUS_SUCCESS,
    plain: { label: 'Wobbles / sways', explanation: 'Wiggles the surface in real time — wind on grass, breathing chests, lapping waves.' } },
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
  /** Plain-language decoder for Explain Mode. Shape mirrors PPParamPlain. */
  plain: PPParamPlain;
}

const BASE_PARAMS: ParamDef[] = [
  { name: 'Roughness',  label: 'Roughness',  min: 0, max: 1, defaultValue: 0.5, step: 0.05,
    plain: { label: 'Polish', explanation: 'How polished or weathered the surface looks. Low = a mirror; high = sandpaper.', cue: 'level', lowLabel: 'Mirror', highLabel: 'Sandpaper' } },
  { name: 'Metallic',   label: 'Metallic',   min: 0, max: 1, defaultValue: 0,   step: 0.1,
    plain: { label: 'Looks like metal', explanation: 'How much the surface behaves like metal (sharp, tinted reflections) vs plastic/cloth/skin.', cue: 'level', lowLabel: 'Plastic', highLabel: 'Steel' } },
  { name: 'Opacity',    label: 'Opacity',    min: 0, max: 1, defaultValue: 1,   step: 0.05, surfaces: ['glass', 'water'],
    plain: { label: 'How see-through', explanation: 'How transparent the surface is. Low = ghostly; high = solid.', cue: 'level', lowLabel: 'See through', highLabel: 'Solid' } },
  { name: 'IOR',        label: 'IOR',        min: 1, max: 2.5, defaultValue: 1.5, step: 0.1, surfaces: ['glass', 'water'],
    plain: { label: 'How much light bends', explanation: 'How sharply light bends as it enters the surface. Air ≈ 1, water ≈ 1.33, glass ≈ 1.5, diamond ≈ 2.4.', cue: 'distance', lowLabel: 'No bend', highLabel: 'Strong bend' } },
  { name: 'EmissiveIntensity', label: 'Emissive Intensity', min: 0, max: 20, defaultValue: 5, step: 0.5, surfaces: ['emissive'],
    plain: { label: 'Glow strength', explanation: 'How brightly the surface glows. High values bloom and tint nearby objects.', cue: 'glow', lowLabel: 'Dim', highLabel: 'Blinding' } },
  { name: 'SubsurfaceRadius',  label: 'SSS Radius',        min: 0.1, max: 5, defaultValue: 1.2, step: 0.1, surfaces: ['skin', 'cloth', 'foliage'],
    plain: { label: 'Light bleed', explanation: 'How far light spreads under the surface — skin looks waxy when this is high.', cue: 'glow', lowLabel: 'Sharp', highLabel: 'Waxy' } },
  { name: 'ParallaxDepth',     label: 'Parallax Depth',    min: 0.01, max: 0.2, defaultValue: 0.05, step: 0.01, surfaces: ['stone'],
    plain: { label: 'Crack depth', explanation: 'How deep the fake cracks read when you look at the surface from an angle.', cue: 'level', lowLabel: 'Flat', highLabel: 'Carved' } },
];

// ── Glossary (for the popover) ─────────────────────────────────────────────

interface GlossaryEntry { term: string; plain: string }
const GLOSSARY: GlossaryEntry[] = [
  { term: 'PBR',        plain: 'Physically-Based Rendering — the modern way of building materials so they look right in any lighting.' },
  { term: 'IOR',        plain: 'Index of Refraction — how much a transparent surface bends what is behind it.' },
  { term: 'SSS',        plain: 'Subsurface Scattering — light passing through the surface and re-emerging slightly elsewhere (skin, wax, leaves).' },
  { term: 'POM',        plain: 'Parallax Occlusion Mapping — fakes real depth in surface details like brickwork.' },
  { term: 'WPO',        plain: 'World Position Offset — wiggles the surface in real time. Wind on grass, lapping water.' },
  { term: 'Tessellation', plain: 'Adds real geometric bumps to a surface. Heaviest option — Nanite usually handles this now.' },
  { term: 'Metallic',   plain: 'How "metal" a surface looks. Metals reflect their own color tint; plastics reflect white.' },
  { term: 'Roughness',  plain: 'How polished vs sandpapery a surface looks. Controls reflection sharpness.' },
  { term: 'ORM',        plain: 'A texture map that packs Occlusion + Roughness + Metallic into one image (R, G, B channels) to save samplers.' },
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

interface MaterialParameterConfiguratorProps {
  onGenerate: (config: MaterialConfiguratorConfig) => void;
  isGenerating: boolean;
}

export function MaterialParameterConfigurator({ onGenerate, isGenerating }: MaterialParameterConfiguratorProps) {
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('metal');
  const [features, setFeatures] = useState<RenderFeature[]>([]);
  const [outputType, setOutputType] = useState<MaterialOutputType>('master');
  const [paramValues, setParamValues] = useState<Record<string, number>>({});
  const [explainMode, setExplainMode] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  // ── Bridge data ──
  const { manifest, isConnected: bridgeConnected } = useManifest();

  const bridgeMaterials = useMemo(() => {
    if (!manifest?.materials?.length) return [];
    return manifest.materials.map((m) => ({
      path: m.path,
      domain: m.domain,
      blendMode: m.blendMode,
      shadingModel: m.shadingModel,
      paramCount: m.parameters.length,
      instanceCount: m.materialInstances.length,
      textureCount: m.textureReferences.length,
      parameters: m.parameters,
    }));
  }, [manifest]);

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
        <CircleDot className="w-4 h-4" style={{ color: MODULE_COLORS.content }} />
        <div>
          <h3 className="text-xs font-semibold text-text">Material Configurator</h3>
          <p className="text-2xs text-text-muted">Configure surface, features, and parameters</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setExplainMode((v) => !v)}
            aria-pressed={explainMode}
            data-testid="material-explain-toggle"
            title="Decode the technical jargon into plain English"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium border transition-colors ${
              explainMode
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            Explain
          </button>
          <button
            onClick={() => setShowGlossary((v) => !v)}
            aria-expanded={showGlossary}
            data-testid="material-glossary-toggle"
            title="What do these terms mean?"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-medium border transition-colors ${
              showGlossary
                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <Info className="w-3 h-3" />
            Glossary
          </button>
        </div>
      </div>

      {showGlossary && (
        <div role="region" aria-label="Glossary" className="rounded-lg border border-border bg-surface-deep p-3 space-y-1.5">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="text-2xs flex gap-2">
              <span className="font-mono text-text w-24 flex-shrink-0">{g.term}</span>
              <span className="text-text-muted">{g.plain}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Surface Type ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Surface Type</h4>
        <div className="grid grid-cols-4 gap-4">
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
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? s.color : 'var(--text-muted)' }} />
                <span className="text-2xs font-medium" style={{ color: isActive ? s.color : 'var(--text-muted)' }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-2xs text-text-muted px-1">
          {explainMode ? surfaceDef.plain : surfaceDef.description}
        </p>
      </div>

      {/* ─── Output Type ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Output Type</h4>
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
                backgroundColor: outputType === opt.id ? `${MODULE_COLORS.content}12` : 'var(--surface-deep)',
                border: `1px solid ${outputType === opt.id ? `${MODULE_COLORS.content}40` : 'var(--border)'}`,
              }}
            >
              <span
                className="text-xs font-semibold block"
                style={{ color: outputType === opt.id ? MODULE_COLORS.content : 'var(--text-muted)' }}
              >
                {opt.label}
              </span>
              <span className="text-2xs text-text-muted">{opt.desc}</span>
            </button>
          ))}
        </div>
        {outputType === 'instance' && (
          <p className="text-2xs px-1 py-1 rounded bg-status-amber-subtle border border-status-amber-medium text-[#f59e0bcc]">
            Recommended: Use Material Instances for per-object variation without recompiling shaders.
          </p>
        )}
      </div>

      {/* ─── Rendering Features ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">Rendering Features</h4>
        <div className="grid grid-cols-2 gap-4">
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
                    title={`UE: ${f.label}`}
                  >
                    {explainMode ? f.plain.label : f.shortLabel}
                  </span>
                  <span className="text-2xs text-text-muted block truncate">
                    {explainMode ? f.plain.explanation : f.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Parameter Ranges ─── */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Parameters
          <span className="ml-1.5 font-normal normal-case text-text-muted">({applicableParams.length} for {surfaceDef.label})</span>
        </h4>
        <div className="space-y-3">
          {applicableParams.map((p) => {
            const val = paramValues[p.name] ?? p.defaultValue;
            const normalized = (val - p.min) / (p.max - p.min || 1);
            return (
              <div
                key={p.name}
                className="px-3 py-2 rounded-lg bg-surface-deep border border-border"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {explainMode && (
                      <ParamCue
                        kind={p.plain.cue}
                        value={normalized}
                        accent={surfaceDef.color}
                        title={`${p.plain.label}: ${p.plain.explanation}`}
                      />
                    )}
                    <span className="text-2xs font-medium text-[#c0c4e0]" title={`UE: ${p.name}`}>
                      {explainMode ? p.plain.label : p.label}
                    </span>
                  </div>
                  <span className="text-2xs font-mono text-[#9b9ec0]">{val.toFixed(p.step < 1 ? 2 : 0)}</span>
                </div>
                {explainMode && (
                  <p className="text-2xs text-text-muted/70 mb-1.5">{p.plain.explanation}</p>
                )}
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={(e) => setParam(p.name, parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${surfaceDef.color} 0%, ${surfaceDef.color} ${normalized * 100}%, var(--border) ${normalized * 100}%, var(--border) 100%)`,
                  }}
                />
                <div className="flex justify-between mt-0.5">
                  <span className="text-2xs text-[#3a3e5a]">{explainMode ? p.plain.lowLabel : p.min}</span>
                  <span className="text-2xs text-[#3a3e5a]">{explainMode ? p.plain.highLabel : p.max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Live Material Data from Bridge ─── */}
      {bridgeConnected && bridgeMaterials.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
            <Plug className="w-3 h-3 text-green-400" />
            Live from Bridge
            <span className="text-green-400 font-normal">({bridgeMaterials.length} materials)</span>
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
            {bridgeMaterials.map((mat) => (
              <div
                key={mat.path}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface-deep border border-border hover:border-green-500/30 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-2xs text-text block truncate font-mono">{mat.path.split('/').pop()}</span>
                  <span className="text-2xs text-text-muted">{mat.domain} &middot; {mat.shadingModel}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-2xs text-text-muted">
                  <span>{mat.paramCount} params</span>
                  <span>{mat.instanceCount} inst</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Shader Budget — sampler + instruction cost estimator ─── */}
      <MaterialBudgetBar surfaceType={surfaceType} features={features} />

      {/* ─── Generate Button ─── */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${MODULE_COLORS.content}15`,
          color: MODULE_COLORS.content,
          border: `1px solid ${MODULE_COLORS.content}30`,
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
