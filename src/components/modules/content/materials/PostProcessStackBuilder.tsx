'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Sun, Eye, Wind, Circle, Move, Aperture, Layers as LayersIcon,
  GripVertical, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
    color: '#fbbf24',
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
    color: '#a78bfa',
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
    color: '#38bdf8',
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
    color: '#6b7280',
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
    color: '#f97316',
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
    color: '#22c55e',
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

const ACCENT = '#f59e0b';

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
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon className="w-4 h-4" style={{ color: ACCENT }} />
          <div>
            <h3 className="text-xs font-semibold text-text">Post-Process Stack</h3>
            <p className="text-2xs text-text-muted">
              {enabledCount}/{PP_EFFECTS.length} effects enabled — drag to reorder priority
            </p>
          </div>
        </div>
      </div>

      {/* Stack list */}
      <div className="space-y-1.5">
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
          : `Generate Post-Process Volume (${enabledCount} effect${enabledCount !== 1 ? 's' : ''})`
        }
      </button>
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

  return (
    <div
      className="rounded-xl border transition-all duration-base"
      style={{
        borderColor: isExpanded ? `${effect.color}40` : entry.enabled ? `${effect.color}20` : 'var(--border)',
        backgroundColor: isExpanded ? `${effect.color}06` : entry.enabled ? `${effect.color}04` : 'var(--surface-deep)',
        opacity: entry.enabled ? 1 : 0.55,
      }}
    >
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Grip + reorder */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <GripVertical className="w-3 h-3 text-border-bright" />
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0 text-text-muted hover:text-text transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-8 h-4 rounded-full relative transition-colors"
          style={{
            backgroundColor: entry.enabled ? `${effect.color}40` : 'var(--border)',
          }}
        >
          <span
            className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
            style={{
              left: entry.enabled ? '17px' : '2px',
              backgroundColor: entry.enabled ? effect.color : 'var(--text-muted)',
            }}
          />
        </button>

        {/* Icon */}
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${effect.color}18, ${effect.color}08)`,
            border: `1px solid ${effect.color}20`,
          }}
        >
          <Icon className="w-3 h-3" style={{ color: effect.color }} />
        </div>

        {/* Name + description */}
        <button
          onClick={onExpand}
          className="flex-1 min-w-0 text-left group"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text">{effect.name}</span>
            <span className="text-2xs text-text-muted font-mono">{entry.priority + 1}</span>
          </div>
          <p className="text-2xs text-text-muted line-clamp-1">{effect.description}</p>
        </button>

        {/* Expand arrow */}
        <button onClick={onExpand} className="flex-shrink-0 p-0.5">
          {isExpanded
            ? <ChevronUp className="w-3 h-3 text-text-muted" />
            : <ChevronDown className="w-3 h-3 text-text-muted" />
          }
        </button>
      </div>

      {/* Expanded params */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-[72px] space-y-1.5">
            <div className="text-2xs font-semibold text-text-muted uppercase tracking-widest mb-1">
              UE: {effect.ueClass}
            </div>
            {effect.params.map((param) => (
              <div
                key={param.name}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-[#0a0a1e] border border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xs font-mono font-medium text-[#c0c4e0]">{param.name}</span>
                    <span
                      className="text-2xs px-1 py-0 rounded font-medium uppercase"
                      style={{ backgroundColor: `${effect.color}15`, color: `${effect.color}cc` }}
                    >
                      {param.type}
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">{param.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xs font-mono text-[#9b9ec0]">{param.defaultValue}</div>
                  {param.range && (
                    <div className="text-2xs text-text-muted">{param.range}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
