export interface EnemyType {
  name: string;
  hpMultiplier: number;
  dpsMultiplier: number;
  armorMultiplier: number;
  icon: string;
  color: string;
}

export interface EncounterResult {
  playerDPS: number;
  playerEffectiveHP: number;
  enemyHP: number;
  enemyDPS: number;
  playerTTK: number;
  enemyTTK: number;
  ttkRatio: number;
  hitsToKillEnemy: number;
  hitsToKillPlayer: number;
  balanceVerdict: 'trivial' | 'easy' | 'balanced' | 'hard' | 'lethal';
}
