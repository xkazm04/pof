import { describe, it, expect } from 'vitest';
import {
  archetypeIdForBestiaryEntity,
  groupBestiaryArtifacts,
  hydrateEnemyRegistryFromBestiary,
  HARDCODED_ENEMY_SOURCE,
  type BestiaryEntityRows,
} from '@/lib/combat/simulation-engine';
import { ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';
import { runPredictiveBalance, DEFAULT_PREDICTIVE_CONFIG } from '@/lib/combat/predictive-balance';

/** A bestiary row the adapter can hydrate: a populated Stat Block + behavior. */
const bruteRow = (o: { health?: number; damage?: number; armor?: number } = {}): BestiaryEntityRows => ({
  entityId: 'bestiary-brute',
  name: 'Stone Brute',
  artifacts: [
    {
      step: 'Stat Block',
      data: {
        stats: {
          health: o.health ?? 400,
          damage: o.damage ?? 30,
          armor: o.armor ?? 20,
          moveSpeed: 300,
          dangerRank: 4,
        },
      },
    },
    {
      step: 'Behavior',
      data: {
        behavior: {
          aggroRange: 700,
          attacks: [
            { name: 'Smash', telegraphMs: 600, activeMs: 150, recoveryMs: 700, range: 200, weight: 3 },
          ],
        },
      },
    },
  ],
});

describe('archetypeIdForBestiaryEntity', () => {
  it('strips the catalog prefix so an authored row OVERRIDES the hardcoded archetype', () => {
    expect(archetypeIdForBestiaryEntity('bestiary-brute')).toBe('brute');
    expect(ENEMY_ARCHETYPE_BY_ID.has('brute')).toBe(true);
  });
});

describe('groupBestiaryArtifacts', () => {
  it('groups a flat artifact list by entity, preserving order', () => {
    const rows = groupBestiaryArtifacts([
      { entityId: 'bestiary-brute', step: 'Stat Block', data: { stats: {} } },
      { entityId: 'bestiary-grunt', step: 'Stat Block', data: { stats: {} } },
      { entityId: 'bestiary-brute', step: 'Behavior', data: { behavior: {} } },
    ]);
    expect(rows.map((r) => r.entityId)).toEqual(['bestiary-brute', 'bestiary-grunt']);
    expect(rows[0].artifacts.map((a) => a.step)).toEqual(['Stat Block', 'Behavior']);
  });
});

describe('hydrateEnemyRegistryFromBestiary', () => {
  it('hydrates a usable row into the registry under the bare archetype id', () => {
    const { registry, provenance } = hydrateEnemyRegistryFromBestiary([bruteRow()]);
    const brute = registry.get('brute')!;
    expect(brute.name).toBe('Stone Brute');
    expect(brute.baseAttributes.maxHealth).toBe(400);
    expect(brute.baseAttributes.attackPower).toBe(30);
    expect(provenance.source).toBe('bestiary');
    expect(provenance.hydrated).toEqual([
      { archetypeId: 'brute', entityId: 'bestiary-brute', name: 'Stone Brute' },
    ]);
  });

  it('falls back to the hardcoded set AND says so when no row is usable', () => {
    const { registry, provenance } = hydrateEnemyRegistryFromBestiary([]);
    expect(provenance.source).toBe('hardcoded');
    expect(provenance.summary).toMatch(/hardcoded defaults/);
    expect(provenance.summary).toMatch(/FIXTURES/);
    // Every default archetype still resolves — the sim runs stand-alone.
    for (const id of ENEMY_ARCHETYPE_BY_ID.keys()) expect(registry.has(id)).toBe(true);
  });

  it('NAMES a row it cannot hydrate instead of silently defaulting it', () => {
    const broken: BestiaryEntityRows = {
      entityId: 'bestiary-wraith',
      name: 'Wraith',
      // Stat Block present but `armor` missing → the adapter refuses it.
      artifacts: [{ step: 'Stat Block', data: { stats: { health: 120, damage: 14 } } }],
    };
    const { registry, provenance } = hydrateEnemyRegistryFromBestiary([bruteRow(), broken]);
    expect(provenance.source).toBe('mixed');
    expect(provenance.skipped).toHaveLength(1);
    expect(provenance.skipped[0].entityId).toBe('bestiary-wraith');
    expect(provenance.skipped[0].reason).toMatch(/bestiary-wraith/);
    expect(provenance.skipped[0].reason).toMatch(/Stat Block/);
    expect(provenance.summary).toMatch(/skipped and named below/);
    // The refused row contributes NO archetype — it is absent, not faked.
    expect(registry.has('wraith')).toBe(false);
  });

  it('reports rows that were read but none hydrated', () => {
    const { provenance } = hydrateEnemyRegistryFromBestiary([
      { entityId: 'bestiary-ghost', artifacts: [{ step: 'Stat Block', data: {} }] },
    ]);
    expect(provenance.source).toBe('hardcoded');
    expect(provenance.summary).toMatch(/1 bestiary row\(s\) were read but none could be hydrated/);
    expect(provenance.skipped).toHaveLength(1);
  });
});

describe('a bestiary edit moves the simulator', () => {
  const cfg = {
    ...DEFAULT_PREDICTIVE_CONFIG,
    levelRange: [10, 10] as [number, number],
    levelStep: 1,
    iterations: 40,
    enemyConfigs: [{ archetypeId: 'brute', count: 1, levelOffset: 0 }],
    sensitivityAttributes: [],
  };

  const survivalWith = (row: BestiaryEntityRows) => {
    const { registry, provenance } = hydrateEnemyRegistryFromBestiary([row]);
    const report = runPredictiveBalance(cfg, { registry, provenance });
    return { report, survival: report.heatmap[0].survivalRate };
  };

  it('changing the bestiary Stat Block changes a simulated outcome', () => {
    const weak = survivalWith(bruteRow({ health: 120, damage: 6 }));
    const strong = survivalWith(bruteRow({ health: 4000, damage: 200 }));
    expect(weak.survival).toBeGreaterThan(strong.survival);
    // …and the sweep names the creature the designer authored.
    expect(weak.report.heatmap[0].enemyLabel).toContain('Stone Brute');
  });

  it('discloses the source on the report itself', () => {
    const { report } = survivalWith(bruteRow());
    expect(report.enemySource.source).toBe('bestiary');
    expect(report.enemySource.hydrated[0].archetypeId).toBe('brute');
  });

  it('a run given no catalog data reports the hardcoded fixtures, not silence', () => {
    const report = runPredictiveBalance(cfg);
    expect(report.enemySource).toEqual(HARDCODED_ENEMY_SOURCE);
    expect(report.enemySource.summary).toMatch(/FIXTURES/);
  });
});
