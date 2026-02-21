'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Sun, Eye, Wind, Circle, Move, Aperture, Layers as LayersIcon,
  GripVertical, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/constants';
import { STATUS_WARNING, ACCENT_VIOLET, STATUS_IMPROVED, STATUS_NEUTRAL, ACCENT_ORANGE, STATUS_SUCCESS } from '@/lib/chart-colors';

// ── Types ──

export interface PPEffectParam {
  name: string;
  description: string;
  type: 'float' | 'color' | 'bool' | 'int';
  defaultValue: string;
  range?: string;
}

export interface PPEffect {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  description: string;
  ueClass: string;
  params: PPEffectParam[];
}

export interface PPStackEntry {
  effectId: string;
  enabled: boolean;
  priority: number;
}

export interface PostProcessStackConfig {
  stack: PPStackEntry[];
  effects: PPEffect[];
}

// ── Static Effect Definitions ──

export const PP_EFFECTS: PPEffect[] = [
  {
    id: 'pp-bloom',
    name: 'Bloom',
    icon: Sun,
    color: STATUS_WARNING,
    description: 'Glow around bright areas. Controls intensity, threshold, and kernel size for the bloom convolution.',
    ueClass: 'FPostProcessSettings::Bloom*',
    params: [
      { name: 'BloomIntensity', description: 'Overall bloom brightness multiplier', type: 'float', defaultValue: '0.675', range: '0.0 – 8.0' },
      { name: 'BloomThreshold', description: 'Minimum brightness to trigger bloom', type: 'float', defaultValue: '-1.0', range: '-1.0 – 8.0' },
      { name: 'BloomSizeScale', description: 'Kernel radius multiplier', type: 'float', defaultValue: '4.0', range: '0.1 – 64.0' },
      { name: 'BloomConvolutionTexture', description: 'Custom convolution kernel texture (optional)', type: 'bool', defaultValue: 'nullptr' },
    ],
  },
  {
    id: 'pp-colorgrading',
    name: 'Color Grading',
    icon: Aperture,
    color: ACCENT_VIOLET,
    description: 'LUT-based color correction. Adjusts white balance, saturation, contrast, and tone curve for cinematic looks.',
    ueClass: 'FPostProcessSettings::ColorGrading*',
    params: [
      { name: 'WhiteTemp', description: 'Color temperature in Kelvin', type: 'float', defaultValue: '6500', range: '1500 – 15000' },
      { name: 'WhiteTint', description: 'Tint shift (green ↔ magenta)', type: 'float', defaultValue: '0.0', range: '-1.0 – 1.0' },
      { name: 'ColorSaturation', description: 'Global saturation (per-channel FVector4)', type: 'color', defaultValue: '(1,1,1,1)' },
      { name: 'ColorContrast', description: 'Global contrast (per-channel FVector4)', type: 'color', defaultValue: '(1,1,1,1)' },
      { name: 'ColorGradingLUT', description: 'Lookup table texture for color transform', type: 'bool', defaultValue: 'nullptr' },
    ],
  },
  {
    id: 'pp-dof',
    name: 'Depth of Field',
    icon: Eye,
    color: STATUS_IMPROVED,
    description: 'Cinematic focus blur. Gaussian or Bokeh DOF with focal distance, aperture (f-stop), and near/far transition regions.',
    ueClass: 'FPostProcessSettings::DepthOfField*',
    params: [
      { name: 'DepthOfFieldFocalDistance', description: 'Distance to sharp focus plane (cm)', type: 'float', defaultValue: '0.0', range: '0.0 – 100000' },
      { name: 'DepthOfFieldFstop', description: 'Aperture f-stop (lower = more blur)', type: 'float', defaultValue: '4.0', range: '0.7 – 32.0' },
      { name: 'DepthOfFieldSensorWidth', description: 'Sensor width in mm (affects bokeh)', type: 'float', defaultValue: '24.576', range: '0.1 – 1000' },
      { name: 'DepthOfFieldMinFstop', description: 'Minimum aperture for auto-exposure interop', type: 'float', defaultValue: '1.2', range: '0.7 – 32.0' },
    ],
  },
  {
    id: 'pp-ao',
    name: 'Ambient Occlusion',
    icon: Circle,
    color: STATUS_NEUTRAL,
    description: 'Screen-space darkening in crevices and corners. Adds depth and contact shadows without ray tracing.',
    ueClass: 'FPostProcessSettings::AmbientOcclusion*',
    params: [
      { name: 'AmbientOcclusionIntensity', description: 'Darkening strength', type: 'float', defaultValue: '0.5', range: '0.0 – 1.0' },
      { name: 'AmbientOcclusionRadius', description: 'World-space sampling radius (cm)', type: 'float', defaultValue: '200.0', range: '0.1 – 500' },
      { name: 'AmbientOcclusionStaticFraction', description: 'Blend with DFAO when Lumen is off', type: 'float', defaultValue: '1.0', range: '0.0 – 1.0' },
      { name: 'AmbientOcclusionQuality', description: 'Sample count quality level', type: 'float', defaultValue: '50.0', range: '0.0 – 100.0' },
    ],
  },
  {
    id: 'pp-motionblur',
    name: 'Motion Blur',
    icon: Move,
    color: ACCENT_ORANGE,
    description: 'Per-object and camera velocity blur. Adds cinematic motion feel; amount and max pixel length are key controls.',
    ueClass: 'FPostProcessSettings::MotionBlur*',
    params: [
      { name: 'MotionBlurAmount', description: 'Blur strength multiplier', type: 'float', defaultValue: '0.5', range: '0.0 – 1.0' },
      { name: 'MotionBlurMax', description: 'Max blur distance in percent of screen', type: 'float', defaultValue: '5.0', range: '0.0 – 100' },
      { name: 'MotionBlurTargetFPS', description: 'Reference frame rate (0 = disabled)', type: 'int', defaultValue: '0', range: '0 – 120' },
      { name: 'MotionBlurPerObjectSize', description: 'Per-object blur threshold', type: 'float', defaultValue: '0.5', range: '0.0 – 1.0' },
    ],
  },
  {
    id: 'pp-vignette',
    name: 'Vignette',
    icon: Wind,
    color: '#ec4899',
    description: 'Darkened screen edges for a cinematic or focused viewport feel. Simple intensity control.',
    ueClass: 'FPostProcessSettings::VignetteIntensity',
    params: [
      { name: 'VignetteIntensity', description: 'Edge darkening strength', type: 'float', defaultValue: '0.4', range: '0.0 – 1.0' },
    ],
  },
  {
    id: 'pp-stencil',
    name: 'Custom Stencil',
    icon: LayersIcon,
    color: STATUS_SUCCESS,
    description: 'Per-object post-process using custom stencil buffer. Apply outline, highlight, or unique effects to tagged actors.',
    ueClass: 'Custom Depth / Stencil + PP Material',
    params: [
      { name: 'StencilValue', description: 'Custom stencil value (1–255) to match', type: 'int', defaultValue: '1', range: '1 – 255' },
      { name: 'bCustomDepth', description: 'Enable Custom Depth on tagged meshes', type: 'bool', defaultValue: 'true' },
      { name: 'OutlineThickness', description: 'Outline width in pixels (if using outline PP)', type: 'float', defaultValue: '2.0', range: '0.5 – 8.0' },
      { name: 'OutlineColor', description: 'Outline emission color', type: 'color', defaultValue: '(1, 0.5, 0, 1)' },
    ],
  },
];

const DEFAULT_STACK: PPStackEntry[] = PP_EFFECTS.map((e, i) => ({
  effectId: e.id,
  enabled: ['pp-bloom', 'pp-colorgrading', 'pp-ao', 'pp-vignette'].includes(e.id),
  priority: i,
}));

// ── Component ──

interface PostProcessStackBuilderProps {
  onGenerate: (config: PostProcessStackConfig) => void;
  isGenerating: boolean;
}

export function PostProcessStackBuilder({ onGenerate, isGenerating }: PostProcessStackBuilderProps) {
  const [stack, setStack] = useState<PPStackEntry[]>(DEFAULT_STACK);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const effectMap = useMemo(() => {
    const m = new Map<string, PPEffect>();
    PP_EFFECTS.forEach((e) => m.set(e.id, e));
    return m;
  }, []);

  const sortedStack = useMemo(() => {
    return [...stack].sort((a, b) => a.priority - b.priority);
  }, [stack]);

  const enabledCount = useMemo(() => stack.filter((s) => s.enabled).length, [stack]);

  const toggleEffect = useCallback((effectId: string) => {
    setStack((prev) => prev.map((s) =>
      s.effectId === effectId ? { ...s, enabled: !s.enabled } : s
    ));
  }, []);

  const moveEffect = useCallback((effectId: string, direction: 'up' | 'down') => {
    setStack((prev) => {
      const sorted = [...prev].sort((a, b) => a.priority - b.priority);
      const idx = sorted.findIndex((s) => s.effectId === effectId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;

      // Swap priorities
      const newStack = prev.map((s) => {
        if (s.effectId === sorted[idx].effectId) return { ...s, priority: sorted[swapIdx].priority };
        if (s.effectId === sorted[swapIdx].effectId) return { ...s, priority: sorted[idx].priority };
        return s;
      });
      return newStack;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleGenerate = useCallback(() => {
    onGenerate({ stack, effects: PP_EFFECTS });
  }, [stack, onGenerate]);

  return (
    <div className="w-full h-full bg-[#03030a] rounded-2xl border border-violet-900/30 shadow-[inset_0_0_80px_rgba(167,139,250,0.05)] p-6 relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-violet-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <LayersIcon className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest uppercase text-violet-100">Post-Process Stack Pipeline</h3>
              <p className="text-[10px] text-violet-400/60 uppercase tracking-wider mt-0.5">
                {enabledCount}/{PP_EFFECTS.length} ACTIVE_NODES — PRIORITY_ROUTING_LOCKED
              </p>
            </div>
          </div>
        </div>

        {/* Stack list */}
        <div className="space-y-2">
          {sortedStack.map((entry, idx) => {
            const effect = effectMap.get(entry.effectId);
            if (!effect) return null;
            const isExpanded = expandedId === entry.effectId;
            return (
              <EffectRow
                key={entry.effectId}
                effect={effect}
                entry={entry}
                isExpanded={isExpanded}
                isFirst={idx === 0}
                isLast={idx === sortedStack.length - 1}
                onToggle={() => toggleEffect(entry.effectId)}
                onMoveUp={() => moveEffect(entry.effectId, 'up')}
                onMoveDown={() => moveEffect(entry.effectId, 'down')}
                onExpand={() => toggleExpand(entry.effectId)}
              />
            );
          })}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || enabledCount === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 mt-4 group outline-none"
          style={{
            backgroundColor: `${MODULE_COLORS.content}15`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}50`,
            boxShadow: `0 0 20px ${MODULE_COLORS.content}20, inset 0 0 10px ${MODULE_COLORS.content}10`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          {isGenerating ? (
            <div className="flex items-center gap-2 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              COMPILING_STACK...
            </div>
          ) : (
            <>
              <Zap className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
              COMPILE VOLUME_SETTINGS ({enabledCount})
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Effect Row ──

interface EffectRowProps {
  effect: PPEffect;
  entry: PPStackEntry;
  isExpanded: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onExpand: () => void;
}

function EffectRow({
  effect, entry, isExpanded, isFirst, isLast,
  onToggle, onMoveUp, onMoveDown, onExpand,
}: EffectRowProps) {
  const Icon = effect.icon;
  const isActive = entry.enabled;

  return (
    <div
      className="rounded-xl border transition-all duration-500 relative group overflow-hidden"
      style={{
        borderColor: isExpanded ? `${effect.color}40` : isActive ? `${effect.color}20` : 'rgba(139,92,246,0.2)',
        backgroundColor: isExpanded ? `${effect.color}08` : isActive ? `${effect.color}04` : 'rgba(10,10,25,0.6)',
        boxShadow: isExpanded ? `0 0 20px ${effect.color}10, inset 0 0 10px ${effect.color}05` : 'none',
        opacity: isActive ? 1 : 0.6,
      }}
    >
      {/* Active Bar indicator */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: effect.color }} />
      )}

      {/* Row header */}
      <div className="flex items-center px-4 py-3 gap-4">
        {/* Grip + reorder */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 rounded text-violet-500/40 hover:text-violet-300 hover:bg-violet-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-violet-900/60 group-hover:text-violet-500/40 transition-colors" />
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 rounded text-violet-500/40 hover:text-violet-300 hover:bg-violet-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle Node */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-10 h-5 rounded-full relative transition-colors border border-violet-900/30 shadow-inner"
          style={{
            backgroundColor: isActive ? `${effect.color}20` : 'rgba(0,0,0,0.8)',
          }}
        >
          <span
            className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-300 shadow-[0_0_5px_currentColor]"
            style={{
              left: isActive ? '22px' : '4px',
              backgroundColor: isActive ? effect.color : 'rgba(139,92,246,0.4)',
            }}
          />
        </button>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${effect.color}15, ${effect.color}05)`,
            border: `1px solid ${effect.color}30`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: effect.color }} />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0 flex flex-col justify-center text-left">
          <div className="flex items-center gap-3 mb-0.5">
            <span className="text-[11px] font-bold uppercase tracking-widest text-violet-100 truncate">{effect.name}</span>
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
              style={{ backgroundColor: `${effect.color}10`, borderColor: `${effect.color}30`, color: effect.color }}
            >
              PRIORITY: {entry.priority + 1}
            </span>
          </div>
          <p className="text-[10px] text-violet-300/60 line-clamp-1 font-mono">{effect.description}</p>
        </div>

        {/* Expand arrow */}
        <button
          onClick={onExpand}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-black/40 border border-violet-900/30 hover:border-violet-500/50 transition-colors"
        >
          <span
            className="text-[10px] font-mono transition-transform duration-300"
            style={{ color: effect.color, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </button>
      </div>

      {/* Expanded params */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2">
          <div className="ml-[88px] space-y-3 relative">
            <div className="absolute -left-6 top-0 bottom-4 w-px bg-violet-900/40" style={{ backgroundColor: `${effect.color}30` }} />

            <div className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded w-fit border shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]" style={{ color: effect.color, backgroundColor: `${effect.color}10`, borderColor: `${effect.color}20` }}>
              CORE_CLASS: {effect.ueClass}
            </div>

            <div className="space-y-2">
              {effect.params.map((param) => (
                <div
                  key={param.name}
                  className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-black/60 border border-violet-900/40 relative group/param hover:border-violet-500/30 transition-colors shadow-inner"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[10px] font-bold font-mono text-violet-200">{param.name}</span>
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest border"
                        style={{ backgroundColor: `${effect.color}15`, color: effect.color, borderColor: `${effect.color}30` }}
                      >
                        {param.type}
                      </span>
                    </div>
                    <p className="text-[9px] text-violet-400/60 font-mono leading-relaxed">{param.description}</p>
                  </div>

                  <div className="flex-shrink-0 text-left xl:text-right bg-violet-900/10 px-3 py-2 rounded-lg border border-violet-900/30 min-w-[140px]">
                    <div className="text-[11px] font-mono text-violet-100 font-bold">{param.defaultValue}</div>
                    {param.range && (
                      <div className="text-[8px] text-violet-500/60 font-mono mt-1 uppercase tracking-widest border-t border-violet-900/40 pt-1">RANGE: {param.range}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
