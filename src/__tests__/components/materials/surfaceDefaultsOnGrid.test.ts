import { describe, it, expect } from 'vitest';
import { SURFACE_TYPES } from '@/lib/materials/surface-spec';
import { surfaceParamDefaults, getApplicableParams } from '@/components/modules/content/materials/MaterialParameterConfigurator/helpers';

/**
 * A surface's starting value must be reachable on its own slider. An HTML range
 * input snaps its thumb to min + k * step, so a default off that grid (water's
 * Roughness 0.02 against a 0.05 step) draws the thumb at 0 while the readout and
 * the prompt say 0.02 — and the first drag can never return to 0.02.
 */

const EPS = 1e-9;

function onGrid(value: number, min: number, step: number): boolean {
  const k = (value - min) / step;
  return Math.abs(k - Math.round(k)) < EPS;
}

describe('surface defaults sit on their slider grid', () => {
  it('every surface default is min + k * step of the slider that shows it', () => {
    const off: string[] = [];
    for (const surface of SURFACE_TYPES) {
      const defaults = surfaceParamDefaults(surface);
      for (const p of getApplicableParams(surface)) {
        const v = defaults[p.name] ?? p.defaultValue;
        if (!onGrid(v, p.min, p.step)) off.push(`${surface}.${p.name}=${v} (step ${p.step})`);
      }
    }
    expect(off).toEqual([]);
  });
});
