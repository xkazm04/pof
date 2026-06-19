/**
 * Lumen / lighting best-practice presets for UE5.
 *
 * Data-driven configs that encode the trade-offs a good lighting artist makes —
 * consumable by automation prompts and pipeline steps so generated/relit scenes
 * target a sane Lumen setup for the project tier instead of the engine defaults.
 *
 * Sourced from "How I Use Lumen in AAA Projects" (Karim Yasser) + UE5 docs.
 * Pairs with the `lumen-*` entries in `@/lib/knowledge/ue-gotchas.ts`.
 */

/** Global Illumination tracing path. */
export type RayTracingMode = 'software' | 'hardware-when-available' | 'hardware';
/** Software Ray Tracing detail level (only meaningful when SWRT is in play). */
export type SoftwareTracingMode = 'detail' | 'global';
/** Lumen reflection method (HWRT). Surface cache is cheapest; hit-lighting is too costly for shipping. */
export type ReflectionMethod = 'surface-cache' | 'hit-lighting-reflections' | 'hit-lighting';

export const RAY_TRACING_MODES: RayTracingMode[] = ['software', 'hardware-when-available', 'hardware'];
export const SOFTWARE_TRACING_MODES: SoftwareTracingMode[] = ['detail', 'global'];
export const REFLECTION_METHODS: ReflectionMethod[] = ['surface-cache', 'hit-lighting-reflections', 'hit-lighting'];

export interface LightingPreset {
  id: string;
  name: string;
  description: string;
  /** Who this preset targets. */
  targetTier: 'AAA' | 'mid' | 'wide-hardware';
  rayTracing: RayTracingMode;
  /** SWRT detail level — set when rayTracing is 'software' or used as the HWRT fallback. */
  softwareMode?: SoftwareTracingMode;
  reflectionMethod: ReflectionMethod;
  /** Lumen SWRT needs per-mesh distance fields; almost always true. */
  generateMeshDistanceFields: boolean;
  /** Best-practice rationale + the gotchas this preset answers — injected into prompts. */
  notes: string;
}

export const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'aaa-hwrt-balanced',
    name: 'AAA — HWRT (surface cache), SWRT detail fallback',
    description:
      "Author's default for AAA: hardware ray tracing when available, surface cache reflections, falling back to software detail tracing on weaker hardware.",
    targetTier: 'AAA',
    rayTracing: 'hardware-when-available',
    softwareMode: 'detail',
    reflectionMethod: 'surface-cache',
    generateMeshDistanceFields: true,
    notes:
      'Surface cache is the cheapest HWRT Lumen and good enough for most surfaces. Keep mesh distance fields valid (thin geo → raise Distance Field Resolution Scale) so the software fallback still looks right. Switch reflective hero surfaces (water) to the hit-lighting-reflections preset.',
  },
  {
    id: 'aaa-hwrt-hero-reflections',
    name: 'AAA — HWRT Hit Lighting for Reflections',
    description:
      'High-fidelity reflective scenes (water, polished floors) where surface-cache reflections read as black/wrong.',
    targetTier: 'AAA',
    rayTracing: 'hardware',
    reflectionMethod: 'hit-lighting-reflections',
    generateMeshDistanceFields: true,
    notes:
      'Use ONLY the reflection method "Hit Lighting for Reflections" (post-process volume) — accurate specular at moderate cost. Do NOT use full "Hit Lighting": it casts far more indirect rays and is too expensive to be reliable in a shipping game.',
  },
  {
    id: 'interior-detail-swrt',
    name: 'Software RT — Detail Tracing (interiors / detail-critical)',
    description:
      'No-HWRT target where small-distance GI detail matters (interiors, focused areas).',
    targetTier: 'mid',
    rayTracing: 'software',
    softwareMode: 'detail',
    reflectionMethod: 'surface-cache',
    generateMeshDistanceFields: true,
    notes:
      'Detail Tracing reads per-mesh distance fields — accurate for thin/close geometry. Thin walls/ceilings need a raised Distance Field Resolution Scale or they leak light. Costs more memory than global tracing.',
  },
  {
    id: 'open-world-global-swrt',
    name: 'Software RT — Global Tracing (large open worlds)',
    description:
      'Wide-hardware / large-scale environments where the low-res global distance field is the right cost/quality trade.',
    targetTier: 'wide-hardware',
    rayTracing: 'software',
    softwareMode: 'global',
    reflectionMethod: 'surface-cache',
    generateMeshDistanceFields: true,
    notes:
      'Global Tracing uses the low-res global distance field — cheaper + faster, scales to big worlds, but loses small-distance/contact GI detail. Prefer over detail tracing only when the world is large and per-mesh accuracy is not the priority.',
  },
];

export function getLightingPreset(id: string): LightingPreset | undefined {
  return LIGHTING_PRESETS.find((p) => p.id === id);
}
