import { describe, expect, it } from 'vitest';
import {
  expectedMonsterRecoveryStartsPerCast,
  PLAYER_SPELL_HIT_SOURCES,
  playerSpellCastDamageOutcomes,
  resolvePlayerSpellHits,
} from '@/lib/catalog/reference/playerSpellHits';

describe('player persistent spell hit topology', () => {
  it('keeps every structured rule pinned to source lines and states the collision representation', () => {
    expect(PLAYER_SPELL_HIT_SOURCES.map((source) => source.spell)).toEqual([
      'Lightning', 'ChainLightning', 'Flash', 'FireWall', 'Fireball',
      'Guardian', 'FlameWave', 'Nova', 'Inferno', 'Apocalypse',
    ]);
    for (const source of PLAYER_SPELL_HIT_SOURCES) {
      expect(source.refs.length, source.spell).toBeGreaterThan(0);
      expect(source.refs.every((ref) => /\.reference\/devilutionX\/Source\/.+:\d/.test(ref)), source.spell).toBe(true);
      expect(['already-shifted-fixed-point', 'whole-hit-points']).toContain(source.collisionDamage);
    }
  });

  it('resolves Lightning and the selected-target Chain Lightning double path', () => {
    expect(resolvePlayerSpellHits('Lightning', { spellLevel: 1, characterLevel: 10, targetDistance: 4 }))
      .toMatchObject({ maximumCollisionChecks: 6, groups: [{ collisionChecks: 6 }] });
    expect(resolvePlayerSpellHits('ChainLightning', { spellLevel: 1, characterLevel: 10, targetDistance: 4 }))
      .toMatchObject({ maximumCollisionChecks: 12, groups: [{ collisionChecks: 6 }, { collisionChecks: 6 }] });
    expect(resolvePlayerSpellHits('ChainLightning', { spellLevel: 1, characterLevel: 10, targetDistance: 5 }))
      .toMatchObject({ maximumCollisionChecks: 6 });
  });

  it('resolves stationary wall, path, nova, guardian, and Inferno geometry', () => {
    expect(resolvePlayerSpellHits('FireWall', { spellLevel: 1, characterLevel: 10 }).maximumCollisionChecks).toBe(320);
    expect(resolvePlayerSpellHits('FlameWave', { spellLevel: 1, characterLevel: 10 }).maximumCollisionChecks).toBe(1);
    expect(resolvePlayerSpellHits('Nova', { spellLevel: 1, characterLevel: 10 }).maximumCollisionChecks).toBe(1);
    expect(resolvePlayerSpellHits('Nova', { spellLevel: 1, characterLevel: 10, novaCardinalRay: true }).maximumCollisionChecks).toBe(2);
    expect(resolvePlayerSpellHits('Guardian', { spellLevel: 1, characterLevel: 1, targetDistance: 6 }).maximumCollisionChecks).toBe(2);
    expect(resolvePlayerSpellHits('Guardian', { spellLevel: 1, characterLevel: 10, targetDistance: 6 }).maximumCollisionChecks).toBe(6);
    expect([1, 2, 3, 4].map((targetDistance) => resolvePlayerSpellHits('Inferno', {
      spellLevel: 1,
      characterLevel: 10,
      targetDistance,
    }).maximumCollisionChecks)).toEqual([20, 25, 30, 0]);
  });

  it('keeps Fireball blast to-hit gated by its direct flight hit', () => {
    const fireball = resolvePlayerSpellHits('Fireball', { spellLevel: 1, characterLevel: 1 });
    expect(playerSpellCastDamageOutcomes([{ damage: 10, weight: 1 }], 0.5, fireball.groups)).toEqual([
      { damage: 0, weight: 0.5 },
      { damage: 10, weight: 0.25 },
      { damage: 20, weight: 0.25 },
    ]);
  });

  it('uses the runtime sprite length for Apocalypse retries and stops after one hit', () => {
    expect(() => resolvePlayerSpellHits('Apocalypse', { spellLevel: 1, characterLevel: 10 }))
      .toThrow(/apocalypseBoomAnimationTicks/);
    const apocalypse = resolvePlayerSpellHits('Apocalypse', {
      spellLevel: 1,
      characterLevel: 10,
      apocalypseBoomAnimationTicks: 7,
    });
    expect(apocalypse.maximumCollisionChecks).toBe(7);
    const outcomes = playerSpellCastDamageOutcomes([{ damage: 10, weight: 1 }], 0.5, apocalypse.groups);
    expect(outcomes.find((outcome) => outcome.damage === 0)?.weight).toBeCloseTo(0.5 ** 7, 15);
    expect(outcomes.find((outcome) => outcome.damage === 10)?.weight).toBeCloseTo(1 - 0.5 ** 7, 15);
  });

  it('counts every qualifying persistent hit as a recovery restart', () => {
    const lightning = resolvePlayerSpellHits('Lightning', { spellLevel: 1, characterLevel: 10 });
    expect(expectedMonsterRecoveryStartsPerCast(
      [{ damage: 10, weight: 1 }],
      0.5,
      lightning.groups,
      () => true,
    )).toBe(3);
  });
});
