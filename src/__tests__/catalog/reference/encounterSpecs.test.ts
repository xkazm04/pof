import { describe, expect, it } from 'vitest';
import { SOURCED_FIELD } from '@/lib/catalog/acceptance/sourced';
import {
  DIABLO1_ENCOUNTER_LAWS,
  encounterEntities,
  seedEncounterSteps,
  type EncounterDuel,
} from '@/lib/catalog/reference/encounterSpecs';

const syntheticDuel: EncounterDuel = {
  model: 'combatDuel expected-value melee exchange',
  hero: 'warrior',
  heroLevel: 7,
  expectedDepth: 4,
  difficulty: 'normal',
  gameMode: 'single',
  playerHitChance: 0.6,
  expectedPlayerDamagePerSwingHp: 3,
  expectedPlayerHitsToKill: 10,
  expectedPlayerSwingsToKill: 16.666,
  expectedPlayerSecondsToKill: 8.333,
  monsterHitChance: 0.4,
  expectedMonsterDamagePerHitHp: 4,
  expectedMonsterDamagePerSwingHp: 1.6,
  expectedMonsterHitsToKillPlayer: 12,
  expectedMonsterSwingsToKillPlayer: 30,
  basis: 'synthetic test duel',
};

describe('Diablo I encounter entities', () => {
  const entities = encounterEntities();

  it('projects exactly the nine concrete encounters and keeps the template as a law only', () => {
    expect(entities).toHaveLength(9);
    expect(entities.some((wrapper) => wrapper.entity.id.includes('template'))).toBe(false);
    expect(new Set(entities.map((wrapper) => wrapper.entity.id)).size).toBe(9);
  });

  it('links location, boss, quest, and concrete minions without inventing DUN types', () => {
    const lazarus = entities.find((wrapper) => wrapper.entity.id === 'd1-encounter-lazarus')!.entity;
    expect(lazarus.links).toContainEqual({ catalogId: 'zone-map', entityId: 'd1-set-lazarus', role: 'location' });
    expect(lazarus.links).toContainEqual({ catalogId: 'bestiary', entityId: 'd1-uniq-arch-bishop-lazarus', role: 'boss' });
    expect(lazarus.links).toContainEqual({ catalogId: 'bestiary', entityId: 'd1-uniq-red-vex', role: 'minion' });
    expect(lazarus.links).toContainEqual({ catalogId: 'quests', entityId: 'd1-Q_BETRAYER', role: 'quest' });
    expect(lazarus.links!.some((link) => link.entityId.includes('${'))).toBe(false);
  });

  it('declares Lachdanan non-combat and preserves the two corrected premises', () => {
    const laachdanan = entities.find((wrapper) => wrapper.entity.id === 'd1-encounter-lachdanan')!.entity;
    const lazarus = entities.find((wrapper) => wrapper.entity.id === 'd1-encounter-lazarus')!.entity;
    const diablo = entities.find((wrapper) => wrapper.entity.id === 'd1-encounter-diablo')!.entity;
    expect(laachdanan.data.kind).toBe('scripted-noncombat');
    expect(laachdanan.data.stepGaps['Waves & Spawns']).toMatch(/never enters combat/);
    expect(lazarus.data.special).toMatch(/does not tile-teleport Lazarus/);
    expect(diablo.data.special).toMatch(/no Diablo-specific Apocalypse case/);
  });
});

describe('Diablo I encounter laws and seeds', () => {
  it('publishes five concise GitHub-sourced canon laws', () => {
    expect(DIABLO1_ENCOUNTER_LAWS).toHaveLength(5);
    for (const law of DIABLO1_ENCOUNTER_LAWS) {
      expect(law.body.length).toBeLessThanOrEqual(450);
      expect(law.body).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/);
      expect(law.refs?.every((ref) => ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/'))).toBe(true);
    }
  });

  it('gives every concrete encounter a checker-length sourced brief', () => {
    for (const wrapper of encounterEntities()) {
      const brief = seedEncounterSteps(wrapper.entity)[0];
      expect(brief.step).toBe('Concept Brief');
      expect((brief.data.brief as string).length).toBeGreaterThanOrEqual(300);
    }
  });

  it('seeds checker-shaped sourced artifacts and carries a synthetic derived duel', () => {
    const gharbad = encounterEntities().find((wrapper) => wrapper.entity.id === 'd1-encounter-gharbad')!.entity;
    const seeds = seedEncounterSteps(gharbad, syntheticDuel);
    expect(seeds.map((seed) => seed.step)).toEqual(['Concept Brief', 'Waves & Spawns', 'Win/Loss Rules']);
    expect(seeds.every((seed) => seed.data[SOURCED_FIELD] != null)).toBe(true);

    const brief = seeds[0].data.brief;
    expect(typeof brief).toBe('string');
    expect((brief as string).length).toBeGreaterThanOrEqual(300);

    const waves = seeds[1].data.waves as Record<string, unknown>;
    expect(waves.waveCount).toBe(1);
    expect(Array.isArray(waves.waveDetails)).toBe(true);
    expect(waves.derivedDuel).toEqual(syntheticDuel);
    expect(seeds[1].gaps.join(' ')).toMatch(/areaLevel/);
    expect(seeds[1].gaps.join(' ')).toMatch(/wiringContract/);

    const winLoss = seeds[2].data.winLoss as Record<string, unknown>;
    expect(typeof winLoss.winCondition).toBe('string');
    expect(typeof winLoss.lossCondition).toBe('string');
    expect(seeds[2].gaps.join(' ')).toMatch(/failSafe/);
  });

  it('does not invent a Lachdanan wave or duel', () => {
    const laachdanan = encounterEntities().find((wrapper) => wrapper.entity.id === 'd1-encounter-lachdanan')!.entity;
    const seeds = seedEncounterSteps(laachdanan);
    expect(seeds.map((seed) => seed.step)).toEqual(['Concept Brief', 'Win/Loss Rules']);
  });
});
