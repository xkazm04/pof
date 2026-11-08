/**
 * A remedy listed as "one region" must hold on the grid that ships.
 *
 * Registry standard: `game-production/procedural-level-planning` —
 * `seed-determinism-contract`: a different parameter set (here, a different
 * generation size) is a different level. The export regenerates at
 * MAX_EXPORT_SIZE, so a remedy verified only on the 96-cell preview can be
 * fragmented again at export. Every figure comes from the real generators.
 */
import { describe, it, expect } from 'vitest';
import { generatePreview } from '@/lib/level-design/procgen-preview';
import { findLayoutRemedies, applyRemedy, specAtSeed, REMEDY_VERIFY_SIZE } from '@/lib/level-design/layout-remedies';
import { buildProcgenSpec, previewConfigFromSpec, type ProcgenSpec } from '@/lib/level-design/procgen-spec';
import { MAX_EXPORT_SIZE } from '@/components/modules/content/level-design/ProceduralLevelWizard/exportPlan';
import type { PreviewAlgorithm } from '@/lib/level-design/algo-params';

const CONSTRAINTS = {
  spawnPoints: true, lootPlacement: true, bossRoom: true, secretRooms: false, safeZones: false, ensureConnected: false,
};
const ALGORITHMS: PreviewAlgorithm[] = ['bsp', 'cellular', 'wfc', 'perlin'];

const big = (algorithm: PreviewAlgorithm, seed: string): ProcgenSpec => buildProcgenSpec({
  algorithm, levelType: 'dungeon', gridWidth: 256, gridHeight: 256,
  roomCountMin: 8, roomCountMax: 15, corridorWidth: 3, seed, constraints: CONSTRAINTS,
});

const regionsAtExport = (s: ProcgenSpec) => generatePreview(previewConfigFromSpec(s, MAX_EXPORT_SIZE)).stats.regions;

describe('layout remedies at export size', () => {
  it('verifies at the size the wizard exports', () => {
    expect(REMEDY_VERIFY_SIZE).toBe(MAX_EXPORT_SIZE);
  });

  it('every listed remedy and seed is one region on the 256 grid that exports', () => {
    let listed = 0;
    const failures: string[] = [];
    for (const algorithm of ALGORITHMS) {
      for (let i = 0; i < 12; i++) {
        const spec = big(algorithm, `rx-${i}`);
        const d = findLayoutRemedies(spec);
        if (!d.needed) continue;
        for (const r of d.remedies) {
          listed++;
          if (regionsAtExport(applyRemedy(spec, r)) !== 1) failures.push(`${algorithm} rx-${i} remedy ${r.field}`);
        }
        for (const c of d.seedScan.connected) {
          listed++;
          if (regionsAtExport(specAtSeed(spec, c.seedValue)) !== 1) failures.push(`${algorithm} rx-${i} seed ${c.seedLabel}`);
        }
      }
    }
    expect(listed).toBeGreaterThan(20);
    expect(failures).toEqual([]);
  });
});
