import type {
  AttributeSet,
  AttributeKey,
  CombatAbility,
  EnemyArchetype,
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  FightResult,
  SimulationResult,
  CombatSummary,
  BalanceAlert,
} from '@/types/combat-simulator';
import {
  BASE_PLAYER_ATTRIBUTES,
  PLAYER_LEVEL_SCALING,
  ENEMY_ARCHETYPES,
} from './definitions';

// ── Seeded RNG ──────────────────────────────────────────────────────────────

function createRNG(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Damage Formula (UARPGDamageExecution) ───────────────────────────────────
// FinalDamage = (BaseDamage + AttackPower * Scaling) * CritMul * (1 - ArmorReduction)
// ArmorReduction = Armor / (Armor + 100) — diminishing returns formula

function calculateDamage(
  ability: CombatAbility,
  sourceAttrs: AttributeSet,
  targetAttrs: AttributeSet,
  tuning: TuningOverrides,
  rng: () => number,
  isPlayer: boolean,
): { damage: number; isCrit: boolean } {
  const baseDmg = ability.baseDamage + sourceAttrs.attackPower * ability.attackPowerScaling;
  const damageMul = isPlayer ? tuning.playerDamageMul : tuning.enemyDamageMul;

  // Crit check
  const isCrit = rng() < sourceAttrs.critChance;
  const critMul = isCrit ? sourceAttrs.critDamage * tuning.critMultiplierMul : 1.0;

  // Armor reduction (diminishing returns)
  const effectiveArmor = targetAttrs.armor * (isPlayer ? tuning.enemyDamageMul : tuning.playerArmorMul) * tuning.armorEffectivenessWeight;
  const armorReduction = effectiveArmor / (effectiveArmor + 100);

  const finalDamage = Math.max(1, Math.round(baseDmg * damageMul * critMul * (1 - armorReduction)));
  return { damage: finalDamage, isCrit };
}

// ── Build Scaled Attributes ─────────────────────────────────────────────────

function buildPlayerAttributes(
  level: number,
  gearBonuses: Partial<Record<AttributeKey, number>>,
  tuning: TuningOverrides,
): AttributeSet {
  const attrs = { ...BASE_PLAYER_ATTRIBUTES };

  // Level scaling
  for (const [key, perLevel] of Object.entries(PLAYER_LEVEL_SCALING) as [AttributeKey, number][]) {
    attrs[key] += perLevel * (level - 1);
  }

  // Gear bonuses
  for (const [key, bonus] of Object.entries(gearBonuses) as [AttributeKey, number][]) {
    attrs[key] += bonus;
  }

  // Tuning multipliers
  attrs.health = Math.round(attrs.health * tuning.playerHealthMul);
  attrs.maxHealth = Math.round(attrs.maxHealth * tuning.playerHealthMul);
  attrs.armor = Math.round(attrs.armor * tuning.playerArmorMul);

  return attrs;
}

function buildEnemyAttributes(
  archetype: EnemyArchetype,
  level: number,
  tuning: TuningOverrides,
): AttributeSet {
  const attrs = { ...archetype.baseAttributes };

  for (const [key, perLevel] of Object.entries(archetype.levelScaling) as [AttributeKey, number][]) {
    attrs[key] += perLevel * (level - 1);
  }

  attrs.health = Math.round(attrs.health * tuning.enemyHealthMul);
  attrs.maxHealth = Math.round(attrs.maxHealth * tuning.enemyHealthMul);

  return attrs;
}

// ── Single Fight Simulation ─────────────────────────────────────────────────

interface CombatEntity {
  name: string;
  attrs: AttributeSet;
  abilities: CombatAbility[];
  cooldowns: Record<string, number>;
  nextActionTime: number;
  attackInterval: number;
  isPlayer: boolean;
  stunUntil: number;
  invulnerableUntil: number;
  buffs: { attribute: AttributeKey; amount: number; expiresAt: number }[];
}

function simulateFight(
  scenario: CombatScenario,
  tuning: TuningOverrides,
  config: CombatSimConfig,
  rng: () => number,
): FightResult {
  // Build player entity
  const playerAttrs = buildPlayerAttributes(
    scenario.playerLevel,
    scenario.playerGear.bonuses,
    tuning,
  );
  const player: CombatEntity = {
    name: 'Player',
    attrs: { ...playerAttrs },
    abilities: scenario.playerAbilities,
    cooldowns: {},
    nextActionTime: 0,
    attackInterval: 0.8,
    isPlayer: true,
    stunUntil: 0,
    invulnerableUntil: 0,
    buffs: [],
  };

  // Build enemy entities
  const enemies: CombatEntity[] = [];
  for (const entry of scenario.enemies) {
    const archetype = ENEMY_ARCHETYPES.find((a) => a.id === entry.archetypeId);
    if (!archetype) continue;
    for (let i = 0; i < entry.count; i++) {
      const attrs = buildEnemyAttributes(archetype, entry.level, tuning);
      enemies.push({
        name: `${archetype.name}${entry.count > 1 ? ` #${i + 1}` : ''}`,
        attrs: { ...attrs },
        abilities: archetype.abilities,
        cooldowns: {},
        nextActionTime: 0.5 + rng() * 1.5, // Stagger initial attacks
        attackInterval: archetype.attackIntervalSec,
        isPlayer: false,
        stunUntil: 0,
        invulnerableUntil: 0,
        buffs: [],
      });
    }
  }

  // Fight tracking
  const abilityUsage: Record<string, number> = {};
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let critCount = 0;
  let totalHits = 0;
  let enemiesKilled = 0;
  let killedBy: string | undefined;
  let oneShot = false;
  const startHealth = player.attrs.health;

  // Simulation tick (0.1s resolution)
  const dt = 0.1;
  let time = 0;

  while (time < config.maxFightDurationSec) {
    time += dt;

    // Update buffs
    updateBuffs(player, time);
    for (const e of enemies) updateBuffs(e, time);

    // Player action
    if (player.attrs.health > 0 && time >= player.nextActionTime && time >= player.stunUntil) {
      const aliveEnemies = enemies.filter((e) => e.attrs.health > 0);
      if (aliveEnemies.length === 0) break;

      const ability = choosePlayerAbility(player, aliveEnemies, time, rng);
      if (ability) {
        abilityUsage[ability.id] = (abilityUsage[ability.id] ?? 0) + 1;

        if (ability.type === 'buff') {
          applyBuff(player, ability, time);
        } else if (ability.type === 'dodge') {
          player.invulnerableUntil = time + (ability.appliesInvulnerable ?? 0.5);
        } else {
          // Damage abilities
          const targets = ability.aoeRadius > 0 ? aliveEnemies : [aliveEnemies[0]];
          for (const target of targets) {
            const { damage, isCrit } = calculateDamage(
              ability, getEffectiveAttrs(player), target.attrs, tuning, rng, true,
            );
            target.attrs.health -= damage;
            totalDamageDealt += damage;
            totalHits++;
            if (isCrit) critCount++;
            if (target.attrs.health <= 0) enemiesKilled++;

            // Stun
            if (ability.appliesStun && ability.appliesStun > 0) {
              target.stunUntil = time + ability.appliesStun;
            }
          }
          // Invulnerability from dash
          if (ability.appliesInvulnerable) {
            player.invulnerableUntil = time + ability.appliesInvulnerable;
          }
        }

        // Consume mana
        player.attrs.mana -= ability.manaCost;

        // Set cooldown
        if (ability.cooldownSec > 0) {
          player.cooldowns[ability.id] = time + ability.cooldownSec;
        }
        player.nextActionTime = time + ability.castTimeSec + 0.1;
      }
    }

    // Enemy actions
    for (const enemy of enemies) {
      if (enemy.attrs.health <= 0) continue;
      if (player.attrs.health <= 0) break;
      if (time < enemy.nextActionTime || time < enemy.stunUntil) continue;

      // Pick ability (first off cooldown, or first available)
      const ability = enemy.abilities.find((a) =>
        (enemy.cooldowns[a.id] ?? 0) <= time &&
        (a.manaCost <= enemy.attrs.mana),
      ) ?? enemy.abilities[0];

      if (ability && time >= player.invulnerableUntil) {
        const { damage, isCrit } = calculateDamage(
          ability, getEffectiveAttrs(enemy), player.attrs, tuning, rng, false,
        );
        player.attrs.health -= damage;
        totalDamageTaken += damage;

        // One-shot check
        if (player.attrs.health <= 0 && damage >= startHealth * 0.9) {
          oneShot = true;
          killedBy = enemy.name;
        } else if (player.attrs.health <= 0) {
          killedBy = enemy.name;
        }

        if (ability.cooldownSec > 0) {
          enemy.cooldowns[ability.id] = time + ability.cooldownSec;
        }
        enemy.attrs.mana -= ability.manaCost;
      }

      enemy.nextActionTime = time + enemy.attackInterval * (0.8 + rng() * 0.4);
    }

    // Mana regen (2 per second for player)
    player.attrs.mana = Math.min(player.attrs.maxMana, player.attrs.mana + 2 * dt);

    // Check end conditions
    if (player.attrs.health <= 0) break;
    if (enemies.every((e) => e.attrs.health <= 0)) break;
  }

  const won = player.attrs.health > 0 && enemies.every((e) => e.attrs.health <= 0);

  return {
    won,
    durationSec: round2(time),
    playerHealthRemaining: Math.max(0, player.attrs.health),
    playerManaRemaining: Math.max(0, player.attrs.mana),
    totalDamageDealt,
    totalDamageTaken,
    abilitiesUsed: abilityUsage,
    critCount,
    totalHits,
    enemiesKilled,
    killedBy,
    oneShot,
  };
}

// ── AI: Choose Player Ability ───────────────────────────────────────────────

function choosePlayerAbility(
  player: CombatEntity,
  enemies: CombatEntity[],
  time: number,
  rng: () => number,
): CombatAbility | null {
  const available = player.abilities.filter((a) =>
    (player.cooldowns[a.id] ?? 0) <= time &&
    a.manaCost <= player.attrs.mana,
  );

  if (available.length === 0) {
    // Fall back to basic attack (always available)
    return player.abilities.find((a) => a.id === 'ga-melee-attack') ?? player.abilities[0];
  }

  // Priority: use buff if available and not active, use AoE if multiple enemies, otherwise highest damage
  const buff = available.find((a) => a.type === 'buff');
  if (buff && player.buffs.length === 0 && rng() > 0.3) return buff;

  const aoe = available.find((a) => a.aoeRadius > 0 && a.type !== 'buff');
  if (aoe && enemies.length >= 2 && rng() > 0.4) return aoe;

  // Dodge if low health
  const dodge = available.find((a) => a.type === 'dodge');
  if (dodge && player.attrs.health < player.attrs.maxHealth * 0.3 && rng() > 0.5) return dodge;

  // Highest damage ability
  const damageAbilities = available
    .filter((a) => a.type !== 'buff' && a.type !== 'dodge')
    .sort((a, b) =>
      (b.baseDamage + b.attackPowerScaling * player.attrs.attackPower) -
      (a.baseDamage + a.attackPowerScaling * player.attrs.attackPower),
    );

  return damageAbilities[0] ?? available[0];
}

// ── Buff Management ─────────────────────────────────────────────────────────

function applyBuff(entity: CombatEntity, ability: CombatAbility, time: number) {
  if (!ability.appliesBuff) return;
  const { attribute, amount, durationSec } = ability.appliesBuff;
  entity.attrs[attribute] += amount;
  entity.buffs.push({ attribute, amount, expiresAt: time + durationSec });
}

function updateBuffs(entity: CombatEntity, time: number) {
  entity.buffs = entity.buffs.filter((buff) => {
    if (time >= buff.expiresAt) {
      entity.attrs[buff.attribute] -= buff.amount;
      return false;
    }
    return true;
  });
}

function getEffectiveAttrs(entity: CombatEntity): AttributeSet {
  return entity.attrs; // Buffs already applied in-place
}

// ── Monte Carlo Runner ──────────────────────────────────────────────────────

export function runCombatSimulation(
  scenario: CombatScenario,
  tuning: TuningOverrides,
  config: CombatSimConfig,
): SimulationResult {
  const startTime = Date.now();
  const rng = createRNG(config.seed);

  const fights: FightResult[] = [];
  for (let i = 0; i < config.iterations; i++) {
    fights.push(simulateFight(scenario, tuning, config, rng));
  }

  const summary = computeSummary(fights, scenario, config);
  const alerts = detectAlerts(summary, fights, config);

  return {
    config,
    scenario,
    tuning,
    fights,
    summary,
    alerts,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

// ── Summary Computation ─────────────────────────────────────────────────────

function computeSummary(
  fights: FightResult[],
  scenario: CombatScenario,
  config: CombatSimConfig,
): CombatSummary {
  const n = fights.length;
  const wins = fights.filter((f) => f.won);
  const durations = fights.map((f) => f.durationSec).sort((a, b) => a - b);
  const dmgDealt = fights.map((f) => f.totalDamageDealt);
  const dmgTaken = fights.map((f) => f.totalDamageTaken);

  // Ability heatmap
  const abilityHeatmap: Record<string, number> = {};
  for (const ability of scenario.playerAbilities) {
    const totalUses = fights.reduce((sum, f) => sum + (f.abilitiesUsed[ability.id] ?? 0), 0);
    abilityHeatmap[ability.name] = round2(totalUses / n);
  }

  // Distribution buckets
  const damageDealtBuckets = buildBuckets(dmgDealt, 8);
  const damageTakenBuckets = buildBuckets(dmgTaken, 8);
  const durationBuckets = buildBuckets(durations, 8);

  const avgDuration = durations.reduce((s, d) => s + d, 0) / n;
  const totalCrits = fights.reduce((s, f) => s + f.critCount, 0);
  const totalHits = fights.reduce((s, f) => s + f.totalHits, 0);

  return {
    survivalRate: round2(wins.length / n),
    avgFightDurationSec: round2(avgDuration),
    medianFightDurationSec: round2(durations[Math.floor(n / 2)]),
    avgDamageDealt: round2(dmgDealt.reduce((s, d) => s + d, 0) / n),
    avgDamageTaken: round2(dmgTaken.reduce((s, d) => s + d, 0) / n),
    avgPlayerHealthRemaining: round2(fights.reduce((s, f) => s + f.playerHealthRemaining, 0) / n),
    avgDPS: avgDuration > 0 ? round2(dmgDealt.reduce((s, d) => s + d, 0) / n / avgDuration) : 0,
    avgEnemyDPS: avgDuration > 0 ? round2(dmgTaken.reduce((s, d) => s + d, 0) / n / avgDuration) : 0,
    avgCritRate: totalHits > 0 ? round2(totalCrits / totalHits) : 0,
    abilityHeatmap,
    damageDealtBuckets,
    damageTakenBuckets,
    durationBuckets,
    oneShotRate: round2(fights.filter((f) => f.oneShot).length / n),
  };
}

function buildBuckets(values: number[], count: number): { min: number; max: number; count: number }[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const bucketSize = range / count;

  const buckets = Array.from({ length: count }, (_, i) => ({
    min: round2(min + i * bucketSize),
    max: round2(min + (i + 1) * bucketSize),
    count: 0,
  }));

  for (const v of sorted) {
    const idx = Math.min(Math.floor((v - min) / bucketSize), count - 1);
    buckets[idx].count++;
  }

  return buckets;
}

// ── Balance Alert Detection ─────────────────────────────────────────────────

function detectAlerts(
  summary: CombatSummary,
  fights: FightResult[],
  config: CombatSimConfig,
): BalanceAlert[] {
  const alerts: BalanceAlert[] = [];

  // One-shot deaths
  if (summary.oneShotRate > 0.05) {
    alerts.push({
      severity: summary.oneShotRate > 0.2 ? 'critical' : 'warning',
      type: 'one-shot',
      message: `${(summary.oneShotRate * 100).toFixed(1)}% of fights result in one-shot death — player has no chance to react`,
      metric: 'oneShotRate',
      value: summary.oneShotRate,
      threshold: 0.05,
    });
  }

  // Fights too long (>60s)
  const longFights = fights.filter((f) => f.durationSec > 60).length / fights.length;
  if (longFights > 0.1) {
    alerts.push({
      severity: longFights > 0.3 ? 'critical' : 'warning',
      type: 'too-long',
      message: `${(longFights * 100).toFixed(1)}% of fights last over 60s — combat feels tedious and spongy`,
      metric: 'longFightRate',
      value: longFights,
      threshold: 0.1,
    });
  }

  // Fights too short (<3s)
  const shortFights = fights.filter((f) => f.durationSec < 3 && f.won).length / fights.length;
  if (shortFights > 0.5) {
    alerts.push({
      severity: 'info',
      type: 'too-short',
      message: `${(shortFights * 100).toFixed(1)}% of fights end in under 3s — player may be overpowered for this encounter`,
      metric: 'shortFightRate',
      value: shortFights,
      threshold: 0.5,
    });
  }

  // Abilities never used
  for (const [name, avgUses] of Object.entries(summary.abilityHeatmap)) {
    if (avgUses < 0.1) {
      alerts.push({
        severity: 'warning',
        type: 'ability-unused',
        message: `"${name}" is used <0.1 times per fight — ability may be too expensive, low damage, or on too long a cooldown`,
        metric: 'abilityUsage',
        value: avgUses,
        threshold: 0.1,
      });
    }
  }

  // DPS bottleneck
  if (summary.avgDPS > 0 && summary.avgEnemyDPS > 0) {
    const ratio = summary.avgDPS / summary.avgEnemyDPS;
    if (ratio < 0.5) {
      alerts.push({
        severity: 'warning',
        type: 'dps-bottleneck',
        message: `Player DPS (${summary.avgDPS.toFixed(1)}) is less than half of enemy DPS (${summary.avgEnemyDPS.toFixed(1)}) — player can't out-damage enemies`,
        metric: 'dpsRatio',
        value: ratio,
        threshold: 0.5,
      });
    }
  }

  // Low survival
  if (summary.survivalRate < 0.3) {
    alerts.push({
      severity: summary.survivalRate < 0.1 ? 'critical' : 'warning',
      type: 'survival-low',
      message: `${(summary.survivalRate * 100).toFixed(1)}% survival rate — encounter is too punishing`,
      metric: 'survivalRate',
      value: summary.survivalRate,
      threshold: 0.3,
    });
  }

  // Too easy
  if (summary.survivalRate > 0.98 && summary.avgFightDurationSec < 10) {
    alerts.push({
      severity: 'info',
      type: 'survival-high',
      message: `${(summary.survivalRate * 100).toFixed(1)}% survival with ${summary.avgFightDurationSec.toFixed(1)}s avg — encounter is trivial`,
      metric: 'survivalRate',
      value: summary.survivalRate,
      threshold: 0.98,
    });
  }

  return alerts.sort((a, b) => {
    const rank = { critical: 2, warning: 1, info: 0 };
    return rank[b.severity] - rank[a.severity];
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
