/**
 * The one projection of a post-process stack.
 *
 * `usePostProcessStudioStore` holds the stack both screens edit (the Evaluator's
 * Recipe Studio and the Materials tab's Stack Builder). Everything that leaves
 * the store — the C++ prompt, the GPU budget readout, the Blender compositor
 * preview — is read through this module, so one stack yields one spec: the
 * values the user tuned, the resolution they chose, and the budget they tuned
 * against. Pure and dependency-light (estimator + types only).
 */

import type { PPStudioEffect, PPStudioParam, PPResolution, PPPreset, PPEffectCategory } from '@/types/post-process-studio';
import type { CompositorSettings } from '@/lib/blender-mcp/scripts/compositor-stack';
import { estimateGPUBudget } from './gpu-estimator';

export interface PPSpecParam {
  name: string;
  ueProperty: string;
  type: PPStudioParam['type'];
  value: number;
  min: number;
  max: number;
  description: string;
}

export interface PPSpecEffect {
  id: string;
  name: string;
  category: PPEffectCategory;
  ueClass: string;
  description: string;
  /** Estimated ms at the spec's resolution — the param-sensitive estimator, not the 1080p base cost. */
  estCostMs: number;
  params: PPSpecParam[];
}

export interface PostProcessStackSpec {
  resolution: PPResolution;
  /** Frame-time budget for post-process at {@link resolution}. */
  budgetMs: number;
  totalCostMs: number;
  overBudget: boolean;
  /** Enabled effects in priority order. */
  effects: PPSpecEffect[];
  /** Ids of disabled effects — never generated, listed so the omission is explicit. */
  disabled: string[];
  /** The cinematic preset the stack started from, when still unmodified. */
  presetName: string | null;
}

/** Project a stack to its spec at `resolution`. */
export function toStackSpec(
  effects: PPStudioEffect[],
  resolution: PPResolution,
  presetName: string | null = null,
): PostProcessStackSpec {
  const sorted = [...effects].sort((a, b) => a.priority - b.priority);
  const report = estimateGPUBudget(sorted, resolution);
  const costById = new Map(report.effects.map((e) => [e.effectId, e.costMs]));
  return {
    resolution,
    budgetMs: report.budgetMs,
    totalCostMs: report.totalCostMs,
    overBudget: report.overBudget,
    effects: sorted.filter((e) => e.enabled).map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      ueClass: e.ueClass,
      description: e.description,
      estCostMs: costById.get(e.id) ?? 0,
      params: e.params.map((p) => ({
        name: p.name, ueProperty: p.ueProperty, type: p.type, value: p.value,
        min: p.min, max: p.max, description: p.description,
      })),
    })),
    disabled: sorted.filter((e) => !e.enabled).map((e) => e.id),
    presetName,
  };
}

/** The slice of the studio store a spec is built from (both surfaces pass `getState()`). */
export interface StudioStackState {
  effects: PPStudioEffect[];
  resolution: PPResolution;
  activePresetId: string | null;
  presets: PPPreset[];
}

/** Spec for the store's current stack, preset name included. */
export function specFromStudioState(s: StudioStackState): PostProcessStackSpec {
  const presetName = s.activePresetId
    ? s.presets.find((p) => p.id === s.activePresetId)?.name ?? null
    : null;
  return toStackSpec(s.effects, s.resolution, presetName);
}

function paramValue(effect: PPStudioEffect, name: string, fallback: number): number {
  return effect.params.find((p) => p.name === name)?.value ?? fallback;
}

/** Blender compositor settings read off the stack's real bloom / color-grading / vignette params. */
export function toCompositorSettings(effects: PPStudioEffect[]): CompositorSettings {
  const settings: CompositorSettings = {};
  const on = (id: string) => effects.find((e) => e.id === id && e.enabled);
  const bloom = on('bloom');
  if (bloom) {
    settings.bloom = {
      intensity: paramValue(bloom, 'Intensity', 0.675),
      threshold: paramValue(bloom, 'Threshold', -1),
      radius: paramValue(bloom, 'Size Scale', 4),
    };
  }
  const grading = on('color-grading');
  if (grading) {
    settings.colorGrading = {
      saturation: paramValue(grading, 'Saturation', 1),
      whiteBalance: paramValue(grading, 'Temperature', 6500),
    };
  }
  const vignette = on('vignette');
  if (vignette) settings.vignette = { intensity: paramValue(vignette, 'Intensity', 0.4) };
  return settings;
}
