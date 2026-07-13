/**
 * Catalog → combat-sim enemy adapter (phase 1: bestiary → EnemyArchetype).
 *
 * The combat simulator ran on the HAND-AUTHORED `ENEMY_ARCHETYPES` in
 * ./definitions, divorced from the real catalogs — so a designer tuning a
 * bestiary row in the /layout lab saw nothing move in the balance tool. This
 * pure adapter hydrates the sim's enemy config (`EnemyArchetype`, the shape the
 * engine resolves per `scenario.enemies[].archetypeId`) straight from a bestiary
 * catalog entity's stored pipeline artifacts.
 *
 * Canon: `proj-sot` / `char-stat-source` — the catalog stat rows (which mirror
 * DT_AttributeDefaults) are the source of truth, not these constants. This reads
 * the APP-SIDE artifacts (pipeline_artifacts, `data` blobs authored by the
 * bestiary pipeline in src/lib/catalog/pipelines/bestiary.ts), never live UE
 * DataTables — the sim is app-side.
 *
 * Pure + deterministic: no DB, no I/O. Callers pass the already-loaded artifact
 * rows (e.g. from `listArtifacts('bestiary', entityId)`). Missing/partial data
 * degrades gracefully — `bestiaryToEnemyArchetype` returns an `err`, and
 * `buildEnemyRegistry` simply omits the failed entity, so the engine falls back
 * to the hardcoded defaults and still runs stand-alone.
 *
 * PHASE 1 covers bestiary → enemy only. Items/gear/player hydration are
 * follow-ups and are intentionally not attempted here.
 */
import type {
  AttributeSet,
  AttributeKey,
  CombatAbility,
  EnemyArchetype,
  CombatScenario,
  GearLoadout,
} from '@/types/combat-simulator';
import { type Result, ok, err } from '@/types/result';
import {
  ENEMY_ARCHETYPE_BY_ID,
  PLAYER_ABILITIES,
  GEAR_LOADOUTS,
} from './definitions';

// ── Inputs ───────────────────────────────────────────────────────────────────

/** Minimal shape of a stored bestiary pipeline artifact (a `PipelineArtifact`). */
export interface BestiaryArtifactLike {
  step: string;
  data: Record<string, unknown>;
}

/** The catalog entity being hydrated (id + display name). */
export interface CatalogEnemyEntity {
  id: string;
  name: string;
}

export interface HydrateOptions {
  /** archetypeId to assign (scenario refers to this). Default = slug(entity.id). */
  archetypeId?: string;
  /** Crit chance 0–1. Bestiary rows don't author crit, so this is an adapter default. */
  critChance?: number;
  /** Crit damage multiplier. Adapter default (not catalog-authored). */
  critDamage?: number;
}

// ── Bestiary artifact field shapes (as authored by the pipeline) ─────────────

interface BestiaryStats {
  health: number; damage: number; armor: number; moveSpeed: number;
  monsterLevel?: number; dangerRank?: number;
}
interface BehaviorAttack {
  name: string; telegraphMs?: number; activeMs?: number; recoveryMs?: number;
  range?: number; weight?: number;
}
interface BestiaryBehavior {
  aggroRange?: number; archetype?: string; attacks?: BehaviorAttack[];
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Pick the first artifact whose `data` carries `field` (steps are label-keyed, field-tagged). */
function pick<T>(artifacts: readonly BestiaryArtifactLike[], field: string): T | undefined {
  for (const a of artifacts) {
    const v = a.data?.[field];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

// ── Ability mapping ──────────────────────────────────────────────────────────

const AOE_RE = /slam|nova|shock|wave|aoe|blast|quake|stomp/i;

/**
 * Build the enemy's CombatAbility list from its telegraphed attack set. Damage
 * lives in ONE place — `baseAttributes.attackPower` (= authored `stats.damage`);
 * each attack scales it (basic ×1.0, committed AoE ×1.3) so tuning the stat row
 * moves every hit. Situational AoEs carry a cooldown so the engine's "first
 * affordable, off-cooldown" picker weaves them, not spams them.
 */
function mapAbilities(idBase: string, attacks: BehaviorAttack[] | undefined): CombatAbility[] {
  if (!attacks || attacks.length === 0) {
    return [{
      id: `${idBase}-strike`, name: 'Strike', type: 'melee',
      baseDamage: 0, attackPowerScaling: 1.0, manaCost: 0,
      cooldownSec: 0, castTimeSec: 0.5, range: 200, aoeRadius: 0,
    }];
  }
  // Primary (highest selection weight) first so the picker defaults to it.
  const ordered = [...attacks].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  return ordered.map((atk, i) => {
    const isAoe = AOE_RE.test(atk.name);
    const range = num(atk.range) ?? (isAoe ? 320 : 200);
    return {
      id: `${idBase}-${slug(atk.name) || `atk${i}`}`,
      name: atk.name,
      type: isAoe ? 'aoe' : 'melee',
      baseDamage: 0,
      attackPowerScaling: isAoe ? 1.3 : 1.0,
      manaCost: 0,
      // Committed AoEs telegraph + recover, so gate them behind a cooldown.
      cooldownSec: isAoe ? Math.max(4, Math.round((num(atk.recoveryMs) ?? 4000) / 1000)) : 0,
      castTimeSec: (num(atk.telegraphMs) ?? 500) / 1000,
      range,
      aoeRadius: isAoe ? range : 0,
    };
  });
}

// ── Public adapter ───────────────────────────────────────────────────────────

/**
 * Map a bestiary entity's stored artifacts → an `EnemyArchetype` the sim engine
 * can resolve. Requires at least a populated Stat Block (`data.stats` with
 * health/damage/armor); everything else degrades to sensible, documented
 * defaults. Returns `err` (never throws) when the core stats are absent.
 */
export function bestiaryToEnemyArchetype(
  entity: CatalogEnemyEntity,
  artifacts: readonly BestiaryArtifactLike[],
  opts: HydrateOptions = {},
): Result<EnemyArchetype, string> {
  const stats = pick<Partial<BestiaryStats>>(artifacts, 'stats');
  const health = num(stats?.health);
  const damage = num(stats?.damage);
  const armor = num(stats?.armor);
  if (health === null || damage === null || armor === null) {
    return err(
      `bestiary entity "${entity.id}" is missing a populated Stat Block ` +
      `(need numeric stats.health/damage/armor) — cannot hydrate enemy config`,
    );
  }

  const id = opts.archetypeId ?? (slug(entity.id) || slug(entity.name));
  const behavior = pick<BestiaryBehavior>(artifacts, 'behavior');
  const dangerRank = num(stats?.dangerRank) ?? 3;

  const baseAttributes: AttributeSet = {
    health, maxHealth: health,
    mana: 0, maxMana: 0,
    // Bestiary rows author no STR/DEX/INT — the sim's damage model reads only
    // attackPower/armor/crit, so these stay 0 (honest: not catalog-sourced).
    strength: 0, dexterity: 0, intelligence: 0,
    armor,
    attackPower: damage,
    critChance: opts.critChance ?? 0.05,
    critDamage: opts.critDamage ?? 1.5,
  };

  // Per-level scaling ≈ ARPG-LAWS §6c rates off the authored (monster-level)
  // baseline. The default scenario entry uses level 1 (base = authored); this
  // only kicks in when a designer bumps the encounter level.
  const levelScaling: Partial<Record<AttributeKey, number>> = {
    maxHealth: Math.max(1, Math.round(health * 0.06)),
    health: Math.max(1, Math.round(health * 0.06)),
    attackPower: Math.max(1, Math.round(damage * 0.05)),
    armor: Math.max(0, Math.round(armor * 0.04)),
  };

  const abilities = mapAbilities(id, behavior?.attacks);
  const primary = abilities[0];
  // Attack cadence ≈ the primary attack's full telegraph→active→recovery loop.
  const primaryAtk = (behavior?.attacks ?? []).find((a) => a.name === primary.name);
  const attackIntervalSec = primaryAtk
    ? Math.max(0.8, ((num(primaryAtk.telegraphMs) ?? 500) + (num(primaryAtk.activeMs) ?? 150) + (num(primaryAtk.recoveryMs) ?? 500)) / 1000)
    : 1.8;

  return ok({
    id,
    name: entity.name,
    baseAttributes,
    levelScaling,
    abilities,
    attackIntervalSec: Math.round(attackIntervalSec * 10) / 10,
    aggroRange: num(behavior?.aggroRange) ?? 800,
    // XP derived from the stat weight (health + burst), scaled by legibility rank.
    xpReward: Math.max(1, Math.round((health / 10 + damage) * (1 + dangerRank / 10))),
  });
}

// ── Engine wiring helpers ─────────────────────────────────────────────────────

/**
 * Merge hydrated archetypes OVER the hardcoded defaults into a lookup for the
 * engine (`runCombatSimulation(..., registry)` / `runCombatSimulationBatched(
 * ..., { archetypes })`). Passing `[]` (no successful hydration) yields exactly
 * the defaults — the graceful fallback: the sim still runs stand-alone.
 */
export function buildEnemyRegistry(
  hydrated: readonly EnemyArchetype[],
): Map<string, EnemyArchetype> {
  const map = new Map<string, EnemyArchetype>(ENEMY_ARCHETYPE_BY_ID);
  for (const a of hydrated) map.set(a.id, a);
  return map;
}

/**
 * A ready-to-run single-enemy scenario for a hydrated archetype (level 1, so the
 * authored monster-level stats apply verbatim). Uses the given player abilities
 * + gear, defaulting to a basic melee/ranged/dodge kit on Starter Gear.
 */
export function defaultScenarioForArchetype(
  archetype: EnemyArchetype,
  opts: {
    playerLevel?: number;
    count?: number;
    gear?: GearLoadout;
    playerAbilities?: CombatAbility[];
  } = {},
): CombatScenario {
  const gear = opts.gear ?? GEAR_LOADOUTS.find((g) => g.id === 'starter') ?? GEAR_LOADOUTS[0];
  const abilities = opts.playerAbilities
    ?? PLAYER_ABILITIES.filter((a) => ['ga-melee-attack', 'ga-fireball', 'ga-dodge'].includes(a.id));
  return {
    name: `${archetype.name} (catalog)`,
    playerLevel: opts.playerLevel ?? 5,
    playerGear: gear,
    playerAbilities: abilities,
    enemies: [{ archetypeId: archetype.id, count: opts.count ?? 1, level: 1 }],
  };
}
