import { BUILD_PRESETS, PLAYER_POWER, ENEMY_DIFFICULTY } from '../progression-data';
import type { EnemyType, EncounterResult } from './types';

export function computeEncounter(
  playerLevel: number,
  build: typeof BUILD_PRESETS[number],
  enemy: EnemyType,
  healthyRange: { min: number; max: number },
): EncounterResult {
  const levelIdx = Math.min(Math.floor(playerLevel / 5), PLAYER_POWER.length - 1);
  const levelFrac = (playerLevel % 5) / 5;
  const nextIdx = Math.min(levelIdx + 1, PLAYER_POWER.length - 1);

  const playerPower = PLAYER_POWER[levelIdx] + (PLAYER_POWER[nextIdx] - PLAYER_POWER[levelIdx]) * levelFrac;
  const enemyBase = ENEMY_DIFFICULTY[levelIdx] + (ENEMY_DIFFICULTY[nextIdx] - ENEMY_DIFFICULTY[levelIdx]) * levelFrac;

  const strScale = build.stats.Strength / 50;
  const vitScale = build.stats.Vitality / 50;
  const dexScale = 1 + (build.stats.Dexterity - 50) / 200;

  const basePlayerHP = 100 + playerLevel * 20;
  const playerEffectiveHP = basePlayerHP * vitScale;
  const basePlayerDamage = 10 + playerPower * 0.3;
  const playerDamagePerHit = basePlayerDamage * strScale;
  const attacksPerSecond = 1.2 * dexScale;
  const playerDPS = playerDamagePerHit * attacksPerSecond;

  const enemyHP = enemyBase * enemy.hpMultiplier * 3;
  const enemyDamagePerHit = (enemyBase * 0.15) * enemy.dpsMultiplier;
  const enemyAttacksPerSecond = 0.8;
  const enemyDPS = enemyDamagePerHit * enemyAttacksPerSecond;

  const playerArmor = build.stats.Endurance * 0.5 + playerLevel * 0.3;
  const enemyArmor = enemyBase * 0.1 * enemy.armorMultiplier;
  const playerDR = playerArmor / (playerArmor + 100);
  const enemyDR = enemyArmor / (enemyArmor + 100);

  const effectivePlayerDPS = playerDPS * (1 - enemyDR);
  const effectiveEnemyDPS = enemyDPS * (1 - playerDR);

  const playerTTK = effectivePlayerDPS > 0 ? enemyHP / effectivePlayerDPS : Infinity;
  const enemyTTK = effectiveEnemyDPS > 0 ? playerEffectiveHP / effectiveEnemyDPS : Infinity;
  const ttkRatio = playerTTK > 0 ? enemyTTK / playerTTK : Infinity;

  const hitsToKillEnemy = Math.ceil(enemyHP / Math.max(playerDamagePerHit * (1 - enemyDR), 1));
  const hitsToKillPlayer = Math.ceil(playerEffectiveHP / Math.max(enemyDamagePerHit * (1 - playerDR), 1));

  let balanceVerdict: EncounterResult['balanceVerdict'];
  if (ttkRatio > healthyRange.max * 1.5) balanceVerdict = 'trivial';
  else if (ttkRatio > healthyRange.max) balanceVerdict = 'easy';
  else if (ttkRatio >= healthyRange.min) balanceVerdict = 'balanced';
  else if (ttkRatio >= 1.0) balanceVerdict = 'hard';
  else balanceVerdict = 'lethal';

  return {
    playerDPS: effectivePlayerDPS,
    playerEffectiveHP,
    enemyHP,
    enemyDPS: effectiveEnemyDPS,
    playerTTK,
    enemyTTK,
    ttkRatio,
    hitsToKillEnemy,
    hitsToKillPlayer,
    balanceVerdict,
  };
}
