import type { SurfaceType, ParamDef } from './types';
import { BASE_PARAMS } from './constants';

// ── Helpers ──

export function getDefaultMetallic(surface: SurfaceType): number {
  return surface === 'metal' ? 1 : 0;
}

export function getDefaultRoughness(surface: SurfaceType): number {
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

export function getApplicableParams(surface: SurfaceType): ParamDef[] {
  return BASE_PARAMS.filter((p) => !p.surfaces || p.surfaces.includes(surface));
}
