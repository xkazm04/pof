import {
  FIXED_POINT,
  blockProbability,
  lifeAndMana,
  monsterDamageByDifficulty,
  monsterMeleeHitChance,
  monsterRangedHitChance,
  playerMeleeDamage,
  playerMeleeHitChance,
  playerRangedDamage,
  playerRangedHitChance,
  playerResistance,
  type ClassCoefficients,
  type Element,
  type MonsterProfile,
  type PlayerBuild,
} from '@/lib/catalog/reference/combatMath';

export interface DuelOptions {
  playerAttack: 'melee' | 'ranged';
  playerDistance?: number;
  monsterAttack: 'melee' | 'ranged-arrow' | 'ranged-magic';
  monsterDistance?: number;
  dungeonLevel: number;
  playerMode?: 'standing' | 'attacking' | 'other';
  playerGetHit?: number;
  monsterElement?: Element;
}

/**
 * Expected-value duel using only the engine-law functions in `combatMath`.
 * Damage remains in the engine's fixed-point units (64 = one hit point).
 */
export function duel(build: PlayerBuild, coefficients: ClassCoefficients, monster: MonsterProfile, opts: DuelOptions) {
  const playerHitChance = opts.playerAttack === 'melee'
    ? playerMeleeHitChance(build, coefficients, monster)
    : playerRangedHitChance(build, coefficients, monster, opts.playerDistance ?? 0);
  const playerDamage = opts.playerAttack === 'melee'
    ? playerMeleeDamage(build, coefficients, monster)
    : playerRangedDamage(build, monster);
  const expectedPlayerDamagePerSwing = playerHitChance * playerDamage.mean;
  const meanMonsterHitPoints = (monster.hitPoints.min + monster.hitPoints.max) * FIXED_POINT / 2;

  const monsterHitChance = opts.monsterAttack === 'melee'
    ? monsterMeleeHitChance(build, monster, opts.dungeonLevel)
    : monsterRangedHitChance(build, monster, {
      distance: opts.monsterDistance ?? 0,
      dungeonLevel: opts.dungeonLevel,
      projectile: opts.monsterAttack === 'ranged-arrow' ? 'arrow' : 'magic',
    });
  const monsterDamage = monsterDamageByDifficulty(monster, {
    playerGetHit: opts.playerGetHit,
    attack: opts.monsterAttack === 'melee' ? 'melee' : 'projectile',
  }).damage;
  const monsterElement = opts.monsterElement ?? (opts.monsterAttack === 'ranged-magic' ? 'magic' : 'physical');
  const resistance = playerResistance(build, 0, monsterElement).resistance;
  const block = blockProbability(build, coefficients, monster, monsterHitChance, {
    kind: opts.monsterAttack === 'melee' ? 'melee' : 'missile',
    playerMode: opts.playerMode,
    resistance,
  });
  const resistedDamageMean = monsterDamage.outcomes.reduce(
    (sum, outcome) => sum + playerResistance(build, outcome.damage, monsterElement).damage * outcome.weight,
    0,
  ) / monsterDamage.expectedDenominator;
  const expectedMonsterDamagePerHit = resistedDamageMean * (1 - block.conditionalBlockChance);
  const expectedMonsterDamagePerSwing = resistedDamageMean * block.damagingHitChance;
  const playerLife = lifeAndMana(build, coefficients).maximumLife;

  return {
    playerHitChance,
    expectedPlayerDamagePerSwing,
    expectedPlayerSwingsToKill: expectedPlayerDamagePerSwing > 0 ? meanMonsterHitPoints / expectedPlayerDamagePerSwing : Infinity,
    monsterHitChance,
    expectedMonsterDamagePerHit,
    expectedMonsterHitsToKillPlayer: expectedMonsterDamagePerHit > 0 ? playerLife / expectedMonsterDamagePerHit : Infinity,
    expectedMonsterDamagePerSwing,
    expectedMonsterSwingsToKillPlayer: expectedMonsterDamagePerSwing > 0 ? playerLife / expectedMonsterDamagePerSwing : Infinity,
  };
}
