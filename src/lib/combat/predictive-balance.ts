/**
 * Predictive Balance Simulation Engine
 *
 * Client-side Monte Carlo engine that sweeps player levels × enemy compositions
 * to produce survival heatmaps, DPS breakdowns, and sensitivity analysis.
 * Uses the same combat formulas as simulation-engine.ts but optimized for
 * batch parameter sweeps.
 */

import type { AttributeSet, AttributeKey, CombatAbility, EnemyArchetype, TuningOverrides } from '@/types/combat-simulator';
import {
  BASE_PLAYER_ATTRIBUTES,
  PLAYER_LEVEL_SCALING,
  PLAYER_ABILITIES,
  ENEMY_ARCHETYPES,
  GEAR_LOADOUTS,
  DEFAULT_TUNING,
} from '@/lib/combat/definitions';

// ── RNG (XORShift32, same as simulation-engine) ────────────────────────────

function createRNG(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ── Attribute builders ─────────────────────────────────────────────────────

function buildPlayerAttrs(level: number, gearId: string, tuning: TuningOverrides): AttributeSet {
  const attrs = { ...BASE_PLAYER_ATTRIBUTES };
  for (const [key, perLevel] of Object.entries(PLAYER_LEVEL_SCALING)) {
    const k = key as AttributeKey;
    attrs[k] += (perLevel as number) * (level - 1);
  }
  const gear = GEAR_LOADOUTS.find(g => g.id === gearId);
  if (gear) {
    for (const [key, bonus] of Object.entries(gear.bonuses)) {
      attrs[key as AttributeKey] += bonus as number;
    }
  }
  attrs.health *= tuning.playerHealthMul;
  attrs.maxHealth *= tuning.playerHealthMul;
  attrs.attackPower *= tuning.playerDamageMul;
  attrs.armor *= tuning.playerArmorMul;
  return attrs;
}

function buildEnemyAttrs(archetype: EnemyArchetype, level: number, tuning: TuningOverrides): AttributeSet {
  const attrs = { ...archetype.baseAttributes };
  for (const [key, perLevel] of Object.entries(archetype.levelScaling)) {
    const k = key as AttributeKey;
    attrs[k] += (perLevel as number) * (level - 1);
  }
  attrs.health *= tuning.enemyHealthMul;
  attrs.maxHealth *= tuning.enemyHealthMul;
  attrs.attackPower *= tuning.enemyDamageMul;
  return attrs;
}

// ── Damage formula ─────────────────────────────────────────────────────────

function calcDamage(
  ability: CombatAbility,
  srcAttrs: AttributeSet,
  tgtAttrs: AttributeSet,
  tuning: TuningOverrides,
  rng: () => number,
): number {
  const raw = ability.baseDamage + srcAttrs.attackPower * ability.attackPowerScaling;
  const armorEff = tuning.armorEffectivenessWeight;
  const mitigation = (tgtAttrs.armor * armorEff) / (tgtAttrs.armor * armorEff + 100);
  const isCrit = rng() < srcAttrs.critChance;
  const critMul = isCrit ? srcAttrs.critDamage * tuning.critMultiplierMul : 1;
  return Math.max(0, raw * critMul * (1 - mitigation));
}

// ── Single fight simulation (lightweight) ──────────────────────────────────

interface QuickFightResult {
  won: boolean;
  durationSec: number;
  damageDealt: number;
  damageTaken: number;
  healthRemaining: number;
}

function simulateFight(
  playerAttrs: AttributeSet,
  abilities: CombatAbility[],
  enemies: { attrs: AttributeSet; ability: CombatAbility; intervalSec: number }[],
  tuning: TuningOverrides,
  rng: () => number,
  maxDuration: number,
): QuickFightResult {
  const TICK = 0.1;
  let playerHP = playerAttrs.health;
  let playerMana = playerAttrs.mana;
  const enemyHPs = enemies.map(e => e.attrs.health);
  let time = 0;
  let totalDealt = 0;
  let totalTaken = 0;

  const cooldowns = new Map<string, number>();
  let invulnUntil = 0;

  while (time < maxDuration) {
    // Player turn: pick best ability
    const alive = enemies.map((_, i) => i).filter(i => enemyHPs[i] > 0);
    if (alive.length === 0) break;

    let bestAbility: CombatAbility | null = null;
    let bestPriority = -1;
    for (const ab of abilities) {
      const cd = cooldowns.get(ab.id) ?? 0;
      if (cd > time) continue;
      if (ab.manaCost > playerMana) continue;

      let priority = 0;
      if (ab.type === 'dodge' && playerHP < playerAttrs.maxHealth * 0.3) priority = 10;
      else if (ab.type === 'buff') priority = 5;
      else if (ab.type === 'aoe' && alive.length >= 2) priority = 4;
      else priority = ab.baseDamage + playerAttrs.attackPower * ab.attackPowerScaling;

      if (priority > bestPriority) { bestPriority = priority; bestAbility = ab; }
    }

    if (bestAbility) {
      cooldowns.set(bestAbility.id, time + bestAbility.cooldownSec);
      playerMana -= bestAbility.manaCost;

      if (bestAbility.appliesInvulnerable) {
        invulnUntil = time + bestAbility.appliesInvulnerable;
      }

      if (bestAbility.baseDamage > 0) {
        const targets = bestAbility.aoeRadius > 0 ? alive : [alive[0]];
        for (const ti of targets) {
          const dmg = calcDamage(bestAbility, playerAttrs, enemies[ti].attrs, tuning, rng);
          enemyHPs[ti] -= dmg;
          totalDealt += dmg;
        }
      }
    }

    // Check enemies alive
    const stillAlive = enemies.map((_, i) => i).filter(i => enemyHPs[i] > 0);
    if (stillAlive.length === 0) break;

    // Enemy turns
    for (const ei of stillAlive) {
      const enemy = enemies[ei];
      const attacksPerTick = TICK / enemy.intervalSec;
      if (rng() < attacksPerTick) {
        if (time < invulnUntil) continue;
        const dmg = calcDamage(enemy.ability, enemy.attrs, playerAttrs, tuning, rng);
        playerHP -= dmg;
        totalTaken += dmg;
        if (playerHP <= 0) break;
      }
    }

    if (playerHP <= 0) break;

    // Mana regen
    playerMana = Math.min(playerAttrs.maxMana, playerMana + 2 * TICK);
    time += TICK;
  }

  return {
    won: playerHP > 0 && enemies.every((_, i) => enemyHPs[i] <= 0),
    durationSec: Math.round(time * 10) / 10,
    damageDealt: totalDealt,
    damageTaken: totalTaken,
    healthRemaining: Math.max(0, playerHP),
  };
}

// ── Public types ───────────────────────────────────────────────────────────

export interface HeatmapCell {
  playerLevel: number;
  enemyLabel: string;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
  avgEHP: number;
}

export interface SurvivalCurvePoint {
  level: number;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
}

export interface DPSBreakdown {
  abilityName: string;
  avgDamage: number;
  color: string;
}

export interface SensitivityPoint {
  value: number;
  survivalRate: number;
  avgTTK: number;
  avgDPS: number;
}

export interface SensitivityCurve {
  attribute: string;
  points: SensitivityPoint[];
  diminishingAt: number | null;
}

export interface BalanceReport {
  summary: string;
  heatmap: HeatmapCell[];
  survivalCurves: Record<string, SurvivalCurvePoint[]>;
  dpsBreakdowns: Record<string, DPSBreakdown[]>;
  sensitivity: SensitivityCurve[];
  alerts: { severity: 'info' | 'warning' | 'critical'; message: string }[];
  durationMs: number;
}

export interface PredictiveBalanceConfig {
  levelRange: [number, number];
  levelStep: number;
  iterations: number;
  gearId: string;
  enemyConfigs: { archetypeId: string; count: number; levelOffset: number }[];
  tuning: TuningOverrides;
  sensitivityAttributes: AttributeKey[];
}

export const DEFAULT_PREDICTIVE_CONFIG: PredictiveBalanceConfig = {
  levelRange: [1, 30],
  levelStep: 3,
  iterations: 200,
  gearId: 'mid-tier',
  enemyConfigs: [
    { archetypeId: 'melee-grunt', count: 3, levelOffset: 0 },
    { archetypeId: 'ranged-caster', count: 1, levelOffset: 0 },
    { archetypeId: 'brute', count: 1, levelOffset: 0 },
    { archetypeId: 'elite-knight', count: 1, levelOffset: 0 },
  ],
  tuning: DEFAULT_TUNING,
  sensitivityAttributes: ['attackPower', 'armor', 'maxHealth', 'critChance'],
};

const ABILITY_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

// ── Main simulation runner ─────────────────────────────────────────────────

export function runPredictiveBalance(config: PredictiveBalanceConfig): BalanceReport {
  const start = performance.now();
  const rng = createRNG(42);

  const levels: number[] = [];
  for (let l = config.levelRange[0]; l <= config.levelRange[1]; l += config.levelStep) {
    levels.push(l);
  }

  const heatmap: HeatmapCell[] = [];
  const survivalCurves: Record<string, SurvivalCurvePoint[]> = {};
  const dpsBreakdowns: Record<string, DPSBreakdown[]> = {};
  const alerts: BalanceReport['alerts'] = [];

  // For each enemy config, sweep across player levels
  for (const ec of config.enemyConfigs) {
    const archetype = ENEMY_ARCHETYPES.find(a => a.id === ec.archetypeId);
    if (!archetype) continue;

    const label = `${ec.count}x ${archetype.name}`;
    const curvePoints: SurvivalCurvePoint[] = [];

    for (const playerLevel of levels) {
      const playerAttrs = buildPlayerAttrs(playerLevel, config.gearId, config.tuning);
      const enemyLevel = playerLevel + ec.levelOffset;

      const enemyInstances = Array.from({ length: ec.count }, () => {
        const attrs = buildEnemyAttrs(archetype, enemyLevel, config.tuning);
        const ability = archetype.abilities[0];
        return { attrs, ability, intervalSec: archetype.attackIntervalSec };
      });

      let wins = 0;
      let totalTTK = 0;
      let totalDPS = 0;
      let totalDealt = 0;
      const abilityDamage: Record<string, number> = {};

      for (let i = 0; i < config.iterations; i++) {
        const result = simulateFight(playerAttrs, PLAYER_ABILITIES, enemyInstances, config.tuning, rng, 120);
        if (result.won) wins++;
        totalTTK += result.durationSec;
        totalDealt += result.damageDealt;
        const dps = result.durationSec > 0 ? result.damageDealt / result.durationSec : 0;
        totalDPS += dps;
      }

      const survivalRate = wins / config.iterations;
      const avgTTK = totalTTK / config.iterations;
      const avgDPS = totalDPS / config.iterations;
      const avgEHP = playerAttrs.maxHealth * (1 + playerAttrs.armor * config.tuning.armorEffectivenessWeight / 100);

      heatmap.push({ playerLevel, enemyLabel: label, survivalRate, avgTTK, avgDPS, avgEHP });
      curvePoints.push({ level: playerLevel, survivalRate, avgTTK, avgDPS });

      // Alerts for specific levels
      if (playerLevel === config.levelRange[0] + config.levelStep && survivalRate < 0.3) {
        alerts.push({ severity: 'critical', message: `Lv.${playerLevel} vs ${label}: ${(survivalRate * 100).toFixed(0)}% survival — early game too hard` });
      }
      if (survivalRate > 0.98 && playerLevel < 20) {
        alerts.push({ severity: 'warning', message: `Lv.${playerLevel} vs ${label}: ${(survivalRate * 100).toFixed(0)}% survival — trivially easy` });
      }
      if (avgTTK > 60) {
        alerts.push({ severity: 'info', message: `Lv.${playerLevel} vs ${label}: ${avgTTK.toFixed(1)}s avg fight — consider lowering enemy HP` });
      }
    }

    survivalCurves[label] = curvePoints;

    // DPS breakdown for mid-level
    const midLevel = Math.floor((config.levelRange[0] + config.levelRange[1]) / 2);
    const midAttrs = buildPlayerAttrs(midLevel, config.gearId, config.tuning);
    const dpsItems: DPSBreakdown[] = PLAYER_ABILITIES
      .filter(ab => ab.baseDamage > 0)
      .map((ab, i) => {
        const raw = ab.baseDamage + midAttrs.attackPower * ab.attackPowerScaling;
        const effectiveDPS = raw / Math.max(ab.cooldownSec, ab.castTimeSec);
        return { abilityName: ab.name, avgDamage: effectiveDPS, color: ABILITY_COLORS[i % ABILITY_COLORS.length] };
      })
      .sort((a, b) => b.avgDamage - a.avgDamage);
    dpsBreakdowns[label] = dpsItems;
  }

  // Sensitivity analysis
  const sensitivity: SensitivityCurve[] = [];
  const sensLevel = Math.floor((config.levelRange[0] + config.levelRange[1]) / 2);
  const firstEnemy = config.enemyConfigs[0];
  const sensArchetype = ENEMY_ARCHETYPES.find(a => a.id === firstEnemy?.archetypeId);

  if (sensArchetype && firstEnemy) {
    for (const attr of config.sensitivityAttributes) {
      const baseAttrs = buildPlayerAttrs(sensLevel, config.gearId, config.tuning);
      const baseVal = baseAttrs[attr];
      const range = attr === 'critChance' ? { min: 0.01, max: 0.4, steps: 12 } : { min: baseVal * 0.3, max: baseVal * 2.5, steps: 12 };

      const points: SensitivityPoint[] = [];
      let prevSurvival = 0;
      let diminishingAt: number | null = null;

      for (let s = 0; s <= range.steps; s++) {
        const value = range.min + (range.max - range.min) * (s / range.steps);
        const testAttrs = { ...baseAttrs, [attr]: value };
        if (attr === 'health') testAttrs.maxHealth = value;
        if (attr === 'maxHealth') testAttrs.health = value;

        const enemies = Array.from({ length: firstEnemy.count }, () => ({
          attrs: buildEnemyAttrs(sensArchetype, sensLevel + firstEnemy.levelOffset, config.tuning),
          ability: sensArchetype.abilities[0],
          intervalSec: sensArchetype.attackIntervalSec,
        }));

        let wins = 0;
        let totalTTK = 0;
        let totalDPS = 0;

        for (let i = 0; i < config.iterations; i++) {
          const r = simulateFight(testAttrs, PLAYER_ABILITIES, enemies, config.tuning, rng, 120);
          if (r.won) wins++;
          totalTTK += r.durationSec;
          totalDPS += r.durationSec > 0 ? r.damageDealt / r.durationSec : 0;
        }

        const survivalRate = wins / config.iterations;
        const avgTTK = totalTTK / config.iterations;
        const avgDPS = totalDPS / config.iterations;
        points.push({ value, survivalRate, avgTTK, avgDPS });

        // Detect diminishing returns
        if (s > 1 && diminishingAt === null) {
          const delta = survivalRate - prevSurvival;
          const prevDelta = points.length >= 3 ? points[points.length - 2].survivalRate - points[points.length - 3].survivalRate : delta;
          if (prevDelta > 0.01 && delta < prevDelta * 0.4) {
            diminishingAt = value;
          }
        }
        prevSurvival = survivalRate;
      }

      sensitivity.push({ attribute: attr, points, diminishingAt });
    }
  }

  // Build summary
  const midCells = heatmap.filter(c => c.playerLevel === Math.floor((config.levelRange[0] + config.levelRange[1]) / 2));
  const avgSurvival = midCells.length > 0 ? midCells.reduce((s, c) => s + c.survivalRate, 0) / midCells.length : 0;
  const avgTTK = midCells.length > 0 ? midCells.reduce((s, c) => s + c.avgTTK, 0) / midCells.length : 0;

  const summary = `Player Lv.${config.levelRange[0]}-${config.levelRange[1]} across ${config.enemyConfigs.length} encounter types: ` +
    `${(avgSurvival * 100).toFixed(0)}% avg mid-level survival, ${avgTTK.toFixed(1)}s avg fight duration. ` +
    `${alerts.filter(a => a.severity === 'critical').length} critical, ${alerts.filter(a => a.severity === 'warning').length} warnings.`;

  return {
    summary,
    heatmap,
    survivalCurves,
    dpsBreakdowns,
    sensitivity,
    alerts,
    durationMs: Math.round(performance.now() - start),
  };
}
