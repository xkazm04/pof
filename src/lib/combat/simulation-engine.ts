import type {
  AttributeSet,
  AttributeKey,
  CombatAbility,
  EnemyArchetype,
  CombatScenario,
  TuningOverrides,
  CombatSimConfig,
  FightResult,
  DamageSource,
  SimulationResult,
  CombatSummary,
  ThreatBreakdown,
  ThreatEntry,
  EnemyThreatEntry,
  BalanceAlert,
  FeedbackConfig,
  FeedbackComparisonResult,
  FeedbackSimSummary,
  FeedbackInsight,
  ABComparisonResult,
  RunSnapshot,
  AlertDiffEntry,
  AlertDiffStatus,
} from '@/types/combat-simulator';
import {
  BASE_PLAYER_ATTRIBUTES,
  PLAYER_LEVEL_SCALING,
  ENEMY_ARCHETYPE_BY_ID,
} from './definitions';
import { createRNG } from '@/lib/seeded-rng';

// ── Seeded RNG ──────────────────────────────────────────────────────────────
// Re-exported from the shared helper so existing combat sims (e.g. choreography-sim)
// keep importing `createRNG` from this module.
export { createRNG };

// ── Damage Formula (UARPGDamageExecution) ───────────────────────────────────
// FinalDamage = (BaseDamage + AttackPower * Scaling) * CritMul * (1 - ArmorReduction)
// ArmorReduction = Armor / (Armor + 100) — diminishing returns formula

export function calculateDamage(
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

  // Armor reduction (diminishing returns). targetAttrs.armor already includes the build-time
  // playerArmorMul (see buildPlayerAttributes), so re-applying a multiplier here squared the
  // player's mitigation, and feeding enemyDamageMul (a *damage* knob) into the enemy's armor
  // made raising enemy damage also raise enemy armor. Apply only the effectiveness weight.
  const effectiveArmor = targetAttrs.armor * tuning.armorEffectivenessWeight;
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
  /** Enemy archetype name (no "#N" suffix); undefined for the player */
  archetypeName?: string;
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
    const archetype = ENEMY_ARCHETYPE_BY_ID.get(entry.archetypeId);
    if (!archetype) continue;
    for (let i = 0; i < entry.count; i++) {
      const attrs = buildEnemyAttributes(archetype, entry.level, tuning);
      enemies.push({
        name: `${archetype.name}${entry.count > 1 ? ` #${i + 1}` : ''}`,
        archetypeName: archetype.name,
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
  /** key: `${archetypeName}|${abilityId}` */
  const damageSources = new Map<string, DamageSource>();
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let critCount = 0;
  let totalHits = 0;
  let enemiesKilled = 0;
  let killedBy: string | undefined;
  let killedByAbility: string | undefined;
  let killedByAbilityId: string | undefined;
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
      if (!ability) {
        // Every ability is on cooldown or unaffordable — idle until the next
        // tick re-checks the gates (mana regenerates below).
        player.nextActionTime = time + dt;
      } else {
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
        const { damage } = calculateDamage(
          ability, getEffectiveAttrs(enemy), player.attrs, tuning, rng, false,
        );
        player.attrs.health -= damage;
        totalDamageTaken += damage;

        // Per-source damage tracking (aggregate by archetype, not "#N" instance)
        const archetypeName = enemy.archetypeName ?? enemy.name;
        const key = `${archetypeName}|${ability.id}`;
        const existing = damageSources.get(key);
        if (existing) {
          existing.damage += damage;
        } else {
          damageSources.set(key, {
            enemy: archetypeName,
            ability: ability.name,
            abilityId: ability.id,
            damage,
          });
        }

        // Death + killing-blow attribution
        if (player.attrs.health <= 0) {
          killedBy = archetypeName;
          killedByAbility = ability.name;
          killedByAbilityId = ability.id;
          if (damage >= startHealth * 0.9) oneShot = true;
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

  // enemies.length > 0: an all-unknown-archetype scenario builds zero enemies,
  // and `[].every(...)` is true — without this guard a fully-stale scenario
  // would report a 100%-survival "win" against nothing. The API edge also
  // rejects unknown archetype ids; this is defense in depth for direct callers.
  const won = enemies.length > 0 && player.attrs.health > 0 && enemies.every((e) => e.attrs.health <= 0);

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
    killedByAbility,
    killedByAbilityId,
    damageBySource: Array.from(damageSources.values()),
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
    // No ability is both off-cooldown AND affordable — the player waits this
    // beat. The old fallback returned `abilities[0]` unconditionally, which
    // simulateFight then charged mana for (line 241) and reset the cooldown on
    // (line 244) regardless of the gates — so any loadout without a free,
    // short-cooldown basic fired its strongest ability forever at no cost,
    // driving mana negative and computing DPS/survival as fiction.
    return null;
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

/** Resolve on the next macrotask so the Node event loop can service other work. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') setImmediate(resolve);
    else setTimeout(resolve, 0);
  });
}

/**
 * Event-loop-friendly variant of runCombatSimulation. Runs the SAME
 * deterministic fights (identical seed → identical fight sequence → identical
 * summary/alerts) but in batches, yielding between batches so a 5000-iteration
 * run no longer blocks the Node process for its whole duration and starves
 * every other request. `onProgress` fires once per completed batch, enabling a
 * streaming endpoint to report intermediate progress.
 */
export async function runCombatSimulationBatched(
  scenario: CombatScenario,
  tuning: TuningOverrides,
  config: CombatSimConfig,
  opts: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void | Promise<void>;
  } = {},
): Promise<SimulationResult> {
  const startTime = Date.now();
  const rng = createRNG(config.seed);
  const total = config.iterations;
  const batchSize = Math.max(1, opts.batchSize ?? 250);

  const fights: FightResult[] = [];
  for (let i = 0; i < total; i++) {
    fights.push(simulateFight(scenario, tuning, config, rng));
    if ((i + 1) % batchSize === 0 || i + 1 === total) {
      if (opts.onProgress) await opts.onProgress(i + 1, total);
      if (i + 1 < total) await yieldToEventLoop();
    }
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

  const threatBreakdown = computeThreatBreakdown(fights, scenario);

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
    threatBreakdown,
  };
}

// ── Threat Breakdown ────────────────────────────────────────────────────────

/**
 * Death recap aggregator: tallies per-(enemy, ability) damage and kills across
 * all fights, then ranks the worst offenders with a designer-facing nerf hint.
 */
export function computeThreatBreakdown(
  fights: FightResult[],
  scenario: CombatScenario,
): ThreatBreakdown {
  const deaths = fights.filter((f) => f.killedBy);
  const totalDeaths = deaths.length;
  const totalDamageTaken = fights.reduce((s, f) => s + f.totalDamageTaken, 0);

  // Ability lookup across all enemy archetypes in scenario
  const abilityByKey = new Map<string, { ability: CombatAbility; enemyArchetype: EnemyArchetype }>();
  for (const entry of scenario.enemies) {
    const archetype = ENEMY_ARCHETYPE_BY_ID.get(entry.archetypeId);
    if (!archetype) continue;
    for (const ability of archetype.abilities) {
      abilityByKey.set(`${archetype.name}|${ability.id}`, { ability, enemyArchetype: archetype });
    }
  }

  // Aggregate per-source damage + kills
  type SourceAcc = { enemy: string; ability: string; abilityId: string; totalDamage: number; killCount: number };
  const sources = new Map<string, SourceAcc>();

  for (const fight of fights) {
    for (const ds of fight.damageBySource) {
      const key = `${ds.enemy}|${ds.abilityId}`;
      const acc = sources.get(key);
      if (acc) {
        acc.totalDamage += ds.damage;
      } else {
        sources.set(key, {
          enemy: ds.enemy,
          ability: ds.ability,
          abilityId: ds.abilityId,
          totalDamage: ds.damage,
          killCount: 0,
        });
      }
    }
  }
  for (const fight of deaths) {
    if (!fight.killedBy || !fight.killedByAbilityId) continue;
    const key = `${fight.killedBy}|${fight.killedByAbilityId}`;
    const acc = sources.get(key);
    if (acc) acc.killCount += 1;
  }

  const bySource: ThreatEntry[] = Array.from(sources.values())
    .map((acc) => {
      const damageShare = totalDamageTaken > 0 ? acc.totalDamage / totalDamageTaken : 0;
      const killShare = totalDeaths > 0 ? acc.killCount / totalDeaths : 0;
      const lookup = abilityByKey.get(`${acc.enemy}|${acc.abilityId}`);
      const nerfSuggestion = suggestAbilityNerf(lookup?.ability, damageShare, killShare);
      return {
        enemy: acc.enemy,
        ability: acc.ability,
        abilityId: acc.abilityId,
        totalDamage: Math.round(acc.totalDamage),
        damageShare: round2(damageShare),
        killCount: acc.killCount,
        killShare: round2(killShare),
        nerfSuggestion,
      };
    })
    .sort((a, b) => b.damageShare - a.damageShare);

  // Roll up per enemy archetype
  const enemyAcc = new Map<string, { totalDamage: number; killCount: number }>();
  for (const acc of sources.values()) {
    const e = enemyAcc.get(acc.enemy) ?? { totalDamage: 0, killCount: 0 };
    e.totalDamage += acc.totalDamage;
    e.killCount += acc.killCount;
    enemyAcc.set(acc.enemy, e);
  }
  const byEnemy: EnemyThreatEntry[] = Array.from(enemyAcc.entries())
    .map(([enemy, e]) => {
      const damageShare = totalDamageTaken > 0 ? e.totalDamage / totalDamageTaken : 0;
      const killShare = totalDeaths > 0 ? e.killCount / totalDeaths : 0;
      return {
        enemy,
        totalDamage: Math.round(e.totalDamage),
        damageShare: round2(damageShare),
        killCount: e.killCount,
        killShare: round2(killShare),
        nerfSuggestion: suggestEnemyNerf(killShare, damageShare),
      };
    })
    .sort((a, b) => b.killShare - a.killShare || b.damageShare - a.damageShare);

  return {
    bySource,
    byEnemy,
    totalDeaths,
    totalDamageTaken: Math.round(totalDamageTaken),
  };
}

function suggestAbilityNerf(
  ability: CombatAbility | undefined,
  damageShare: number,
  killShare: number,
): string {
  if (!ability) {
    return killShare > 0.25 || damageShare > 0.25
      ? 'Reduce base damage or extend cooldown.'
      : 'Within tolerance.';
  }

  // Top killer with one-shot risk — usually a high-baseDamage burst
  if (killShare >= 0.4) {
    if (ability.baseDamage >= 25) {
      return `Headline killer (${pct(killShare)} of deaths) — cut baseDamage from ${ability.baseDamage} to ~${Math.round(ability.baseDamage * 0.75)} or raise cooldown to ${Math.max(ability.cooldownSec, 1) * 1.5}s.`;
    }
    return `Headline killer (${pct(killShare)} of deaths) — extend cooldown or shrink hit window.`;
  }

  // High sustained damage share — usually spammed basic attacks
  if (damageShare >= 0.3 && (ability.cooldownSec === 0 || ability.cooldownSec < 1)) {
    return `Spammed source (${pct(damageShare)} of damage taken) — add a 1.5–2.0s cooldown or lower attackPowerScaling.`;
  }

  // AoE problem
  if (damageShare >= 0.25 && ability.aoeRadius > 0) {
    return `Wide AoE (${pct(damageShare)} of damage) — reduce aoeRadius from ${ability.aoeRadius} or lower baseDamage by ~20%.`;
  }

  // Long stun chain
  if (ability.appliesStun && ability.appliesStun >= 1 && (killShare >= 0.15 || damageShare >= 0.2)) {
    return `Stun-locks the player (${ability.appliesStun}s) — lower appliesStun to ${round2(ability.appliesStun * 0.6)}s.`;
  }

  // Bursty short-cooldown ability
  if (damageShare >= 0.2 && ability.cooldownSec > 0 && ability.cooldownSec < 5 && ability.baseDamage >= 20) {
    return `Burst threat — extend cooldown from ${ability.cooldownSec}s to ${round2(ability.cooldownSec * 1.5)}s or cut baseDamage by ~20%.`;
  }

  if (killShare >= 0.15 || damageShare >= 0.15) {
    return `Notable threat — minor 10–15% baseDamage trim or telegraph the wind-up.`;
  }

  return 'Within tolerance.';
}

function suggestEnemyNerf(killShare: number, damageShare: number): string {
  if (killShare >= 0.5) {
    return `Primary killer (${pct(killShare)} of deaths) — drop HP/attackPower or rework counterplay.`;
  }
  if (killShare >= 0.3) {
    return `Frequent killer (${pct(killShare)} of deaths) — small enemy nerf or better player tools.`;
  }
  if (damageShare >= 0.4) {
    return `Damage-tax enemy (${pct(damageShare)} of damage) — reduce attackPower or attackInterval.`;
  }
  return 'Within tolerance.';
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
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

// ── Feedback-Aware Comparison ────────────────────────────────────────────────

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  hitstopDurationSec: 0.05,
  cameraShakeScale: 1.0,
  baseReactionTimeSec: 0.2,
  shakeAccuracyPenalty: 0.05,
  hitRecoveryWindowSec: 0.1,
  hitRecoveryIFrames: false,
};

/**
 * Runs two simulation batches — one with feedback mechanics applied, one without —
 * and compares the results to quantify how UCombatFeedbackComponent parameters
 * affect player survival, DPS, and reaction windows.
 */
export function runFeedbackComparison(
  scenario: CombatScenario,
  tuning: TuningOverrides,
  config: CombatSimConfig,
  feedbackConfig: FeedbackConfig,
): FeedbackComparisonResult {
  // Run baseline (no feedback)
  const baseResult = runCombatSimulation(scenario, tuning, config);

  // Run with feedback — apply feedback-derived tuning adjustments
  const feedbackTuning = applyFeedbackToTuning(tuning, feedbackConfig);
  const feedbackResult = runCombatSimulation(scenario, feedbackTuning, config);

  const withFeedback = buildFeedbackSummary(feedbackResult, feedbackConfig);
  const withoutFeedback = buildFeedbackSummary(baseResult, {
    ...feedbackConfig,
    hitstopDurationSec: 0,
    cameraShakeScale: 0,
    shakeAccuracyPenalty: 0,
    hitRecoveryWindowSec: 0,
    hitRecoveryIFrames: false,
  });

  const deltas = {
    survivalRateDelta: round2(withFeedback.survivalRate - withoutFeedback.survivalRate),
    durationDelta: round2(withFeedback.avgDurationSec - withoutFeedback.avgDurationSec),
    dpsDelta: round2(withFeedback.avgDPS - withoutFeedback.avgDPS),
    damageTakenDelta: round2(withFeedback.avgDamageTaken - withoutFeedback.avgDamageTaken),
  };

  const insights = generateFeedbackInsights(withFeedback, withoutFeedback, deltas, feedbackConfig);

  return { withFeedback, withoutFeedback, deltas, insights };
}

function applyFeedbackToTuning(tuning: TuningOverrides, fc: FeedbackConfig): TuningOverrides {
  // Hitstop extends effective reaction time, reducing enemy damage slightly
  // Camera shake introduces accuracy penalty, reducing enemy effective DPS
  // Recovery windows with i-frames reduce damage taken
  const shakePenalty = 1 - (fc.shakeAccuracyPenalty * Math.min(fc.cameraShakeScale, 5) / 5);
  const recoveryReduction = fc.hitRecoveryIFrames ? (1 - fc.hitRecoveryWindowSec * 0.5) : 1;

  return {
    ...tuning,
    enemyDamageMul: round2(tuning.enemyDamageMul * shakePenalty * recoveryReduction),
  };
}

function buildFeedbackSummary(result: SimulationResult, fc: FeedbackConfig): FeedbackSimSummary {
  const s = result.summary;
  const avgHits = s.avgDamageDealt > 0
    ? result.fights.reduce((sum, f) => sum + f.totalHits, 0) / result.fights.length
    : 0;

  return {
    survivalRate: s.survivalRate,
    avgDurationSec: s.avgFightDurationSec,
    avgDPS: s.avgDPS,
    avgDamageTaken: s.avgDamageTaken,
    avgDodgesFromHitstop: round2(avgHits * fc.hitstopDurationSec * 2),
    avgMissesFromShake: round2(avgHits * fc.shakeAccuracyPenalty * Math.min(fc.cameraShakeScale, 5) / 5),
    avgTotalHitstopSec: round2(avgHits * fc.hitstopDurationSec),
    avgEffectiveReactionSec: round2(fc.hitstopDurationSec + fc.baseReactionTimeSec),
  };
}

function generateFeedbackInsights(
  on: FeedbackSimSummary,
  off: FeedbackSimSummary,
  deltas: { survivalRateDelta: number; durationDelta: number; dpsDelta: number; damageTakenDelta: number },
  fc: FeedbackConfig,
): FeedbackInsight[] {
  const insights: FeedbackInsight[] = [];

  // Survival change
  if (deltas.survivalRateDelta > 0.05) {
    insights.push({
      severity: 'positive',
      category: 'survival',
      message: `Feedback mechanics improve survival by ${(deltas.survivalRateDelta * 100).toFixed(1)}% — hitstop and recovery windows give players time to react.`,
    });
  } else if (deltas.survivalRateDelta < -0.05) {
    insights.push({
      severity: 'warning',
      category: 'survival',
      message: `Feedback mechanics reduce survival by ${(Math.abs(deltas.survivalRateDelta) * 100).toFixed(1)}% — extended fight duration may expose players to more cumulative damage.`,
    });
  }

  // Hitstop analysis
  if (on.avgTotalHitstopSec > on.avgDurationSec * 0.2) {
    insights.push({
      severity: 'critical',
      category: 'hitstop',
      message: `${((on.avgTotalHitstopSec / on.avgDurationSec) * 100).toFixed(1)}% of fight time is hitstop freeze frames — combat may feel sluggish. Reduce hitstopDurationSec below ${(fc.hitstopDurationSec * 0.5 * 1000).toFixed(0)}ms.`,
    });
  } else if (on.avgTotalHitstopSec > on.avgDurationSec * 0.1) {
    insights.push({
      severity: 'warning',
      category: 'hitstop',
      message: `Hitstop accounts for ${((on.avgTotalHitstopSec / on.avgDurationSec) * 100).toFixed(1)}% of fight time — approaching the threshold where combat feels interrupted.`,
    });
  }

  // Camera shake
  if (on.avgMissesFromShake > 3) {
    insights.push({
      severity: 'warning',
      category: 'camera-shake',
      message: `Camera shake causes ~${on.avgMissesFromShake.toFixed(1)} misses per fight — high shake scales may frustrate players. Consider reducing cameraShakeScale.`,
    });
  }

  // Recovery i-frames
  if (fc.hitRecoveryIFrames && fc.hitRecoveryWindowSec > 0.2) {
    insights.push({
      severity: 'warning',
      category: 'recovery',
      message: `Recovery i-frames with ${(fc.hitRecoveryWindowSec * 1000).toFixed(0)}ms window make the player effectively invulnerable for extended periods. This may trivialize multi-hit combos.`,
    });
  }

  // DPS impact
  if (Math.abs(deltas.dpsDelta) > 5) {
    const direction = deltas.dpsDelta > 0 ? 'increases' : 'decreases';
    insights.push({
      severity: deltas.dpsDelta > 0 ? 'positive' : 'warning',
      category: 'dps',
      message: `Feedback ${direction} average DPS by ${Math.abs(deltas.dpsDelta).toFixed(1)} — ${deltas.dpsDelta > 0 ? 'extended windows allow better ability usage' : 'hitstop reduces effective attack speed'}.`,
    });
  }

  // Effective reaction window
  const effectiveReaction = on.avgEffectiveReactionSec * 1000;
  if (effectiveReaction > 400) {
    insights.push({
      severity: 'positive',
      category: 'reaction',
      message: `Effective reaction window is ${effectiveReaction.toFixed(0)}ms (hitstop + base reaction) — comfortable for most players to dodge telegraphed attacks.`,
    });
  } else if (effectiveReaction < 200) {
    insights.push({
      severity: 'warning',
      category: 'reaction',
      message: `Effective reaction window is only ${effectiveReaction.toFixed(0)}ms — too fast for average human reaction. Increase hitstopDurationSec or baseReactionTimeSec.`,
    });
  }

  return insights;
}

// ── A/B Run Comparison ───────────────────────────────────────────────────────

/**
 * Identity key for an alert across two runs. Single-instance alert kinds
 * (one-shot, survival-low, …) collapse to their `type`. `ability-unused`
 * fires once per ability, so it is keyed by its (stable) message, which
 * embeds the ability name.
 */
function alertIdentity(alert: BalanceAlert): string {
  return alert.type === 'ability-unused'
    ? `ability-unused::${alert.message}`
    : alert.type;
}

const ALERT_STATUS_ORDER: Record<AlertDiffStatus, number> = {
  appeared: 0,
  persisted: 1,
  disappeared: 2,
};

const ALERT_SEVERITY_ORDER = { critical: 2, warning: 1, info: 0 } as const;

/** Diffs two alert sets into appeared / disappeared / persisted entries. */
function buildAlertDiff(baseline: BalanceAlert[], candidate: BalanceAlert[]): AlertDiffEntry[] {
  const baseMap = new Map(baseline.map((a) => [alertIdentity(a), a]));
  const candMap = new Map(candidate.map((a) => [alertIdentity(a), a]));
  const keys = new Set([...baseMap.keys(), ...candMap.keys()]);

  const entries: AlertDiffEntry[] = [];
  for (const key of keys) {
    const base = baseMap.get(key);
    const cand = candMap.get(key);
    const status: AlertDiffStatus = base && cand ? 'persisted' : cand ? 'appeared' : 'disappeared';
    const rep = cand ?? base!;
    entries.push({
      status,
      type: rep.type,
      alert: rep,
      baselineValue: base?.value,
      candidateValue: cand?.value,
    });
  }

  // Appeared (new regressions) first, then persisted, then disappeared (fixes);
  // within each group, most severe first.
  return entries.sort((a, b) => {
    const byStatus = ALERT_STATUS_ORDER[a.status] - ALERT_STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return ALERT_SEVERITY_ORDER[b.alert.severity] - ALERT_SEVERITY_ORDER[a.alert.severity];
  });
}

function toRunSnapshot(result: SimulationResult, label: string): RunSnapshot {
  return {
    label,
    summary: result.summary,
    alerts: result.alerts,
    scenario: result.scenario,
    tuning: result.tuning,
    config: result.config,
    completedAt: result.completedAt,
  };
}

/**
 * First-class A/B comparison: pin one run as the baseline, run a candidate with
 * changed tuning or enemy composition, and quantify how the headline metrics
 * (survival, DPS, duration, one-shot rate) moved, plus which balance alerts
 * appeared, disappeared, or persisted. All deltas are candidate − baseline.
 */
export function compareRuns(
  baseline: SimulationResult,
  candidate: SimulationResult,
  labels: { baseline?: string; candidate?: string } = {},
): ABComparisonResult {
  const b = baseline.summary;
  const c = candidate.summary;

  return {
    baseline: toRunSnapshot(baseline, labels.baseline ?? 'Baseline'),
    candidate: toRunSnapshot(candidate, labels.candidate ?? 'Candidate'),
    deltas: {
      survivalRateDelta: round2(c.survivalRate - b.survivalRate),
      avgDPSDelta: round2(c.avgDPS - b.avgDPS),
      avgDurationDelta: round2(c.avgFightDurationSec - b.avgFightDurationSec),
      oneShotRateDelta: round2(c.oneShotRate - b.oneShotRate),
    },
    alertDiff: buildAlertDiff(baseline.alerts, candidate.alerts),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
