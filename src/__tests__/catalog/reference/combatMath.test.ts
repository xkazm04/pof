import { describe, expect, it } from 'vitest';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { DEFAULT_RANGED_ENGAGEMENT_DISTANCE, duel } from '@/lib/catalog/reference/combatDuel';
import {
  FIXED_POINT,
  attackTiming,
  blockTiming,
  castTiming,
  blockProbability,
  experienceAward,
  experienceCurveLaw,
  expectedHitsToKill,
  hitRecovery,
  hitRecoveryTiming,
  lifeAndMana,
  monsterDamageByDifficulty,
  monsterHitPointDistribution,
  monsterHitPoints,
  monsterMeleeHitChance,
  monsterRangedHitChance,
  monsterResistance,
  playerMeleeDamage,
  playerMeleeHitChance,
  playerRangedDamage,
  playerRangedHitChance,
  playerResistance,
  playerSpellHitChance,
  type ClassCoefficients,
  type ClassAnimations,
  type MonsterProfile,
  type PlayerBuild,
} from '@/lib/catalog/reference/combatMath';

// All coefficients and stats below are synthetic, deliberately not rows from the reference tables.
const COEFFICIENTS: ClassCoefficients = {
  classFlags: ['CriticalStrike'],
  baseStrength: 1, baseMagic: 2, baseDexterity: 3, baseVitality: 4,
  maxStrength: 91, maxMagic: 92, maxDexterity: 93, maxVitality: 94,
  blockBonus: 7,
  lifeAdjustment: 320, manaAdjustment: 192, lifePerLevel: 128, manaPerLevel: 64,
  lifePerBaseVitality: 96, manaPerBaseMagic: 32, lifePerItemVitality: 96, manaPerItemMagic: 32,
  baseMagicToHit: 17, baseMeleeToHit: 13, baseRangedToHit: 9,
};
const BUILD: PlayerBuild = {
  class: 'Warrior', level: 10, strength: 21, magic: 7, dexterity: 11, vitality: 9,
  weaponDamage: { min: 2, max: 4 }, weaponType: 'sword',
  armourClass: 8, toHitBonusPercent: 5, damageBonusPercent: 25, flatDamage: 1,
  hasShield: true, blockEnabled: true, resistances: { magic: 0, fire: 0, lightning: 0 },
  armourPiercing: 3,
};
const MONSTER: MonsterProfile = {
  level: 8, hitPoints: { min: 30, max: 40 }, armourClass: 15, toHit: 20,
  damage: { min: 2, max: 3 }, monsterClass: 'demon', resist: {}, immune: {}, difficulty: 'normal',
};

const ANIMATIONS: ClassAnimations = {
  attack: Object.fromEntries([
    'unarmed', 'unarmedShield', 'sword', 'swordShield', 'bow', 'axe', 'mace', 'maceShield', 'staff',
  ].map((graphic) => [graphic, graphic === 'bow' ? { frames: 13, actionFrame: 8 } : { frames: 12, actionFrame: 7 }])) as ClassAnimations['attack'],
  cast: { frames: 10, actionFrame: 6 },
  block: { frames: 5 },
  hitRecovery: { frames: 8 },
};

describe('Diablo I hero animation timing', () => {
  it('derives attack ticks and seconds, including the distinct vanilla bow skips', () => {
    // Faster sword: 12 declared frames - 3 skipped = 9 ticks; 9 / 20 = 0.45 seconds.
    expect(attackTiming(ANIMATIONS, 'sword', 'faster')).toEqual({ frames: 12, actionFrame: 7, ticks: 9, seconds: 0.45 });
    // Faster does not skip vanilla bow frames: 13 / 20 = 0.65 seconds. Fast skips 2: 11 / 20 = 0.55.
    expect(attackTiming(ANIMATIONS, 'bow', 'faster').seconds).toBe(0.65);
    expect(attackTiming(ANIMATIONS, 'bow', 'fast').seconds).toBe(0.55);
  });

  it('derives cast, block, and hit-recovery timing by hand', () => {
    // Cast: 10 one-tick frames = 0.5 s; release marker 6 = 0.3 s.
    expect(castTiming(ANIMATIONS)).toMatchObject({ frames: 10, actionFrame: 6, ticks: 10, seconds: 0.5, releaseSeconds: 0.3 });
    // Block: 5*3-(3-1)=13 ticks; Fast Block keeps 2*3-2=4 ticks.
    expect(blockTiming(ANIMATIONS)).toEqual({ frames: 5, ticks: 13, seconds: 0.65 });
    expect(blockTiming(ANIMATIONS, true)).toEqual({ frames: 5, ticks: 4, seconds: 0.2 });
    // Faster recovery: 8-2=6 one-tick frames; 6/20=0.3 s.
    expect(hitRecoveryTiming(ANIMATIONS, 'faster')).toEqual({ frames: 8, ticks: 6, seconds: 0.3 });
  });
});

describe('Diablo I hit probabilities', () => {
  it('computes player melee chance, both clamps, impossible targets and petrification', () => {
    // 10 + trunc(11/2) + 5 + 13 + 3 - 15 = 21%, including the odd-Dexterity truncation.
    expect(playerMeleeHitChance(BUILD, COEFFICIENTS, MONSTER)).toBe(0.21);
    expect(playerMeleeHitChance(BUILD, COEFFICIENTS, { ...MONSTER, armourClass: 200 })).toBe(0.05);
    expect(playerMeleeHitChance(BUILD, COEFFICIENTS, { ...MONSTER, armourClass: -200 })).toBe(0.95);
    expect(playerMeleeHitChance(BUILD, COEFFICIENTS, { ...MONSTER, possibleToHit: false })).toBe(0);
    expect(playerMeleeHitChance(BUILD, COEFFICIENTS, { ...MONSTER, petrified: true })).toBe(1);
  });

  it('applies difficulty armour once to player melee and ranged to-hit', () => {
    const accurate = { ...BUILD, toHitBonusPercent: 100 };
    // Nightmare melee: 10 + trunc(11/2) + 100 + 13 + 3 - (15 + 50) = 66%.
    expect(playerMeleeHitChance(accurate, COEFFICIENTS, { ...MONSTER, difficulty: 'nightmare' })).toBe(0.66);
    // Hell arrow at distance 3: 10 + 11 + 100 + 9 + 3 - (15 + 80) - trunc(3^2/2) = 34%.
    expect(playerRangedHitChance(accurate, COEFFICIENTS, { ...MONSTER, difficulty: 'hell' }, 3)).toBe(0.34);
    // effectiveUnique has already applied Nightmare's +50, so difficultyAdjusted prevents a second bonus.
    expect(playerMeleeHitChance(accurate, COEFFICIENTS, { ...MONSTER, armourClass: 65, difficulty: 'nightmare', difficultyAdjusted: true })).toBe(0.66);
  });

  it('computes ranged and spell chance with distance and difficulty-adjusted level', () => {
    // Arrow: 10 + 11 + 5 + 9 + 3 - 15 - trunc(3^2/2) = 19%.
    expect(playerRangedHitChance(BUILD, COEFFICIENTS, MONSTER, 3)).toBe(0.19);
    // Spell: 7 + 17 - 2*3 - 2 = 16%.
    expect(playerSpellHitChance(BUILD, COEFFICIENTS, { ...MONSTER, level: 3 }, 2)).toBe(0.16);
    // Nightmare adjusts level 3 to 18: 7 + 17 - 36 - 2 clamps to 5%.
    expect(playerSpellHitChance(BUILD, COEFFICIENTS, { ...MONSTER, level: 3, difficulty: 'nightmare' }, 2)).toBe(0.05);
    expect(playerRangedHitChance(BUILD, COEFFICIENTS, { ...MONSTER, immune: { fire: true } }, 3, 'fire')).toBe(0);
  });

  it('computes monster melee and both ranged branches', () => {
    // Armour = 8 + trunc(11/5) = 10; melee = 20 + 2*(8-10) + 30 - 10 = 36%.
    expect(monsterMeleeHitChance(BUILD, MONSTER, 1)).toBe(0.36);
    // Arrow at distance 3: 20 + 2*(8-10) + 30 - 6 - 10 = 30%.
    expect(monsterRangedHitChance(BUILD, MONSTER, { distance: 3, dungeonLevel: 1, projectile: 'arrow' })).toBe(0.3);
    // Magic at distance 5: 40 + 16 - 20 - 10 = 26%.
    expect(monsterRangedHitChance(BUILD, MONSTER, { distance: 5, dungeonLevel: 1, projectile: 'magic' })).toBe(0.26);
    // Source-less arrow: 100 - trunc(10/2) - 2*3 = 89%; source-less magic remains 40%.
    expect(monsterRangedHitChance(BUILD, MONSTER, { distance: 3, dungeonLevel: 1, projectile: 'arrow', monsterSource: false })).toBe(0.89);
    expect(monsterRangedHitChance(BUILD, MONSTER, { distance: 99, dungeonLevel: 1, projectile: 'magic', monsterSource: false })).toBe(0.4);
    // Magma adds 10 to ordinary 36%; Storm subtracts 20, leaving 16% above the 15% floor.
    expect(monsterMeleeHitChance(BUILD, MONSTER, 1, 'magma')).toBe(0.46);
    expect(monsterMeleeHitChance(BUILD, MONSTER, 1, 'storm')).toBe(0.16);
    // A threshold over 100 has no engine upper clamp but succeeds for every 0..99 roll.
    expect(monsterMeleeHitChance(BUILD, { ...MONSTER, difficulty: 'hell' }, 1)).toBe(1);
  });
});

describe('Diablo I damage distributions', () => {
  it('applies monster HP mode and difficulty scaling in engine order', () => {
    const base = { min: 1, max: 5 };
    // Multiplayer keeps 1..5. Single-player halves to .5..2.5 fixed-point HP, then floors only .5 to 1.
    expect(monsterHitPoints(base, 'normal', 'multi')).toMatchObject({ min: 1, max: 5 });
    expect(monsterHitPoints(base, 'normal', 'single')).toMatchObject({ min: 1, max: 2.5 });
    // Nightmare is 3x then +100: SP 103..107.5, MP 103..115.
    expect(monsterHitPoints(base, 'nightmare', 'single')).toMatchObject({ min: 103, max: 107.5 });
    expect(monsterHitPoints(base, 'nightmare', 'multi')).toMatchObject({ min: 103, max: 115 });
    // Hell is 4x then +200: SP 204..210, MP 204..220.
    expect(monsterHitPoints(base, 'hell', 'single')).toMatchObject({ min: 204, max: 210 });
    expect(monsterHitPoints(base, 'hell', 'multi')).toMatchObject({ min: 204, max: 220 });
  });

  it('carries merged monster HP weights across equivalent copied bounds', () => {
    const copied = { ...monsterHitPoints({ min: 1, max: 3 }, 'normal', 'single') };
    expect(monsterHitPointDistribution(copied, 'normal', 'single')).toEqual([
      { hitPoints: 64, weight: 2 },
      { hitPoints: 96, weight: 1 },
    ]);
  });

  it('gates the data-driven critical and applies triple demon damage', () => {
    const triple = { ...BUILD, tripleDemonDamage: true };
    // Class damage = trunc(10*21/100)=2. Rolls become 5,6,8; a 10% crit doubles them,
    // then demon damage triples: min 5*3*64, max 8*2*3*64, mean ((5+6+8)/3)*1.1*3*64.
    const damage = playerMeleeDamage(triple, COEFFICIENTS, MONSTER);
    expect(damage.min).toBe(960);
    expect(damage.max).toBe(3072);
    expect(damage.mean).toBeCloseTo(1337.6);
    expect(damage.expectedNumerator / damage.expectedDenominator).toBe(damage.mean);
    // Without the class flag, the same Warrior has no critical: (5+6+8)/3*3*64 = 1216.
    expect(playerMeleeDamage(triple, { ...COEFFICIENTS, classFlags: [] }, MONSTER).mean).toBe(1216);
  });

  it('uses the non-Rogue half modifier for arrows and truncates negative division toward zero', () => {
    // Warrior class damage is 2, half is 1. Rolls become 4,5,7, so mean = 16/3*64.
    expect(playerRangedDamage(BUILD, MONSTER).mean).toBeCloseTo((16 / 3) * FIXED_POINT);
    // For roll 3 at -50%, trunc(-150/100) is -1 (not floor -2): 3-1 = 2 points.
    const edge = { ...BUILD, level: 0, strength: 0, weaponDamage: { min: 3, max: 3 }, damageBonusPercent: -50, flatDamage: 0 };
    expect(playerRangedDamage(edge, MONSTER)).toMatchObject({ min: 128, max: 128, mean: 128 });
  });

  it('transforms monster bounds and preserves the fixed-point inclusive roll', () => {
    // Normal 2..3 becomes fixed 128..192 inclusive: 65 equiprobable units, mean 160.
    const normal = monsterDamageByDifficulty(MONSTER);
    expect(normal.bounds).toEqual({ min: 2, max: 3 });
    expect(normal.damage).toMatchObject({ min: 128, max: 192, mean: 160, expectedDenominator: 65 });
    // Nightmare: 2*(2+2)..2*(3+2)=8..10. Hell: 4*2+6..4*3+6=14..18.
    expect(monsterDamageByDifficulty({ ...MONSTER, difficulty: 'nightmare' }).bounds).toEqual({ min: 8, max: 10 });
    expect(monsterDamageByDifficulty({ ...MONSTER, difficulty: 'hell' }).bounds).toEqual({ min: 14, max: 18 });
    expect(monsterDamageByDifficulty(MONSTER, { family: 'magma' }).bounds).toEqual({ min: 0, max: 1 });
    expect(monsterDamageByDifficulty(MONSTER, { family: 'storm' }).bounds).toEqual({ min: 6, max: 7 });
    // Ordinary collision shifts both bounds first and rolls every internal integer from 128 through 192.
    expect(monsterDamageByDifficulty(MONSTER, { attack: 'projectile' }).damage)
      .toMatchObject({ min: 128, max: 192, mean: 160, expectedDenominator: 65 });
    // A synthetic special 1..2 range transforms on Nightmare to 6..8 before its projectile roll.
    expect(monsterDamageByDifficulty({ ...MONSTER, difficulty: 'nightmare' }, { baseBounds: { min: 1, max: 2 }, attack: 'projectile' }).bounds)
      .toEqual({ min: 6, max: 8 });
    // A -3 point damage-taken modifier sends every 2..3 point roll to the one-point floor.
    expect(monsterDamageByDifficulty(MONSTER, -3).damage).toMatchObject({ min: 64, max: 64, mean: 64 });
  });

  it('applies monster resistance by shift and immunity before damage', () => {
    // Resistant positive damage uses 258 >> 2 = 64; immunity yields no hit/damage.
    expect(monsterResistance({ ...MONSTER, resist: { fire: true } }, 258, 'fire')).toEqual({ immune: false, resistant: true, damage: 64 });
    expect(monsterResistance({ ...MONSTER, immune: { fire: true }, resist: { fire: true } }, 258, 'fire')).toEqual({ immune: true, resistant: false, damage: 0 });
  });
});

describe('Diablo I defence, recovery and pools', () => {
  it('models the pre-hit block roll and both block clamps', () => {
    // Block = 11+7+2*10-2*8 = 22%; at 36% hit: miss .64, block .36*.22=.0792, damage .2808.
    const outcome = blockProbability(BUILD, COEFFICIENTS, MONSTER, 0.36, { kind: 'melee' });
    expect(outcome).toMatchObject({ rollConsumed: true, conditionalBlockChance: 0.22, attackMissChance: 0.64 });
    expect(outcome.blockedChance).toBeCloseTo(0.0792);
    expect(outcome.damagingHitChance).toBeCloseTo(0.2808);
    // Even a miss consumes the eligible block roll.
    expect(blockProbability(BUILD, COEFFICIENTS, MONSTER, 0, { kind: 'melee' }).rollConsumed).toBe(true);
    expect(blockProbability({ ...BUILD, dexterity: 0, level: 1 }, { ...COEFFICIENTS, blockBonus: -100 }, 50, 1, { kind: 'melee' }).conditionalBlockChance).toBe(0);
    expect(blockProbability({ ...BUILD, dexterity: 100 }, { ...COEFFICIENTS, blockBonus: 100 }, 1, 1, { kind: 'melee' }).conditionalBlockChance).toBe(1);
    expect(blockProbability(BUILD, COEFFICIENTS, MONSTER, 1, { kind: 'missile', resistance: 1 }).conditionalBlockChance).toBe(0);
  });

  it('clamps player resistance and applies integer percentage reduction', () => {
    const build = { ...BUILD, resistances: { magic: -5, fire: 100, lightning: 25 } };
    // Clamps are magic 0, fire 75, lightning 25; 101 - trunc(101*75/100) = 26.
    expect(playerResistance(build, 101, 'fire')).toEqual({ values: { magic: 0, fire: 75, lightning: 25 }, resistance: 75, damage: 26 });
    // Zero Resistance runs after all totals and resets them.
    expect(playerResistance({ ...build, zeroResistance: true }, 101, 'fire').damage).toBe(101);
  });

  it('computes player and monster recovery thresholds', () => {
    // 10 points reaches player level 10 but not monster level 8 + 3; Faster skips 2 frames.
    const recovery = hitRecovery(BUILD, MONSTER, 10 * FIXED_POINT, { recovery: 'faster' });
    expect(recovery).toEqual({ player: { starts: true, skippedFrames: 2 }, monster: { hardHit: false, playsHitSound: true, startsAnimation: false } });
    // Sneak-family damage always hard-hits, but petrification suppresses only the animation.
    expect(hitRecovery(BUILD, { ...MONSTER, petrified: true }, FIXED_POINT, { monsterFamily: 'sneak' }).monster)
      .toEqual({ hardHit: true, playsHitSound: true, startsAnimation: false });
    // A resistant missile bypasses the start-hit routine even when 11 points meets 8+3.
    expect(hitRecovery(BUILD, MONSTER, 11 * FIXED_POINT, { resistantMissile: true }).monster.startsAnimation).toBe(false);
  });

  it('derives fixed-point pools, item-stat truncation, clamps and level-up refill', () => {
    // Life base = 320+128*10+96*9=2464. Items = trunc(3*96/64)*64+32=288; max=2752.
    // Mana base = 192+64*10+32*7=1056. Items = trunc(3*32/64)*64+16=80; max=1136.
    const pools = lifeAndMana(BUILD, COEFFICIENTS, { bonusVitality: 3, bonusMagic: 3, flatItemLife: 32, flatItemMana: 16, noMana: true });
    expect(pools).toMatchObject({ baseLife: 2464, baseMana: 1056, maximumLife: 2752, maximumMana: 1136, currentLife: 2752, currentMana: 1136 });
    // Level-up adds 128 life and 64 mana; No Mana leaves current mana at 1136.
    expect(pools.afterLevelUp).toMatchObject({ maximumLife: 2880, maximumMana: 1200, currentLife: 2880, currentMana: 1136 });
    // Signed fixed-point shift: (-1*96) >> 6 = -2, not trunc(-96/64) = -1; contribution is -128.
    expect(lifeAndMana(BUILD, COEFFICIENTS, { bonusVitality: -1 }).maximumLife).toBe(2336);
    const low = { ...COEFFICIENTS, lifeAdjustment: -9999, lifePerLevel: 0, lifePerBaseVitality: 0, manaAdjustment: -9999, manaPerLevel: 0, manaPerBaseMagic: 0 };
    expect(lifeAndMana(BUILD, low)).toMatchObject({ maximumLife: 64, maximumMana: 0 });
    expect(lifeAndMana(BUILD, COEFFICIENTS, { flatItemLife: 999999, flatItemMana: 999999 })).toMatchObject({ maximumLife: 128000, maximumMana: 128000 });
    expect(lifeAndMana(BUILD, COEFFICIENTS, { flatItemLife: 999999, flatItemMana: 999999 }).afterLevelUp)
      .toMatchObject({ maximumLife: 128000, maximumMana: 128000, currentLife: 128000, currentMana: 128000 });
  });
});

describe('Diablo I experience laws', () => {
  it('builds the sparse curve with the engine sentinel and lookup semantics', () => {
    // Level 3 resizes [level 1, gap, level 3]; the gap is UINT32_MAX and MaxLevel is skipped.
    const curve = experienceCurveLaw([{ level: 1, experience: 100 }, { level: 3, experience: 600 }, { level: 'MaxLevel', experience: 7 }]);
    expect(curve.thresholds).toEqual([100, 2 ** 32 - 1, 600]);
    expect(curve.maxLevel).toBe(3);
    expect(curve.threshold(0)).toBe(0);
    // Exact out-of-range engine indexing selects index maxLevel, one past this vector.
    expect(curve.threshold(4)).toBeUndefined();
  });

  it('transforms, shares, scales and multiplayer-caps an award', () => {
    const curve = experienceCurveLaw([{ level: 1, experience: 100 }, { level: 2, experience: 1000 }, { level: 3, experience: 100000 }]);
    // Nightmare unique: 2*(10+1000)*2=4040; two contributors => 2020. Adjusted monster
    // level 1+15 versus player 1 scales by 2.5 => 5050, then multiplayer min(5050,100/20,200)=5.
    expect(experienceAward({ baseExperience: 10, difficulty: 'nightmare', unique: true, whoHitMask: 0b11, localPlayerBit: 0b01, playerLevel: 1, monsterLevel: 1, multiplayer: true, totalExperience: 90, curve }))
      .toEqual({ difficultyAward: 4040, contributors: 2, share: 2020, scaled: 5, granted: 5, totalExperience: 95, level: 1 });
    // Normal 200/3 truncates to 66; delta +2 makes trunc(79.2)=79 and total 329 crosses level-2's 300 threshold.
    const leveling = experienceCurveLaw([{ level: 1, experience: 100 }, { level: 2, experience: 300 }, { level: 3, experience: 600 }]);
    expect(experienceAward({ baseExperience: 100, difficulty: 'normal', unique: true, whoHitMask: 0b111, localPlayerBit: 1, playerLevel: 2, monsterLevel: 4, totalExperience: 250, curve: leveling }))
      .toMatchObject({ share: 66, scaled: 79, granted: 79, totalExperience: 329, level: 3 });
  });
});

describe('duel and canon contract', () => {
  it('computes exact hits from fixed-point HP and damage distributions', () => {
    expect(expectedHitsToKill([{ hitPoints: 10, weight: 1 }], [{ damage: 10, weight: 1 }])).toBe(1);
    // E(1)=1, E(2)=1.5, and E(3)=1+(E(2)+E(1))/2=2.25.
    expect(expectedHitsToKill([{ hitPoints: 3, weight: 1 }], [
      { damage: 1, weight: 1 },
      { damage: 2, weight: 1 },
    ])).toBe(2.25);
    // Immunity is a zero-damage distribution, so its tail probability never converges to zero.
    expect(expectedHitsToKill([{ hitPoints: 10, weight: 1 }], [{ damage: 0, weight: 1 }])).toBe(Infinity);
    expect(expectedHitsToKill([{ hitPoints: 100001, weight: 1 }], [{ damage: 1, weight: 1 }])).toBe(100001);
    expect(expectedHitsToKill([{ hitPoints: 100001, weight: 1 }], [{ damage: 1, weight: 1 }], 100000))
      .toEqual({ kind: 'capped', maxHits: 100000, exactExpectedHits: 100001 });
  });

  it('uses ordinary projectile fractional support in exact kill expectations', () => {
    const projectile = monsterDamageByDifficulty({ ...MONSTER, damage: { min: 1, max: 2 } }, { attack: 'projectile' });
    expect(expectedHitsToKill([{ hitPoints: 128, weight: 1 }], projectile.damage.outcomes)).toBeCloseTo(129 / 65, 12);
  });

  it('composes the laws end to end', () => {
    const build = { ...BUILD, tripleDemonDamage: true };
    // Player: hit .21; the exact damage/HP convolution needs 2.201587... landed hits on average.
    // Monster: hit .36; mean damage 160; block .22 => 124.8 per hit and 44.928 per swing.
    // The exact player-life convolution includes block as a zero-damage landed hit.
    const result = duel(build, COEFFICIENTS, MONSTER, { playerAttack: 'melee', monsterAttack: 'melee', dungeonLevel: 1 });
    expect(result.gameMode).toBe('single');
    expect(duel(build, COEFFICIENTS, MONSTER, { gameMode: 'multi', playerAttack: 'melee', monsterAttack: 'melee', dungeonLevel: 1 }).gameMode).toBe('multi');
    expect(result.playerHitChance).toBe(0.21);
    expect(result.expectedPlayerDamagePerSwing).toBeCloseTo(280.896);
    expect(result.expectedPlayerHitsToKill).toBeCloseTo(2.2015873015873018);
    expect(result.expectedPlayerSwingsToKill).toBeCloseTo(2.2015873015873018 / 0.21);
    expect(result.playerSwingSeconds).toBeNull();
    expect(result.monsterHitChance).toBe(0.36);
    expect(result.expectedMonsterDamagePerHit).toBeCloseTo(124.8);
    expect(result.expectedMonsterHitsToKillPlayer).toBeCloseTo(20.393757917755167);
    expect(result.expectedMonsterDamagePerSwing).toBeCloseTo(44.928);
    const timed = duel({ ...build, swingSeconds: 0.6 }, COEFFICIENTS, MONSTER, { playerAttack: 'melee', monsterAttack: 'melee', dungeonLevel: 1 });
    // Time to kill = expected swings * the invented 0.6-second class swing.
    expect(timed.expectedPlayerSecondsToKill).toBeCloseTo((2.2015873015873018 / 0.21) * 0.6);
  });

  it('reports the law-derived PM_GOTHIT interruption rate when recovery timing is supplied', () => {
    const result = duel({
      ...BUILD,
      level: 2,
      hasShield: false,
      blockEnabled: false,
      swingSeconds: 0.5,
    }, COEFFICIENTS, MONSTER, {
      playerAttack: 'melee',
      monsterAttack: 'melee',
      dungeonLevel: 1,
      playerHitRecoverySeconds: 0.4,
    });

    // Every 2..3 point damaging hit reaches hero level 2; without a shield, chance equals to-hit.
    expect(result.gotHit).toMatchObject({
      chancePerMonsterAttack: result.monsterHitChance,
      recoverySeconds: 0.4,
    });
    expect(result.gotHit!.expectedInterruptionsBeforeKill).toBeCloseTo(
      result.expectedMonsterAttacksBeforeKill * result.monsterHitChance,
      12,
    );
    expect(result.gotHit!.interruptionsPerSecond).toBeCloseTo(
      result.gotHit!.expectedInterruptionsBeforeKill / result.expectedPlayerSecondsToKill!,
      12,
    );
  });

  it('applies the supplied monster element and independent projectile count', () => {
    const build = {
      ...BUILD,
      hasShield: false,
      blockEnabled: false,
      resistances: { magic: 0, fire: 50, lightning: 0 },
    };
    const monsterDamage = {
      min: 10 * 64,
      max: 10 * 64,
      mean: 10 * 64,
      expectedNumerator: 10 * 64,
      expectedDenominator: 1,
      outcomes: [{ damage: 10 * 64, weight: 1 }],
    };
    const common = {
      playerAttack: 'melee' as const,
      monsterAttack: 'ranged-magic' as const,
      monsterDamage,
      dungeonLevel: 1,
    };
    const physical = duel(build, COEFFICIENTS, MONSTER, { ...common, monsterElement: 'physical' });
    const fire = duel(build, COEFFICIENTS, MONSTER, { ...common, monsterElement: 'fire' });
    const three = duel(build, COEFFICIENTS, MONSTER, {
      ...common,
      monsterElement: 'fire',
      monsterProjectilesPerAttack: 3,
    });

    expect(fire.monsterElement).toBe('fire');
    expect(fire.expectedMonsterDamagePerHit).toBe(physical.expectedMonsterDamagePerHit / 2);
    expect(three.monsterProjectilesPerAttack).toBe(3);
    expect(three.expectedMonsterDamagePerSwing).toBe(fire.expectedMonsterDamagePerSwing * 3);
  });

  it('multiplies stationary persistent checks by an independent per-check to-hit roll', () => {
    const build = { ...BUILD, hasShield: false, blockEnabled: false };
    const impact = {
      min: 10 * 64,
      max: 10 * 64,
      mean: 10 * 64,
      expectedNumerator: 10 * 64,
      expectedDenominator: 1,
      outcomes: [{ damage: 10 * 64, weight: 1 }],
    };
    const puddle = {
      min: 64,
      max: 64,
      mean: 64,
      expectedNumerator: 64,
      expectedDenominator: 1,
      outcomes: [{ damage: 64, weight: 1 }],
    };
    const common = {
      playerAttack: 'melee' as const,
      monsterAttack: 'ranged-magic' as const,
      monsterElement: 'acid' as const,
      monsterDamage: impact,
      monsterDistance: 4,
      dungeonLevel: 1,
    };
    const primary = duel(build, COEFFICIENTS, MONSTER, common);
    const persistent = duel(build, COEFFICIENTS, MONSTER, {
      ...common,
      monsterDamage: puddle,
      monsterDistance: 0,
      monsterHitChecksPerAttack: 5,
      monsterDamageAlreadyShifted: true,
    });
    const compound = duel(build, COEFFICIENTS, MONSTER, {
      ...common,
      monsterDamageEvents: [
        { damage: impact, expectedHitChecks: 1 },
        { damage: puddle, expectedHitChecks: 5, alreadyShifted: true, missileDistance: 0 },
      ],
    });

    expect(compound.monsterHitChecksPerAttack).toBe(6);
    expect(compound.expectedMonsterDamagePerSwing).toBeCloseTo(
      primary.expectedMonsterDamagePerSwing + persistent.expectedMonsterDamagePerSwing,
      12,
    );
  });

  it('never reports fewer than one swing for a one-hit-kill damage distribution', () => {
    const oneShot = duel({ ...BUILD, weaponDamage: { min: 100, max: 100 } }, { ...COEFFICIENTS, classFlags: [] }, {
      ...MONSTER,
      hitPoints: monsterHitPoints({ min: 1, max: 2 }, 'normal', 'single'),
    }, { playerAttack: 'melee', monsterAttack: 'melee', dungeonLevel: 1 });
    expect(oneShot.expectedPlayerHitsToKill).toBe(1);
    expect(oneShot.expectedPlayerSwingsToKill).toBe(1 / oneShot.playerHitChance);
    expect(oneShot.expectedPlayerSwingsToKill).toBeGreaterThanOrEqual(1);
  });

  it('reports an unhittable target and its time-to-kill as unbounded', () => {
    const result = duel({ ...BUILD, swingSeconds: 0.6 }, COEFFICIENTS, { ...MONSTER, possibleToHit: false }, {
      playerAttack: 'melee', monsterAttack: 'melee', dungeonLevel: 1,
    });
    expect(result.expectedPlayerSwingsToKill).toBe(Infinity);
    expect(result.expectedPlayerSecondsToKill).toBe(Infinity);
  });

  it('computes a ranged bow duel at the documented fixed engagement distance', () => {
    const build: PlayerBuild = {
      ...BUILD,
      class: 'Rogue',
      level: 1,
      strength: 0,
      dexterity: 0,
      weaponDamage: { min: 1, max: 1 },
      weaponType: 'bow',
      toHitBonusPercent: 0,
      armourPiercing: 0,
      damageBonusPercent: 0,
      flatDamage: 0,
      swingSeconds: 0.5,
    };
    const monster: MonsterProfile = {
      ...MONSTER,
      level: 1,
      hitPoints: { min: 1, max: 1 },
      armourClass: 0,
      resist: {},
      immune: {},
    };
    const result = duel(build, { ...COEFFICIENTS, classFlags: [], baseRangedToHit: 95 }, monster, {
      playerAttack: 'ranged',
      monsterAttack: 'melee',
      dungeonLevel: 1,
    });

    // 1 level + 95 class to-hit - trunc(4^2/2) = 88%; one landed 1-HP arrow kills.
    expect(result.attackMode).toBe('ranged');
    expect(result.engagementDistance).toBe(DEFAULT_RANGED_ENGAGEMENT_DISTANCE);
    expect(result.playerHitChance).toBe(0.88);
    expect(result.expectedPlayerHitsToKill).toBe(1);
    expect(result.expectedPlayerSwingsToKill).toBeCloseTo(1 / 0.88, 12);
    expect(result.expectedPlayerSecondsToKill).toBeCloseTo(0.5 / 0.88, 12);
  });

  it('hand-computes free shots while a melee monster approaches', () => {
    const result = duel({
      ...BUILD,
      class: 'Rogue',
      level: 1,
      strength: 0,
      dexterity: 0,
      weaponDamage: { min: 1, max: 1 },
      weaponType: 'bow',
      damageBonusPercent: 0,
      flatDamage: 0,
      swingSeconds: 0.5,
    }, { ...COEFFICIENTS, classFlags: [] }, {
      ...MONSTER,
      level: 1,
      hitPoints: { min: 6, max: 6 },
      armourClass: 0,
      resist: {},
      immune: {},
      petrified: true,
    }, {
      playerAttack: 'ranged',
      engagementDistance: 5,
      monsterApproachTilesPerSecond: 3,
      monsterAttack: 'melee',
      dungeonLevel: 1,
    });

    // Four tiles to adjacency at 3 tiles/s is 4/3 seconds: two complete 0.5s shots are free.
    expect(result.approach).toMatchObject({
      distanceToAdjacency: 4,
      seconds: 4 / 3,
      freePlayerActionCapacity: 2,
      expectedFreePlayerActions: 2,
    });
    expect(result.expectedPlayerSwingsToKill).toBe(6);
    expect(result.expectedMonsterAttacksBeforeKill).toBe(3);
    expect(result.expectedPlayerSecondsToKill).toBeCloseTo(4 / 3 + 4 * 0.5, 12);
  });

  it('computes spell casts, exact mana per kill, and an immune target as unbounded', () => {
    const build: PlayerBuild = {
      ...BUILD,
      class: 'Sorcerer',
      level: 1,
      magic: 0,
      hasShield: false,
      blockEnabled: false,
    };
    const coefficients = { ...COEFFICIENTS, classFlags: [], baseMagicToHit: 97 };
    const monster: MonsterProfile = {
      ...MONSTER,
      level: 1,
      hitPoints: { min: 1, max: 1 },
      armourClass: 0,
      resist: {},
      immune: {},
    };
    const options = {
      playerAttack: 'spell' as const,
      spell: { spell: 'Firebolt', spellLevel: 1, baseMana: 6, manaAdj: 1, minMana: 3 },
      playerCastSeconds: 0.4,
      monsterAttack: 'melee' as const,
      dungeonLevel: 1,
    };
    const result = duel(build, coefficients, monster, options);

    // 0 Magic + 97 class to-hit - 2*level 1 - distance 4 = 91%; Firebolt always kills 1 HP.
    expect(result.attackMode).toBe('spell');
    expect(result.playerHitChance).toBe(0.95); // spell missiles: effective distance 0 (d1-spell-cast-law) — no range penalty
    expect(result.expectedPlayerHitsToKill).toBe(1);
    expect(result.expectedPlayerSwingsToKill).toBeCloseTo(1 / 0.95, 12);
    expect(result.playerCastSeconds).toBe(0.4);
    expect(result.expectedPlayerSecondsToKill).toBeCloseTo(0.4 / 0.95, 12);
    expect(result.manaPerCast).toBe(6);
    expect(result.expectedManaSpentPerKill).toBeCloseTo(6 / 0.95, 12);

    const resistant = duel(build, coefficients, { ...monster, resist: { fire: true } }, options);
    expect(resistant.expectedPlayerDamagePerSwing).toBeCloseTo(0.95 * 104, 12); // Mean 6.5 HP / 4 * 64.

    const immune = duel(build, coefficients, { ...monster, immune: { fire: true } }, options);
    expect(immune.playerHitChance).toBe(0);
    expect(immune.expectedPlayerHitsToKill).toBe(Infinity);
    expect(immune.expectedPlayerSwingsToKill).toBe(Infinity);
    expect(immune.expectedManaSpentPerKill).toBe(Infinity);
  });

  it('ships every new bounded canon law', () => {
    const ids = [
      'd1-combat-melee-to-hit-law', 'd1-combat-ranged-to-hit-law', 'd1-combat-monster-melee-to-hit-law',
      'd1-combat-monster-ranged-to-hit-law', 'd1-combat-player-melee-damage-law', 'd1-combat-player-ranged-damage-law',
      'd1-combat-monster-damage-law', 'd1-combat-monster-hp-law', 'd1-combat-monster-armour-law', 'd1-combat-block-law', 'd1-combat-player-resistance-law',
      'd1-combat-hit-recovery-law', 'd1-combat-life-mana-law', 'd1-xp-award-law', 'd1-xp-curve-law',
      'd1-hero-attack-timing-law', 'd1-hero-casting-timing-law', 'd1-hero-block-timing-law',
      'd1-class-skills-law', 'd1-hero-speech-trigger-law',
    ];
    for (const id of ids) {
      const law = DIABLO1_CANON.find((rule) => rule.id === id);
      expect(law, id).toBeDefined();
      expect(law!.body.length, id).toBeLessThanOrEqual(450);
    }
  });
});
