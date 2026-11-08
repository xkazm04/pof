/**
 * Cooldown-legal combo schedule — the ONE timing model for the combo builder.
 *
 * A cooldown is how often an actor may BEGIN an ability, so a cast starts at
 * max(previous cast end, its own cooldown ready time); the gap is a recorded wait,
 * never skipped. Damage per cast resolves through the canon kernel (`computeHit`):
 * the combo multiplier is a "more" modifier on the ability's typed bucket, and an
 * optional `defense` mitigates it — no damage formula is restated here.
 *
 * Every DPS states its basis:
 *  - burst     — one pass of the chain, from first cast to last cast end;
 *  - sustained — the chain looped (each loop is a fresh combo, so its first hit is
 *                the opener) measured over the steady period.
 *
 * Pure; the UI (ComboChainBuilder, TimelineBlock, CooldownOverlapChart) renders it.
 */
import { computeHit, type DamageType, type Defense } from '@/lib/combat/canon-kernel';
import {
  COMBO_ABILITY_MAP, type ComboAbility, type ComboChain,
} from '@/components/modules/core-engine/sub_ability/_shared/data';

export interface ComboScheduleOptions {
  /** Ability table to resolve ids against (defaults to the builder's COMBO_ABILITY_MAP). */
  abilities?: ReadonlyMap<string, ComboAbility>;
  /** Target defense for every hit (armour / resists); omitted = unmitigated. */
  defense?: Defense;
}

export interface ScheduledCast {
  ability: ComboAbility;
  /** Position within its own pass of the chain (0 = the opener). Unknown ids are skipped, so this counts resolved casts only. */
  index: number;
  /** Position of this cast's id in the RAW chain passed in (what a remove must target). */
  chainIndex: number;
  /** Loop number (0 for a one-pass schedule). */
  loop: number;
  start: number;
  end: number;
  /** Seconds spent waiting for a cooldown before this cast could begin. */
  waited: number;
  /** Id of the ability whose cooldown forced the wait; null when the cast was ready. */
  waitedOn: string | null;
  multiplier: number;
  damage: number;
}

export interface ComboSchedule {
  casts: ScheduledCast[];
  totalDamage: number;
  totalMana: number;
  /** Seconds from the first cast start to the last cast end, waits included. */
  totalDuration: number;
  totalWait: number;
  maxCooldown: number;
  /** Burst DPS (unrounded): totalDamage / totalDuration. */
  dps: number;
}

export interface SustainedCycle {
  /** Steady loop period in seconds (difference of the last two loop ends). */
  period: number;
  damagePerCycle: number;
  /** Sustained DPS (unrounded): damagePerCycle / period. */
  sustainedDps: number;
  /** Id of the ability whose cooldown caused the most wait in the steady loop; null if none. */
  binding: string | null;
}

export type ComboDpsBasis = 'burst' | 'sustained';

export interface RankedCombo {
  id: string;
  name: string;
  burstDps: number;
  sustainedDps: number;
  binding: string | null;
}

/** The opener rule, stated once: the first hit of a pass gets no combo bonus. */
export function comboMultiplierAt(ability: ComboAbility, index: number): number {
  return index === 0 ? 1.0 : ability.comboMultiplier;
}

const CANON_TYPE: Record<ComboAbility['damageType'], DamageType | null> = {
  Physical: 'Physical', Fire: 'Fire', Ice: 'Cold', Lightning: 'Lightning', None: null,
};

/** One cast's damage via the canon kernel: base bucket × the combo multiplier as a "more". */
export function comboCastDamage(ability: ComboAbility, multiplier: number, defense?: Defense): number {
  const type = CANON_TYPE[ability.damageType];
  if (!type || ability.damage <= 0) return 0;
  const bucket = { base: ability.damage, morePcts: [(multiplier - 1) * 100] };
  return computeHit({ buckets: { [type]: bucket } }, defense).total;
}

function run(ids: readonly string[], loops: number, opts: ComboScheduleOptions) {
  const table = opts.abilities ?? COMBO_ABILITY_MAP;
  const chain = ids
    .map((id, chainIndex) => ({ ability: table.get(id), chainIndex }))
    .filter((e): e is { ability: ComboAbility; chainIndex: number } => !!e.ability);
  const readyAt = new Map<string, number>();
  const casts: ScheduledCast[] = [];
  const loopEnds: number[] = [];
  /** Per loop end: each distinct ability's remaining cooldown, i.e. the schedule's whole carried state. */
  const states: number[][] = [];
  const stateIds = [...new Set(chain.map(e => e.ability.id))].sort();
  let t = 0;
  for (let loop = 0; loop < loops; loop++) {
    chain.forEach(({ ability, chainIndex }, index) => {
      const ready = readyAt.get(ability.id) ?? 0;
      const waited = ready > t ? ready - t : 0;
      const start = t + waited;
      const multiplier = comboMultiplierAt(ability, index);
      const end = start + ability.animDuration;
      casts.push({
        ability, index, chainIndex, loop, start, end, waited,
        waitedOn: waited > 0 ? ability.id : null,
        multiplier,
        damage: comboCastDamage(ability, multiplier, opts.defense),
      });
      if (ability.cooldown > 0) readyAt.set(ability.id, start + ability.cooldown);
      t = end;
    });
    loopEnds.push(t);
    states.push(stateIds.map(id => Math.max(0, (readyAt.get(id) ?? 0) - t)));
  }
  return { casts, loopEnds, states };
}

/** One cooldown-legal pass of the chain (unknown ids are skipped). */
export function scheduleCombo(ids: readonly string[], opts: ComboScheduleOptions = {}): ComboSchedule {
  const { casts } = run(ids, 1, opts);
  let totalDamage = 0, totalMana = 0, totalWait = 0, maxCooldown = 0;
  for (const c of casts) {
    totalDamage += c.damage;
    totalMana += c.ability.manaCost;
    totalWait += c.waited;
    maxCooldown = Math.max(maxCooldown, c.ability.cooldown);
  }
  const totalDuration = casts.length > 0 ? casts[casts.length - 1].end : 0;
  return {
    casts, totalDamage, totalMana, totalDuration, totalWait, maxCooldown,
    dps: totalDuration > 0 ? totalDamage / totalDuration : 0,
  };
}

/** Loop budget for the steady-state search; a chain that has not repeated by then reads its last loop. */
const MAX_SUSTAINED_LOOPS = 64;
/** Longest repeat (in loops) the steady-state search recognises. */
const MAX_REPEAT_LOOPS = 8;
const STATE_EPS = 1e-9;

const sameState = (a: readonly number[], b: readonly number[]) =>
  a.every((v, i) => Math.abs(v - b[i]) <= STATE_EPS);

/**
 * The chain looped at least `cycles` times (>= 2), then on until the carried cooldown state at a
 * loop end repeats an earlier one (the schedule is then exactly periodic); reports that steady
 * period and what binds it. A fixed window can still be inside the transient.
 */
export function sustainedCycle(
  ids: readonly string[], cycles = 6, opts: ComboScheduleOptions = {},
): SustainedCycle {
  const minLoops = Math.max(2, Math.floor(cycles));
  const loops = Math.max(minLoops, MAX_SUSTAINED_LOOPS);
  const { casts, loopEnds, states } = run(ids, loops, opts);
  if (!casts.some(c => c.loop === loops - 1)) return { period: 0, damagePerCycle: 0, sustainedDps: 0, binding: null };
  let end = loops - 1;
  let span = 1;
  search: for (let k = minLoops - 1; k < loops; k++) {
    for (let len = 1; len <= Math.min(MAX_REPEAT_LOOPS, k); len++) {
      if (sameState(states[k], states[k - len])) { end = k; span = len; break search; }
    }
  }
  const window = casts.filter(c => c.loop > end - span && c.loop <= end);
  const period = (loopEnds[end] - loopEnds[end - span]) / span;
  const damagePerCycle = window.reduce((sum, c) => sum + c.damage, 0) / span;
  const waitBy = new Map<string, number>();
  for (const c of window) if (c.waitedOn) waitBy.set(c.waitedOn, (waitBy.get(c.waitedOn) ?? 0) + c.waited);
  let binding: string | null = null;
  let most = 0;
  for (const [id, w] of waitBy) if (w > most) { most = w; binding = id; }
  return { period, damagePerCycle, sustainedDps: period > 0 ? damagePerCycle / period : 0, binding };
}

/** Both DPS bases per chain, sorted best-first on `basis` (stable on ties). */
export function rankCombos(
  chains: readonly ComboChain[], basis: ComboDpsBasis, opts: ComboScheduleOptions = {},
): RankedCombo[] {
  const rows = chains.map(c => {
    const cyc = sustainedCycle(c.abilities, 6, opts);
    return {
      id: c.id, name: c.name,
      burstDps: scheduleCombo(c.abilities, opts).dps,
      sustainedDps: cyc.sustainedDps,
      binding: cyc.binding,
    };
  });
  const key = basis === 'burst' ? 'burstDps' : 'sustainedDps';
  return rows.sort((a, b) => b[key] - a[key]);
}
