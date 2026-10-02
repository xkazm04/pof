/**
 * Material shader-cost + sampler budget estimator.
 *
 * The post-process side already has `gpu-estimator.ts` and the much-loved
 * GPUBreakdown panel surfaces it in the PP Studio. Materials are the more
 * common runtime-perf offender (UE5 shader-complexity view, sampler limits,
 * permutation count) yet author them with zero guardrails. This estimator
 * mirrors the PP module's contract — pure function, structured report, ready
 * for a budget-bar UI — so material authors hit a wall before the engine does.
 *
 * The heuristics here come from UE5's published shader-complexity costs +
 * profiling notes (Parallax Occlusion, Subsurface profiles, Translucent
 * shading model, WPO, Tessellation). They're rough estimates by design:
 * "directionally correct" beats "deceptively precise" for a guardrail.
 */

import {
  SURFACE_SPEC, resolveShadingModel, forbiddenCombinationsIn,
  type SurfaceType, type RenderFeature, type ShadingModel,
} from '@/lib/materials/surface-spec';

export interface MaterialBudgetInput {
  surfaceType: SurfaceType;
  features: RenderFeature[];
}

export interface MaterialBudgetWarning {
  /** Short tag the UI can colour by. */
  kind: 'sampler-limit' | 'instruction-cost' | 'shading-model' | 'feature-combo';
  severity: 'warn' | 'error';
  message: string;
  /** Free-form follow-up the UI can render as a chip / inline suggestion. */
  suggestion?: string;
}

export interface MaterialBudgetReport {
  /** Sum of texture samplers the material would compile with. UE5 hard cap is 16. */
  samplers: number;
  /** Per-feature attribution of the sampler count (drives the budget bar rows). */
  samplerBreakdown: { source: string; count: number }[];
  /** Engine-relative instruction cost score (≈ base shader = 1.0×). */
  instructionScore: number;
  /** Per-feature attribution of the instruction score. */
  instructionBreakdown: { source: string; cost: number }[];
  /** The shading model UE5 would compile (forced by some feature combos). */
  shadingModel: ShadingModel;
  /** True when the report tripped any error-severity warning. */
  overBudget: boolean;
  warnings: MaterialBudgetWarning[];
}

/** UE5 hard sampler ceiling — exceed and the material fails to compile. */
export const SAMPLER_HARD_LIMIT = 16;
/** UE5 soft sampler ceiling — at/above this you're permutation-bombing the platform. */
export const SAMPLER_WARN_LIMIT = 13;
/** Above this instruction multiplier the material is meaningfully more expensive than baseline. */
export const INSTRUCTION_WARN_THRESHOLD = 2.5;

// Per-surface base allocations (samplers, instructions, map notes) live in
// SURFACE_SPEC (`lib/materials/surface-spec.ts`), the one table every
// configurator consumer reads.

// ── Per-feature deltas ─────────────────────────────────────────────────────

interface FeatureCost {
  /** Extra samplers the feature pulls in (negative = none, it's a vertex/math feature). */
  samplers: number;
  /** Extra instruction cost added on top of the surface base. */
  instructions: number;
  /** Short label used in the report breakdown. */
  label: string;
  /** Cheaper alternative the warning suggests when a heavier feature lights up. */
  cheaperSwap?: string;
}

const FEATURE_COST: Record<RenderFeature, FeatureCost> = {
  subsurface:          { samplers: 1, instructions: 120, label: 'SSS',       cheaperSwap: 'PreintegratedSkin shading model is ~40% cheaper than full Subsurface' },
  parallax:            { samplers: 1, instructions: 250, label: 'Parallax',  cheaperSwap: 'Use BumpOffset (single tap) for ~4× cheaper depth illusion' },
  emissive:            { samplers: 1, instructions: 20,  label: 'Emissive'   },
  refraction:          { samplers: 1, instructions: 90,  label: 'Refraction', cheaperSwap: 'ThinTranslucent shading model avoids a refraction pass on flat glass' },
  tessellation:        { samplers: 1, instructions: 180, label: 'Tess',      cheaperSwap: 'Nanite displaced surfaces drop the runtime shader cost vs domain-shader tessellation' },
  worldPositionOffset: { samplers: 0, instructions: 60,  label: 'WPO',       cheaperSwap: 'Skip the noise sampler — drive WPO from vertex color + time for cheaper wind' },
};

// ── Public API ─────────────────────────────────────────────────────────────

/** Pure estimator — no DOM, no UE coupling, deterministic for a given input. */
export function estimateMaterialBudget(input: MaterialBudgetInput): MaterialBudgetReport {
  const base = SURFACE_SPEC[input.surfaceType].base;
  const samplerBreakdown: MaterialBudgetReport['samplerBreakdown'] = [
    { source: `${input.surfaceType} base`, count: base.samplers },
  ];
  const instructionBreakdown: MaterialBudgetReport['instructionBreakdown'] = [
    { source: `${input.surfaceType} base`, cost: 1 },
  ];

  let samplers = base.samplers;
  let instructions = base.instructions;
  const warnings: MaterialBudgetWarning[] = [];

  for (const f of input.features) {
    const c = FEATURE_COST[f];
    samplers += c.samplers;
    instructions += c.instructions;
    if (c.samplers > 0) samplerBreakdown.push({ source: c.label, count: c.samplers });
    instructionBreakdown.push({ source: c.label, cost: c.instructions / base.instructions });
    if (c.cheaperSwap && c.instructions >= 120) {
      warnings.push({
        kind: 'instruction-cost',
        severity: 'warn',
        message: `${c.label} adds ~${c.instructions} instructions to this material.`,
        suggestion: c.cheaperSwap,
      });
    }
  }

  // Sampler ceiling — UE5's hard cap is 16; over that, the material fails to compile.
  if (samplers > SAMPLER_HARD_LIMIT) {
    warnings.push({
      kind: 'sampler-limit',
      severity: 'error',
      message: `${samplers} samplers exceeds UE5's hard limit of ${SAMPLER_HARD_LIMIT} — material will fail to compile.`,
      suggestion: 'Pack maps (e.g. Roughness/Metallic/AO into one ORM RGB) or drop optional features.',
    });
  } else if (samplers >= SAMPLER_WARN_LIMIT) {
    warnings.push({
      kind: 'sampler-limit',
      severity: 'warn',
      message: `${samplers} samplers is close to the ${SAMPLER_HARD_LIMIT}-sampler cap on platforms with shared MSAA/UI samplers.`,
      suggestion: 'Pack normal+height into BC5+A or share a tiled detail set across instances.',
    });
  }

  // Feature combos that force an expensive shading model.
  const sm = resolveShadingModel(input.surfaceType, input.features);
  if (sm === 'Subsurface' || sm === 'SubsurfaceProfile') {
    warnings.push({
      kind: 'shading-model',
      severity: 'warn',
      message: `Subsurface shading model is roughly 30–60% more expensive than DefaultLit per-pixel.`,
      suggestion: 'PreintegratedSkin works for many cases without a full subsurface pass.',
    });
  }
  // Combinations the configurator refuses to dispatch (same table as `refusalFor`).
  for (const combo of forbiddenCombinationsIn(input.features)) {
    warnings.push({ kind: 'feature-combo', severity: 'error', message: combo.message, suggestion: combo.suggestion });
  }

  const instructionScore = instructions / SURFACE_SPEC.metal.base.instructions;
  if (instructionScore >= INSTRUCTION_WARN_THRESHOLD && !warnings.some((w) => w.kind === 'instruction-cost')) {
    warnings.push({
      kind: 'instruction-cost',
      severity: 'warn',
      message: `Estimated ${instructionScore.toFixed(1)}× a metal base shader — that's heavy for a default-tier material.`,
      suggestion: 'Turn off optional features for the LOD0 master; promote heavy variants to dedicated materials.',
    });
  }

  return {
    samplers,
    samplerBreakdown,
    instructionScore,
    instructionBreakdown,
    shadingModel: sm,
    overBudget: warnings.some((w) => w.severity === 'error'),
    warnings,
  };
}
