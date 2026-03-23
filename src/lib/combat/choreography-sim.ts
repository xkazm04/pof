import type { TuningOverrides, AttributeSet, BalanceAlertSeverity } from '@/types/combat-simulator';
import {
  ENEMY_ARCHETYPES,
  PLAYER_ABILITIES,
  BASE_PLAYER_ATTRIBUTES,
  PLAYER_LEVEL_SCALING,
} from './definitions';
import { calculateDamage, createRNG } from './simulation-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlacedEnemy {
  id: string;
  archetypeId: string;
  gridX: number;
  gridY: number;
  waveIndex: number;
  level: number;
}

export interface WaveDef {
  spawnTimeSec: number;
  label: string;
}

export interface DamageEvent {
  timeSec: number;
  source: string;
  target: string;
  abilityName: string;
  damage: number;
  isCrit: boolean;
  element: 'Physical' | 'Fire' | 'Ice' | 'Lightning';
}

export interface FeedbackEvent {
  timeSec: number;
  type: 'hitstop' | 'shake' | 'vfx' | 'sfx';
  durationSec: number;
  label: string;
  color: string;
}

export interface ChoreographyAlert {
  severity: BalanceAlertSeverity;
  message: string;
  timeSec?: number;
}

export interface ChoreographySimResult {
  damageEvents: DamageEvent[];
  feedbackEvents: FeedbackEvent[];
  alerts: ChoreographyAlert[];
  totalDurationSec: number;
}

// ── Feedback channel color mapping (caller provides) ────────────────────

export interface FeedbackChannelColors {
  hitstop: string;
  shake: string;
  vfx: string;
  sfx: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildLevelScaledPlayerAttrs(playerLevel: number): AttributeSet {
  const attrs = { ...BASE_PLAYER_ATTRIBUTES };
  for (const [key, perLevel] of Object.entries(PLAYER_LEVEL_SCALING) as [keyof AttributeSet, number][]) {
    attrs[key] += perLevel * (playerLevel - 1);
  }
  return attrs;
}

// ── Simulation (simplified single-pass for timeline preview) ───────────

export function simulateEncounter(
  enemies: PlacedEnemy[],
  waves: WaveDef[],
  tuning: TuningOverrides,
  playerLevel: number,
  feedbackColors: FeedbackChannelColors,
): ChoreographySimResult {
  const damageEvents: DamageEvent[] = [];
  const feedbackEvents: FeedbackEvent[] = [];
  const rng = createRNG(42);

  // Player stats (level-scaled)
  const playerAttrs = buildLevelScaledPlayerAttrs(playerLevel);
  const playerMaxHP = playerAttrs.maxHealth;
  let playerHP = Math.round(playerMaxHP * tuning.playerHealthMul);

  // Build enemy instances per wave
  const enemyInstances = enemies.map((e) => {
    const arch = ENEMY_ARCHETYPES.find((a) => a.id === e.archetypeId)!;
    const hp = Math.round(
      (arch.baseAttributes.maxHealth + (arch.levelScaling.maxHealth ?? 0) * (e.level - 1)) * tuning.enemyHealthMul,
    );
    const enemyAttrs: AttributeSet = {
      ...arch.baseAttributes,
      health: hp,
      maxHealth: hp,
    };
    // Apply level scaling to enemy attributes
    for (const [key, perLevel] of Object.entries(arch.levelScaling) as [keyof AttributeSet, number][]) {
      if (key !== 'health' && key !== 'maxHealth') {
        enemyAttrs[key] += perLevel * (e.level - 1);
      }
    }
    return {
      ...e,
      arch,
      hp,
      maxHP: hp,
      attrs: enemyAttrs,
      nextAttack: (waves[e.waveIndex]?.spawnTimeSec ?? 0) + 0.5 + rng() * 1.5,
      alive: true,
    };
  });

  const abilities = PLAYER_ABILITIES.filter((a) => a.type !== 'buff' && a.type !== 'dodge');
  const elements: Array<'Physical' | 'Fire' | 'Ice' | 'Lightning'> = ['Physical', 'Fire', 'Ice', 'Lightning'];
  let totalDuration = 0;

  // Tick simulation at 0.2s resolution
  const maxTime = 60;
  let playerNextAction = 0;
  const abilityCooldowns: Record<string, number> = {};

  // Build a target AttributeSet for the player (used when enemies attack)
  const playerTargetAttrs: AttributeSet = {
    ...playerAttrs,
    health: playerHP,
    maxHealth: playerMaxHP,
    armor: Math.round(playerAttrs.armor * tuning.playerArmorMul),
  };

  for (let t = 0; t < maxTime; t += 0.2) {
    const activeEnemies = enemyInstances.filter(
      (e) => e.alive && (waves[e.waveIndex]?.spawnTimeSec ?? 0) <= t,
    );

    if (activeEnemies.length === 0 && t > 1) {
      const futureEnemies = enemyInstances.filter(
        (e) => e.alive && (waves[e.waveIndex]?.spawnTimeSec ?? 0) > t,
      );
      if (futureEnemies.length === 0) {
        totalDuration = t;
        break;
      }
      continue;
    }

    // Player attacks
    if (t >= playerNextAction && activeEnemies.length > 0) {
      const available = abilities.filter((a) => (abilityCooldowns[a.id] ?? 0) <= t);
      const ability = available.sort((a, b) => b.baseDamage - a.baseDamage)[0] ?? abilities[0];
      const target = activeEnemies[0];

      const { damage: dmg, isCrit } = calculateDamage(
        ability, playerAttrs, target.attrs, tuning, rng, true,
      );

      target.hp -= dmg;
      target.attrs.health = target.hp;
      if (target.hp <= 0) target.alive = false;

      const element = ability.id === 'ga-fireball' ? 'Fire' : elements[Math.floor(rng() * 2)];

      const timeSec = Math.round(t * 10) / 10;
      damageEvents.push({
        timeSec,
        source: 'Player',
        target: target.arch.name,
        abilityName: ability.name,
        damage: dmg,
        isCrit,
        element,
      });

      // Feedback events per hit
      feedbackEvents.push({
        timeSec,
        type: 'hitstop',
        durationSec: isCrit ? 0.08 : 0.05,
        label: `Hitstop ${isCrit ? '(crit)' : ''}`,
        color: feedbackColors.hitstop,
      });
      feedbackEvents.push({
        timeSec,
        type: 'shake',
        durationSec: isCrit ? 0.15 : 0.08,
        label: `Shake ${isCrit ? 'heavy' : 'light'}`,
        color: feedbackColors.shake,
      });
      feedbackEvents.push({
        timeSec,
        type: 'vfx',
        durationSec: 0.3,
        label: `HitVFX (${element})`,
        color: feedbackColors.vfx,
      });
      feedbackEvents.push({
        timeSec,
        type: 'sfx',
        durationSec: 0.2,
        label: `SFX (${element})`,
        color: feedbackColors.sfx,
      });

      if (ability.cooldownSec > 0) abilityCooldowns[ability.id] = t + ability.cooldownSec;
      playerNextAction = t + ability.castTimeSec + 0.1;
    }

    // Enemy attacks
    for (const enemy of activeEnemies) {
      if (t < enemy.nextAttack || !enemy.alive) continue;

      const ability = enemy.arch.abilities[0];

      const { damage: dmg } = calculateDamage(
        ability, enemy.attrs, playerTargetAttrs, tuning, rng, false,
      );

      playerHP -= dmg;

      damageEvents.push({
        timeSec: Math.round(t * 10) / 10,
        source: enemy.arch.name,
        target: 'Player',
        abilityName: ability.name,
        damage: dmg,
        isCrit: false,
        element: 'Physical',
      });

      enemy.nextAttack = t + enemy.arch.attackIntervalSec * (0.8 + rng() * 0.4);
    }

    if (playerHP <= 0) {
      totalDuration = t;
      break;
    }

    totalDuration = t;
  }

  // Generate alerts
  const alerts: ChoreographyAlert[] = [];
  const playerDied = playerHP <= 0;
  const totalPlayerDmgTaken = damageEvents.filter((e) => e.target === 'Player').reduce((s, e) => s + e.damage, 0);

  if (playerDied && totalDuration < 5) {
    alerts.push({ severity: 'critical', message: `Player dies in ${totalDuration.toFixed(1)}s — encounter is too punishing`, timeSec: totalDuration });
  } else if (playerDied) {
    alerts.push({ severity: 'warning', message: `Player dies at ${totalDuration.toFixed(1)}s — survival not guaranteed`, timeSec: totalDuration });
  }

  if (totalDuration > 45) {
    alerts.push({ severity: 'warning', message: 'Encounter lasts 45s+ — combat feels spongy', timeSec: 45 });
  }

  if (!playerDied && totalDuration < 3 && enemies.length > 0) {
    alerts.push({ severity: 'info', message: 'Encounter ends in <3s — trivially easy', timeSec: totalDuration });
  }

  const totalEnemyHP = enemyInstances.reduce((s, e) => s + e.maxHP, 0);
  if (totalEnemyHP > playerMaxHP * tuning.playerHealthMul * 5) {
    alerts.push({ severity: 'warning', message: `Combined enemy HP (${totalEnemyHP}) is 5x+ player HP — may feel tedious`, timeSec: 0 });
  }

  // Temporal alerts: detect DPS spikes and damage droughts
  const bucketSize = 2;
  const buckets = new Map<number, { playerDmg: number; enemyDmg: number }>();
  for (const evt of damageEvents) {
    const bucket = Math.floor(evt.timeSec / bucketSize) * bucketSize;
    const b = buckets.get(bucket) ?? { playerDmg: 0, enemyDmg: 0 };
    if (evt.source === 'Player') b.playerDmg += evt.damage;
    else b.enemyDmg += evt.damage;
    buckets.set(bucket, b);
  }
  for (const [t, b] of buckets) {
    if (b.enemyDmg > playerMaxHP * tuning.playerHealthMul * 0.4) {
      alerts.push({
        severity: 'critical',
        message: `Burst damage spike at ${t}s: ${b.enemyDmg} dmg in ${bucketSize}s (${(b.enemyDmg / (playerMaxHP * tuning.playerHealthMul) * 100).toFixed(0)}% of HP)`,
        timeSec: t,
      });
    }
    if (t > 0 && b.playerDmg === 0 && b.enemyDmg === 0) {
      alerts.push({ severity: 'info', message: `Dead zone at ${t}–${t + bucketSize}s: no combat activity`, timeSec: t });
    }
  }

  return { damageEvents, feedbackEvents, alerts, totalDurationSec: totalDuration };
}
