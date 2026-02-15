/**
 * GPU cost estimator for post-process effect stacks.
 *
 * Provides per-effect and total cost estimates based on resolution,
 * effect parameters, and UE5 profiling heuristics.
 */

import type { PPStudioEffect, PPResolution, GPUBudgetReport, GPUCostEstimate } from '@/types/post-process-studio';
import { RESOLUTION_MULTIPLIERS, FRAME_BUDGETS_MS } from './effects';

/**
 * Estimate GPU cost for a single effect at a given resolution.
 * Adjusts base cost based on quality-impacting parameters.
 */
function estimateEffectCost(effect: PPStudioEffect, resolutionMul: number): number {
  let cost = effect.gpuCostMs * resolutionMul;

  // AO quality scales cost linearly
  if (effect.id === 'ambient-occlusion') {
    const quality = effect.params.find((p) => p.name === 'Quality');
    if (quality) cost *= (quality.value / 50); // 50 is baseline
  }

  // DOF cost scales with inverse f-stop (wider aperture = more work)
  if (effect.id === 'depth-of-field') {
    const fstop = effect.params.find((p) => p.name === 'F-Stop');
    if (fstop) cost *= (4 / Math.max(fstop.value, 0.7)); // 4.0 is baseline
  }

  // Bloom cost scales with kernel size
  if (effect.id === 'bloom') {
    const size = effect.params.find((p) => p.name === 'Size Scale');
    if (size) cost *= Math.sqrt(size.value / 4); // 4.0 is baseline
  }

  // Fog with volumetric costs more at high density
  if (effect.id === 'fog') {
    const density = effect.params.find((p) => p.name === 'Density');
    if (density) cost *= (1 + density.value * 5); // density 0.02 → 1.1x, density 0.1 → 1.5x
  }

  return Math.round(cost * 100) / 100;
}

/**
 * Generate a full GPU budget report for the current effect stack.
 */
export function estimateGPUBudget(
  effects: PPStudioEffect[],
  resolution: PPResolution,
): GPUBudgetReport {
  const resMul = RESOLUTION_MULTIPLIERS[resolution] ?? 1;
  const budgetMs = FRAME_BUDGETS_MS[resolution] ?? 5;

  const estimates: GPUCostEstimate[] = effects
    .filter((e) => e.enabled)
    .map((e) => ({
      effectId: e.id,
      effectName: e.name,
      costMs: estimateEffectCost(e, resMul),
      category: e.category,
    }));

  const totalCostMs = Math.round(estimates.reduce((sum, e) => sum + e.costMs, 0) * 100) / 100;

  return {
    resolution,
    totalCostMs,
    effects: estimates,
    budgetMs,
    overBudget: totalCostMs > budgetMs,
  };
}
