/**
 * "Tweak params or reseed" is answered by measurement, not prose.
 *
 * Registry standard: `game-production/procedural-level-planning` — a designer
 * changes one number, sees a directed change, and stops re-rolling; remedies
 * go only through levers the algorithm reads (the parameter-support matrix).
 * Every figure below comes from the real generators, never from a fixture.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as previewModule from '@/lib/level-design/procgen-preview';
import {
  findLayoutRemedies, applyRemedy, REMEDY_SEED_SCAN, REMEDY_PREVIEW_BUDGET,
  type LayoutDiagnosis, type LeverRemedy,
} from '@/lib/level-design/layout-remedies';
import {
  buildProcgenSpec, previewConfigFromSpec, specFieldsIgnoredBy,
  type ProcgenSpec, type ProcgenLevelType,
} from '@/lib/level-design/procgen-spec';
import type { PreviewAlgorithm } from '@/lib/level-design/algo-params';
import { hashSeed } from '@/lib/level-design/frandom-stream';

const { generatePreview, DEFAULT_MAX_PREVIEW_SIZE } = previewModule;

afterEach(() => { vi.restoreAllMocks(); });

const CONSTRAINTS = {
  spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false, ensureConnected: false,
};

function spec(over: Partial<Parameters<typeof buildProcgenSpec>[0]> = {}): ProcgenSpec {
  return buildProcgenSpec({
    algorithm: 'bsp', levelType: 'dungeon',
    gridWidth: 64, gridHeight: 64, roomCountMin: 8, roomCountMax: 15, corridorWidth: 3,
    seed: '', constraints: CONSTRAINTS, ...over,
  });
}

const statsOf = (s: ProcgenSpec) => generatePreview(previewConfigFromSpec(s)).stats;
const needed = (d: LayoutDiagnosis) => {
  if (!d.needed) throw new Error('expected a fragmented layout');
  return d;
};

/** First seed in 0..199 whose cellular 64x64 preview is fragmented, measured. */
function fragmentedCellularSeed(): string {
  for (let i = 0; i < 200; i++) {
    if (statsOf(spec({ algorithm: 'cellular', seed: String(i) })).regions > 1) return String(i);
  }
  throw new Error('no fragmented cellular seed in 0..199');
}

/** A spread of specs over every algorithm, level size and a few seeds. */
function specMatrix(): ProcgenSpec[] {
  const out: ProcgenSpec[] = [];
  const algorithms: PreviewAlgorithm[] = ['bsp', 'wfc', 'cellular', 'perlin'];
  const types: [ProcgenLevelType, number][] = [['dungeon', 64], ['openworld', 256]];
  for (const algorithm of algorithms) for (const [levelType, g] of types) for (const seed of ['', '12', 'abc']) {
    out.push(spec({ algorithm, levelType, gridWidth: g, gridHeight: g, seed }));
  }
  return out;
}

describe('findLayoutRemedies — WFC at the dungeon defaults', () => {
  it('reseeding does not help, and corridor width is never offered', () => {
    expect(REMEDY_SEED_SCAN).toBeLessThanOrEqual(100);
    const d = needed(findLayoutRemedies(spec({ algorithm: 'wfc' })));
    expect(d.seedScan.tried).toBe(REMEDY_SEED_SCAN);
    expect(d.seedScan.connected).toEqual([]);
    expect(d.remedies.some((r) => r.field === 'corridorWidth' || r.patch.corridorWidth !== undefined)).toBe(false);
    // …and the lever that does work is offered.
    expect(d.remedies.map((r) => r.field)).toContain('roomBand');
  });
});

describe('every remedy is verified', () => {
  it('the patched spec previews as one region at the current seed, with the stats it reports', () => {
    const remedies: [ProcgenSpec, LeverRemedy][] = [];
    for (const s of [...specMatrix(), spec({ algorithm: 'cellular', seed: fragmentedCellularSeed() })]) {
      const d = findLayoutRemedies(s);
      if (d.needed) for (const r of d.remedies) remedies.push([s, r]);
    }
    expect(remedies.length).toBeGreaterThan(0);
    for (const [s, r] of remedies) {
      const patched = applyRemedy(s, r);
      expect(patched.seedValue).toBe(s.seedValue);
      const stats = statsOf(patched);
      expect(stats.regions).toBe(1);
      expect(r.after).toEqual(stats);
    }
  });
});

describe('field hygiene comes from the matrix', () => {
  it('no remedy touches a field the browser preview ignores for its algorithm', () => {
    let checked = 0;
    for (const s of [...specMatrix(), spec({ algorithm: 'cellular', seed: fragmentedCellularSeed() })]) {
      const d = findLayoutRemedies(s);
      if (!d.needed) continue;
      const ignored = specFieldsIgnoredBy('browser-preview', s);
      for (const r of d.remedies) {
        checked++;
        expect(ignored).not.toContain(r.field);
        if (s.algorithm === 'cellular' || s.algorithm === 'perlin') {
          expect(r.patch.roomCountMin ?? r.patch.roomCountMax ?? r.patch.corridorWidth).toBeUndefined();
          expect(['roomBand', 'corridorWidth']).not.toContain(r.field);
        }
        if (s.algorithm !== 'cellular') {
          expect(r.patch.constraints?.ensureConnected).toBeUndefined();
          expect(r.field).not.toBe('ensureConnected');
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the live lever set is derived, never listed per algorithm', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/level-design/layout-remedies.ts'), 'utf8');
    expect(src).toContain("specFieldsIgnoredBy('browser-preview'");
    for (const alg of ['bsp', 'wfc', 'cellular', 'perlin']) expect(src).not.toContain(`'${alg}'`);
  });
});

describe('a fragmented cellular cave', () => {
  it('offers Ensure Connected and nearby seeds, each measured', () => {
    const s = spec({ algorithm: 'cellular', seed: fragmentedCellularSeed() });
    expect(s.constraints.ensureConnected).toBe(false);
    const d = needed(findLayoutRemedies(s));
    const toggle = d.remedies.find((r) => r.field === 'ensureConnected');
    expect(toggle?.patch.constraints?.ensureConnected).toBe(true);
    expect(d.seedScan.connected.length).toBeGreaterThan(0);
    for (const c of d.seedScan.connected) {
      expect(hashSeed(c.seedLabel)).toBe(c.seedValue);
      expect(c.after).toEqual(statsOf(spec({ algorithm: 'cellular', seed: c.seedLabel })));
      expect(c.after.regions).toBe(1);
    }
  });
});

describe('a connected layout needs nothing', () => {
  it('returns needed:false without an extra preview when the caller holds the stats', () => {
    const s = spec();
    const current = statsOf(s);
    expect(current.regions).toBe(1);
    const call = vi.spyOn(previewModule, 'generatePreview');
    const d = findLayoutRemedies(s, current);
    expect(d.needed).toBe(false);
    expect(call).toHaveBeenCalledTimes(0);
    // Without them, the only call is the baseline itself.
    expect(findLayoutRemedies(s).needed).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('budget and purity', () => {
  it('stays within the preview budget at the preview cap, never mutates, and is deterministic', () => {
    const call = vi.spyOn(previewModule, 'generatePreview');
    for (const s of [...specMatrix(), spec({ algorithm: 'cellular', seed: fragmentedCellularSeed() })]) {
      const frozen = deepFreeze(structuredClone(s));
      call.mockClear();
      const a = findLayoutRemedies(frozen);
      expect(call.mock.calls.length).toBeLessThanOrEqual(REMEDY_PREVIEW_BUDGET);
      for (const [config] of call.mock.calls) {
        expect(config.maxPreviewSize === undefined || config.maxPreviewSize <= DEFAULT_MAX_PREVIEW_SIZE).toBe(true);
      }
      expect(findLayoutRemedies(frozen)).toEqual(a);
    }
  });
});

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}
