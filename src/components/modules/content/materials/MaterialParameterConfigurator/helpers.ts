import { SURFACE_SPEC } from '@/lib/materials/surface-spec';
import type { SurfaceType, ParamDef } from './types';
import { BASE_PARAMS } from './constants';

// ── Helpers ── (per-surface values come from the one surface spec)

export function getDefaultMetallic(surface: SurfaceType): number {
  return SURFACE_SPEC[surface].defaults.Metallic;
}

export function getDefaultRoughness(surface: SurfaceType): number {
  return SURFACE_SPEC[surface].defaults.Roughness;
}

/** The slider values a freshly picked surface starts from (also the initial state). */
export function surfaceParamDefaults(surface: SurfaceType): Record<string, number> {
  return { Roughness: getDefaultRoughness(surface), Metallic: getDefaultMetallic(surface) };
}

export function getApplicableParams(surface: SurfaceType): ParamDef[] {
  return BASE_PARAMS.filter((p) => !p.surfaces || p.surfaces.includes(surface));
}
