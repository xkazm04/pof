import { describe, it, expect } from 'vitest';
import {
  runSquadSimulation,
  validateDirectorConfig,
  PRESET_FORMATIONS,
  DEFAULT_DIRECTOR_CONFIG,
} from '@/lib/ai-director/squad-engine';
import type { DirectorConfig } from '@/types/squad-tactics';

const base = (): DirectorConfig => ({ ...DEFAULT_DIRECTOR_CONFIG });

describe('validateDirectorConfig', () => {
  it('accepts the default config and returns a normalized config', () => {
    const r = validateDirectorConfig(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.flankWeight).toBeGreaterThanOrEqual(0);
      expect(r.data.flankWeight).toBeLessThanOrEqual(1);
    }
  });

  it('rejects a formation with no roles', () => {
    const cfg = { ...base(), formation: { ...base().formation, roles: [] } };
    const r = validateDirectorConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('empty-formation');
  });

  it('rejects a formation that expands to zero members', () => {
    const cfg = {
      ...base(),
      formation: { ...base().formation, roles: [{ role: 'tank' as const, count: 0 }] },
    };
    const r = validateDirectorConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('empty-formation');
  });

  it('rejects an unknown role', () => {
    const cfg = {
      ...base(),
      // deliberately bad role to exercise the guard
      formation: { ...base().formation, roles: [{ role: 'wizard' as never, count: 1 }] },
    };
    const r = validateDirectorConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-role');
  });

  it('rejects a negative role count', () => {
    const cfg = {
      ...base(),
      formation: { ...base().formation, roles: [{ role: 'tank' as const, count: -2 }] },
    };
    const r = validateDirectorConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-formation');
  });

  it.each([
    ['attackDistance', NaN],
    ['targetForwardAngle', NaN],
    ['flankWeight', NaN],
    ['separationWeight', Infinity],
    ['rangeWeight', -Infinity],
    ['minSeparation', NaN],
  ] as const)('rejects non-finite %s', (field, value) => {
    const cfg = { ...base(), [field]: value };
    const r = validateDirectorConfig(cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('non-finite');
  });

  it('rejects a negative attack distance', () => {
    const r = validateDirectorConfig({ ...base(), attackDistance: -50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('invalid-distance');
  });

  it('rejects a zero / negative minimum separation (divide-by-zero guard)', () => {
    for (const minSeparation of [0, -10]) {
      const r = validateDirectorConfig({ ...base(), minSeparation });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('invalid-separation');
    }
  });

  it('clamps out-of-range weights into [0, 1]', () => {
    const r = validateDirectorConfig({ ...base(), flankWeight: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.flankWeight).toBe(1);
  });

  it('coerces a non-finite seed to a finite value', () => {
    const r = validateDirectorConfig({ ...base(), seed: NaN });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Number.isFinite(r.data.seed)).toBe(true);
  });
});

describe('runSquadSimulation', () => {
  it('returns ok for the default config with finite positions and scores', () => {
    const r = runSquadSimulation(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.members.length).toBe(DEFAULT_DIRECTOR_CONFIG.formation.size);
      for (const m of r.data.members) {
        expect(Number.isFinite(m.position.x)).toBe(true);
        expect(Number.isFinite(m.position.y)).toBe(true);
        expect(Number.isFinite(m.score)).toBe(true);
        expect(Number.isFinite(m.flankAngle)).toBe(true);
        expect(Number.isFinite(m.distance)).toBe(true);
      }
      expect(Number.isFinite(r.data.formationScore)).toBe(true);
      expect(Number.isFinite(r.data.angularCoverage)).toBe(true);
      expect(Number.isFinite(r.data.avgSeparation)).toBe(true);
    }
  });

  it('never emits NaN positions for any preset formation', () => {
    for (const formation of PRESET_FORMATIONS) {
      const r = runSquadSimulation({ ...base(), formation });
      expect(r.ok).toBe(true);
      if (r.ok) {
        for (const m of r.data.members) {
          expect(Number.isNaN(m.position.x)).toBe(false);
          expect(Number.isNaN(m.position.y)).toBe(false);
        }
      }
    }
  });

  it('propagates a typed error instead of emitting NaN coordinates', () => {
    const r = runSquadSimulation({ ...base(), attackDistance: NaN });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('non-finite');
      expect(r.error.field).toBe('attackDistance');
      expect(typeof r.error.message).toBe('string');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = runSquadSimulation(base());
    const b = runSquadSimulation(base());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.data.members.map(m => m.position.x)).toEqual(b.data.members.map(m => m.position.x));
    }
  });
});
