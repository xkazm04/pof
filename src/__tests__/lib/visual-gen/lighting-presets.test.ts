import { describe, it, expect } from 'vitest';
import {
  LIGHTING_PRESETS,
  getLightingPreset,
  RAY_TRACING_MODES,
  REFLECTION_METHODS,
} from '@/lib/visual-gen/lighting-presets';

describe('LIGHTING_PRESETS', () => {
  it('exposes at least 3 best-practice presets', () => {
    expect(LIGHTING_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('every preset has non-empty fields + valid enum values', () => {
    for (const p of LIGHTING_PRESETS) {
      expect(p.id, 'id').toBeTruthy();
      expect(p.name, `name for ${p.id}`).toBeTruthy();
      expect(p.description, `description for ${p.id}`).toBeTruthy();
      expect(p.notes, `notes for ${p.id}`).toBeTruthy();
      expect(RAY_TRACING_MODES).toContain(p.rayTracing);
      expect(REFLECTION_METHODS).toContain(p.reflectionMethod);
    }
  });

  it('has unique ids and getLightingPreset resolves them', () => {
    const ids = LIGHTING_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getLightingPreset(ids[0])?.id).toBe(ids[0]);
    expect(getLightingPreset('nope')).toBeUndefined();
  });

  it('encodes the key Lumen best practices (open-world global SWRT + hit-lighting reflections)', () => {
    expect(LIGHTING_PRESETS.some((p) => p.softwareMode === 'global')).toBe(true);
    expect(LIGHTING_PRESETS.some((p) => p.reflectionMethod === 'hit-lighting-reflections')).toBe(true);
  });
});
