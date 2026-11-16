/**
 * The spec resolves its seed once; the preview reads it instead of re-hashing.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract`: re-deriving a quantity at a call site is how
 * stages diverge. Output must stay byte-identical for every real spec.
 */
import { describe, it, expect } from 'vitest';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { buildProcgenSpec, previewConfigFromSpec } from '@/lib/level-design/procgen-spec';
import type { PreviewAlgorithm } from '@/lib/level-design/algo-params';

const C = { spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false, ensureConnected: true };
const ALGORITHMS: PreviewAlgorithm[] = ['bsp', 'cellular', 'wfc', 'perlin'];
const SEEDS = ['', '0', '42', '-7', '0x1F', 'forge', 'Pillars of Fortune', '4294967295'];

const specFor = (algorithm: PreviewAlgorithm, seed: string) => buildProcgenSpec({
  algorithm, levelType: 'dungeon', gridWidth: 64, gridHeight: 48,
  roomCountMin: 6, roomCountMax: 12, corridorWidth: 3, seed, constraints: C,
});

const digest = (g: unknown) => JSON.stringify(g);

describe('single seed derivation on the spec path', () => {
  it('the preview uses the spec\'s resolved seedValue rather than re-hashing the label', () => {
    const spec = { ...specFor('bsp', 'label'), seedValue: 777 };
    expect(generatePreview(previewConfigFromSpec(spec)).seedValue).toBe(777);
  });

  it('grids are byte-identical to the label-only derivation across algorithms and seeds', () => {
    let compared = 0;
    for (const algorithm of ALGORITHMS) {
      for (const seed of SEEDS) {
        const spec = specFor(algorithm, seed);
        const viaSpec = generatePreview(previewConfigFromSpec(spec));
        const { seedValue: _resolved, ...labelOnly } = previewConfigFromSpec(spec);
        void _resolved;
        const viaLabel = generatePreview(labelOnly);
        expect(digest(viaSpec.grid)).toBe(digest(viaLabel.grid));
        expect(viaSpec.seedValue).toBe(viaLabel.seedValue);
        expect(viaSpec.stats).toEqual(viaLabel.stats);
        compared++;
      }
    }
    expect(compared).toBe(ALGORITHMS.length * SEEDS.length);
  });
});
