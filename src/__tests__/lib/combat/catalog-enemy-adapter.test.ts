import { describe, it, expect } from 'vitest';
import {
  bestiaryToEnemyArchetype,
  buildEnemyRegistry,
  defaultScenarioForArchetype,
  type BestiaryArtifactLike,
  type CatalogEnemyEntity,
} from '@/lib/combat/catalog-enemy-adapter';
import { runCombatSimulation } from '@/lib/combat/simulation-engine';
import { DEFAULT_TUNING, DEFAULT_CONFIG, ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';

const ENTITY: CatalogEnemyEntity = { id: 'stone-brute', name: 'Stone Brute' };

/** Artifacts shaped exactly like the bestiary pipeline authors them. */
function fixtureArtifacts(overrides?: Partial<{ health: number; damage: number; armor: number }>): BestiaryArtifactLike[] {
  return [
    {
      step: 'Stat Block',
      data: {
        stats: {
          health: overrides?.health ?? 420,
          damage: overrides?.damage ?? 35,
          armor: overrides?.armor ?? 120,
          moveSpeed: 300,
          monsterLevel: 20,
          dangerRank: 3,
        },
      },
    },
    {
      step: 'AI Behavior',
      data: {
        behavior: {
          tree: 'BT_StoneBrute',
          aggroRange: 1200,
          archetype: 'tank',
          attacks: [
            { name: 'Overhead Cleave', telegraphMs: 900, activeMs: 200, recoveryMs: 700, range: 220, weight: 0.5 },
            { name: 'Shield Shove', telegraphMs: 500, activeMs: 150, recoveryMs: 450, range: 160, weight: 0.3 },
            { name: 'Ground Slam', telegraphMs: 1400, activeMs: 250, recoveryMs: 1100, range: 320, weight: 0.2 },
          ],
        },
      },
    },
  ];
}

describe('catalog-enemy-adapter — bestiary → EnemyArchetype', () => {
  it('hydrates a bestiary fixture to the expected enemy config', () => {
    const res = bestiaryToEnemyArchetype(ENTITY, fixtureArtifacts());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const a = res.data;

    expect(a.id).toBe('stone-brute');
    expect(a.name).toBe('Stone Brute');
    // Catalog stat row → sim attributes (the source of truth).
    expect(a.baseAttributes.health).toBe(420);
    expect(a.baseAttributes.maxHealth).toBe(420);
    expect(a.baseAttributes.armor).toBe(120);
    expect(a.baseAttributes.attackPower).toBe(35);

    // Telegraphed attack set → abilities, primary (highest weight) first.
    expect(a.abilities.length).toBe(3);
    expect(a.abilities[0].name).toBe('Overhead Cleave');
    expect(a.abilities[0].type).toBe('melee');
    expect(a.abilities[0].cooldownSec).toBe(0);
    // Ground Slam classified AoE + gated behind a cooldown.
    const slam = a.abilities.find((x) => x.name === 'Ground Slam');
    expect(slam?.type).toBe('aoe');
    expect(slam?.aoeRadius).toBe(320);
    expect((slam?.cooldownSec ?? 0)).toBeGreaterThan(0);

    expect(a.aggroRange).toBe(1200);
    expect(a.xpReward).toBeGreaterThan(0);
  });

  it('degrades gracefully — missing Stat Block returns err (no throw)', () => {
    const res = bestiaryToEnemyArchetype(ENTITY, [{ step: 'Lore', data: { lore: 'x' } }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Stat Block/);
  });

  it('buildEnemyRegistry with no hydrated entities is exactly the defaults', () => {
    const reg = buildEnemyRegistry([]);
    expect(reg.size).toBe(ENEMY_ARCHETYPE_BY_ID.size);
    for (const [k, v] of ENEMY_ARCHETYPE_BY_ID) expect(reg.get(k)).toBe(v);
  });

  it('a hydrated enemy runs through the sim and its stats move a metric', () => {
    const base = bestiaryToEnemyArchetype(ENTITY, fixtureArtifacts());
    // Same row, but a much tankier + harder-hitting variant (designer edit).
    const buffed = bestiaryToEnemyArchetype(ENTITY, fixtureArtifacts({ health: 900, damage: 70 }));
    expect(base.ok && buffed.ok).toBe(true);
    if (!base.ok || !buffed.ok) return;

    const cfg = { ...DEFAULT_CONFIG, iterations: 300, seed: 11 };
    const scenario = defaultScenarioForArchetype(base.data);

    const baseRun = runCombatSimulation(scenario, DEFAULT_TUNING, cfg, buildEnemyRegistry([base.data]));
    const buffedRun = runCombatSimulation(scenario, DEFAULT_TUNING, cfg, buildEnemyRegistry([buffed.data]));

    // The tankier/deadlier catalog row must depress survival and/or lengthen fights.
    expect(buffedRun.summary.survivalRate).toBeLessThan(baseRun.summary.survivalRate);
    expect(buffedRun.summary.avgFightDurationSec).not.toBe(baseRun.summary.avgFightDurationSec);
  });

  it('without a registry override, the engine still uses the hardcoded defaults', () => {
    // Stand-alone: reference a hardcoded archetype id, no override passed.
    const scenario = defaultScenarioForArchetype(
      { ...ENEMY_ARCHETYPE_BY_ID.get('brute')! },
    );
    const run = runCombatSimulation(scenario, DEFAULT_TUNING, { ...DEFAULT_CONFIG, iterations: 100, seed: 3 });
    expect(run.summary.survivalRate).toBeGreaterThanOrEqual(0);
    expect(run.fights.length).toBe(100);
  });
});
