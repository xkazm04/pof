/**
 * Scale conversion for an ingested monster's stat row (/diablo W07, operator decision D23).
 *
 * A reference game's numbers sit on its own scale: a Diablo I monster with 4-7 HP and 2-5 damage is
 * balanced against a hero with ~70 life, while PoF's player has 100 HP and hits for tens. Copying the
 * numbers makes the monster trivial; leaving them out made it inherit PoF's defaults (the W06 zombie
 * hit for 13.5 on AttackPower 10). The conversion is DECLARED instead:
 *
 *  - each side is a named PLAYER ANCHOR (life, mean landed hit, own mitigation) — a balance figure
 *    that does not say which player it assumes is not a claim (registry: four-term-difficulty-
 *    decomposition). Player SKILL is not modelled on either side and says so;
 *  - HP scales so the player needs the SAME NUMBER OF HITS to kill the monster;
 *  - damage scales so the monster needs the SAME NUMBER OF HITS to kill the player, through the
 *    target's damage formula ((BaseDamage + AttackPower) · (1 − mitigation));
 *  - every field carries a loss grade on the closed scale full / approximate / data-only / dropped
 *    (registry: lossy-conversion-disclosure) — a range reduced to its mean is an approximation.
 *
 * Pure: the anchors are passed in. Reference values are read at run time from the operator's data
 * root (never from this repo); the target anchor is read from the UE project.
 */

export interface PlayerAnchor {
  /** Who this player is — class, level, weapon. Travels with every figure derived from it. */
  basis: string;
  /** Life at the anchor point. */
  life: number;
  /** Mean damage of one LANDED hit on an unarmoured, unresisting target. */
  hit: number;
  /** Fraction of an incoming hit the player's own mitigation removes (0 = none). */
  mitigation: number;
}

export type ConversionGrade = 'full' | 'approximate' | 'data-only' | 'dropped';
export interface ConversionLoss { field: string; grade: ConversionGrade; reason: string }

export interface ReferenceMonster {
  hp: { min: number; max: number };
  damage: { min: number; max: number };
  /** Per-element damage reduction in PERCENT (the diablo1 resistance law: normal / resist / immune). */
  resist: Record<string, number>;
}

export interface ConvertedStatRow {
  maxHealth: number;
  /** The monster's melee BaseDamage — the whole of its hit, since `attackPower` is zeroed. */
  baseDamage: number;
  attackPower: number;
  /** Per-element damage reduction as a FRACTION, capped at the engine's clamp. */
  resist: Record<string, number>;
}

/** UARPGDamageExecution clamps every elemental resistance to [0, 0.9]. */
export const UE_RESISTANCE_CAP = 0.9;

const mean = (r: { min: number; max: number }) => (r.min + r.max) / 2;

function assertAnchor(side: string, a: PlayerAnchor): void {
  if (!(a.life > 0)) throw new Error(`${side} anchor life must be > 0 (got ${a.life}) — no scale can be derived from it`);
  if (!(a.hit > 0)) throw new Error(`${side} anchor hit must be > 0 (got ${a.hit}) — no scale can be derived from it`);
  if (!(a.mitigation >= 0 && a.mitigation < 1)) throw new Error(`${side} anchor mitigation must be in [0, 1) (got ${a.mitigation})`);
}

export function convertMonsterScale(m: ReferenceMonster, from: PlayerAnchor, to: PlayerAnchor) {
  assertAnchor('reference', from);
  assertAnchor('target', to);

  const playerHits = mean(m.hp) / from.hit;
  const maxHealth = playerHits * to.hit;

  // Fraction of the player's life one landed monster hit takes, on the reference side.
  const lifeShare = (mean(m.damage) * (1 - from.mitigation)) / from.life;
  const attackPower = 0;
  const baseDamage = (lifeShare * to.life) / (1 - to.mitigation) - attackPower;

  const resist: Record<string, number> = {};
  const ledger: ConversionLoss[] = [
    { field: 'maxHealth', grade: 'approximate', reason: `the reference rolls HP per spawn in [${m.hp.min}, ${m.hp.max}]; the row holds one value, the mean, scaled to keep hits-to-kill` },
    { field: 'baseDamage', grade: 'approximate', reason: 'the reference rolls damage per hit in a range; PoF enemy melee takes ONE BaseDamage, the mean, scaled to keep hits-to-kill-the-player' },
    { field: 'attackPower', grade: 'full', reason: 'zeroed on purpose: the damage formula adds AttackPower to every hit, so BaseDamage carries the whole hit' },
    { field: 'toHit', grade: 'dropped', reason: 'the reference misses by a to-hit roll against the player\'s armour class; PoF melee always lands — the conversion is per LANDED hit' },
  ];
  for (const [el, pct] of Object.entries(m.resist)) {
    const frac = pct / 100;
    resist[el] = Math.min(frac, UE_RESISTANCE_CAP);
    ledger.push(frac > UE_RESISTANCE_CAP
      ? { field: `resist.${el}`, grade: 'approximate', reason: `${pct}% exceeds the engine cap (${UE_RESISTANCE_CAP * 100}%): an immune monster still takes ${Math.round((1 - UE_RESISTANCE_CAP) * 100)}%` }
      : { field: `resist.${el}`, grade: 'full', reason: `${pct}% reduction carried as the fraction ${frac}` });
  }

  const landed = (baseDamage + attackPower) * (1 - to.mitigation);
  return {
    row: { maxHealth, baseDamage, attackPower, resist } satisfies ConvertedStatRow,
    ledger,
    basis: {
      from: from.basis,
      to: to.basis,
      skill: 'player skill is unestimated on both sides — hits-to-kill is a power-only equivalence',
    },
    invariants: {
      playerHitsToKill: { reference: playerHits, converted: maxHealth / to.hit },
      monsterHitsToKillPlayer: { reference: from.life / (mean(m.damage) * (1 - from.mitigation)), converted: to.life / landed },
    },
  };
}

/**
 * The Diablo I reference hero at level 1, derived from DevilutionX's class table and starting weapon.
 * Life: `adjLife + lvlLife·clvl + chrLife·baseVit` (DevilutionX `Player::calculateBaseLife`).
 * Hit: the weapon's mean damage plus the strength bonus `clvl·str/100` (integer). Armour class only
 * changes the chance to be hit in Diablo, never the damage, so mitigation is 0.
 */
export function diabloReferencePlayer(input: {
  className: string;
  attributes: Record<string, string>;
  weapon: { name: string; minDamage: number; maxDamage: number };
  level?: number;
}): PlayerAnchor {
  const clvl = input.level ?? 1;
  const num = (k: string) => {
    const v = input.attributes[k];
    if (v === undefined || v.trim() === '' || !Number.isFinite(Number(v))) {
      throw new Error(`class table for ${input.className} has no numeric ${k} — refusing to default it`);
    }
    return Number(v);
  };
  const life = num('adjLife') + num('lvlLife') * clvl + num('chrLife') * num('baseVit');
  const hit = mean({ min: input.weapon.minDamage, max: input.weapon.maxDamage }) + Math.floor((clvl * num('baseStr')) / 100);
  return { basis: `Diablo I ${input.className}, level ${clvl}, starting ${input.weapon.name}`, life, hit, mitigation: 0 };
}

/**
 * PoF's player as the TARGET anchor, read from the UE source (schema flows down from UE): life is
 * `UARPGAttributeSet`'s MaxHealth default — no character loads a stat row (W07: DT_AttributeDefaults
 * was never created), so the defaults ARE the player — and the hit is `GA_MeleeAttack`'s first combo
 * hit through `UARPGDamageExecution`: (BaseDamage + AttackPower) · (1 + critChance · critDamage)
 * expected, against an unarmoured target. Mitigation is the player's own Armor / (Armor + 100).
 */
export function uePlayerAnchor(src: { attributeSetCpp: string; meleeHeader: string }): PlayerAnchor {
  const init = (attr: string) => {
    const m = new RegExp(`Init${attr}\\(\\s*([\\d.]+)f?\\s*\\)`).exec(src.attributeSetCpp);
    if (!m) throw new Error(`UARPGAttributeSet has no Init${attr}(...) default — refusing to assume one`);
    return Number(m[1]);
  };
  const base = /float\s+BaseDamage\s*=\s*([\d.]+)f?\s*;/.exec(src.meleeHeader);
  if (!base) throw new Error('GA_MeleeAttack declares no BaseDamage default — refusing to assume one');
  const armor = init('Armor');
  return {
    basis: 'PoF player, UARPGAttributeSet attribute-set defaults, GA_MeleeAttack first combo hit, expected crit',
    life: init('MaxHealth'),
    hit: (Number(base[1]) + init('AttackPower')) * (1 + init('CriticalChance') * init('CriticalDamage')),
    mitigation: armor / (armor + 100),
  };
}
