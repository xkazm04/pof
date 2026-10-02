/**
 * The affix workbench's ONE crafting kernel: pure, seeded, React-free.
 *
 * Eligibility, the weighted pick, affix instantiation, item-level scaling, the
 * seven crafting actions and the lock model live here and nowhere else. The
 * hooks (`useCraftingEngine`, `useAffixWorkbench`) only hold state and pass
 * `Math.random`; tests and simulations pass a seeded `Rng`.
 *
 * Rules the reducer enforces:
 *  - A refusal (a precondition the item cannot meet) charges nothing and logs
 *    nothing. A failed roll (the action's successChance) is a paid attempt.
 *  - Locks are the per-affix `locked` flags. The prefix/suffix badges are
 *    derived from them (`deriveLocks`), so a badge can never claim a lock the
 *    reforge will not honour. Reforge keeps exactly the locked affixes and
 *    consumes the locks; Divine Roll and Annul & Exalt leave locked affixes alone.
 */
import type { AffixPoolEntry, CraftedAffix, Rarity } from './data';
import { AFFIX_POOL, RARITIES, RARITY_AFFIX_COUNTS, getItemLevelScaling } from './data';
import type { CraftingActionId, CraftLogEntry, CurrencyId } from './types';
import { CRAFTING_ACTIONS, CURRENCIES } from './constants';

export type Rng = () => number;
export type Wallet = Record<CurrencyId, number>;
type Costs = Partial<Record<CurrencyId, number>>;

export interface CraftState {
  affixes: CraftedAffix[];
  wallet: Wallet;
  totalSpent: Wallet;
  craftCount: number;
  log: CraftLogEntry[];
}

export interface CraftCtx { rarity: Rarity; rng: Rng; now?: () => number }

export type CraftOutcome =
  | { state: CraftState; entry: CraftLogEntry; refused?: undefined }
  | { state: CraftState; entry: null; refused: string };

const LOG_CAP = 50;
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ── Wallet ─────────────────────────────────────────────────────────── */

export function defaultWallet(): Wallet {
  return Object.fromEntries(CURRENCIES.map((c) => [c.id, c.defaultBalance])) as Wallet;
}

export function zeroWallet(): Wallet {
  return Object.fromEntries(CURRENCIES.map((c) => [c.id, 0])) as Wallet;
}

export function initialCraftState(affixes: CraftedAffix[] = []): CraftState {
  return { affixes, wallet: defaultWallet(), totalSpent: zeroWallet(), craftCount: 0, log: [] };
}

export function canAfford(wallet: Wallet, costs: Costs): boolean {
  return Object.entries(costs).every(([cid, n]) => (wallet[cid as CurrencyId] ?? 0) >= (n ?? 0));
}

/* ── Pool, pick, instantiate, scale ─────────────────────────────────── */

/** The one minRarity predicate: may this entry roll on an item of `rarity`? */
export function isEligible(a: AffixPoolEntry, rarity: Rarity): boolean {
  return RARITIES.indexOf(a.minRarity) <= RARITIES.indexOf(rarity);
}

export function eligiblePool(pool: AffixPoolEntry[], rarity: Rarity): AffixPoolEntry[] {
  return pool.filter((a) => isEligible(a, rarity));
}

export function weightedPick<T extends { weight: number }>(entries: T[], rng: Rng): T | null {
  if (entries.length === 0) return null;
  let roll = rng() * entries.reduce((s, a) => s + a.weight, 0);
  for (const a of entries) { roll -= a.weight; if (roll <= 0) return a; }
  return entries[entries.length - 1];
}

export function instantiateAffix(p: AffixPoolEntry, magnitude = round1((p.minValue + p.maxValue) / 2)): CraftedAffix {
  return { poolEntryId: p.id, tag: p.tag, displayName: p.displayName, bIsPrefix: p.bIsPrefix, magnitude, stat: p.stat, category: p.category };
}

export function rollMagnitude(p: { minValue: number; maxValue: number }, rng: Rng): number {
  return round1(p.minValue + rng() * (p.maxValue - p.minValue));
}

/** Roll one eligible affix whose tag is not in `exclude`. */
export function rollAffix(pool: AffixPoolEntry[], rarity: Rarity, exclude: Set<string>, rng: Rng): CraftedAffix | null {
  const pick = weightedPick(eligiblePool(pool, rarity).filter((a) => !exclude.has(a.tag)), rng);
  return pick ? instantiateAffix(pick, rollMagnitude(pick, rng)) : null;
}

/** Roll a fresh item: a count in the rarity's range, unique tags. `keep` seeds the item. */
export function rollItem(pool: AffixPoolEntry[], rarity: Rarity, rng: Rng, keep: CraftedAffix[] = []): CraftedAffix[] {
  const { min, max } = RARITY_AFFIX_COUNTS[rarity];
  const count = Math.max(keep.length, min + Math.floor(rng() * (max - min + 1)));
  const out = [...keep];
  const used = new Set(out.map((a) => a.tag));
  while (out.length < count) {
    const r = rollAffix(pool, rarity, used, rng);
    if (!r) break;
    out.push(r); used.add(r.tag);
  }
  return out;
}

/** The magnitude at an item level: what the budget, the C++ export and the inject all carry. */
export function scaledMagnitude(a: { magnitude: number }, itemLevel: number): number {
  return Math.round(a.magnitude * getItemLevelScaling(itemLevel) * 100) / 100;
}

/* ── Locks and hand edits ───────────────────────────────────────────── */

export function deriveLocks(s: { affixes: CraftedAffix[] } | CraftedAffix[]) {
  const affixes = Array.isArray(s) ? s : s.affixes;
  const side = (prefix: boolean) => {
    const list = affixes.filter((a) => a.bIsPrefix === prefix);
    return list.length > 0 && list.every((a) => a.locked);
  };
  return { prefixLocked: side(true), suffixLocked: side(false) };
}

/** Hand-add a pool entry at its midpoint. No-op on a duplicate tag or a full item. */
export function addAffix<S extends { affixes: CraftedAffix[] }>(s: S, entry: AffixPoolEntry, maxSlots = Infinity): S {
  if (s.affixes.length >= maxSlots || s.affixes.some((a) => a.tag === entry.tag)) return s;
  return { ...s, affixes: [...s.affixes, instantiateAffix(entry)] };
}

/* ── The reducer ────────────────────────────────────────────────────── */

type Effect = (affixes: CraftedAffix[], ctx: CraftCtx) => { affixes: CraftedAffix[]; detail: string };

/** Why an action cannot run on this item (charged nothing), or null. */
function refusal(id: CraftingActionId, affixes: CraftedAffix[], ctx: CraftCtx, pool: AffixPoolEntry[]): string | null {
  const unlocked = affixes.filter((a) => !a.locked);
  const used = new Set(affixes.map((a) => a.tag));
  switch (id) {
    case 'reforge': return null; // reforge keeps the locked affixes and fills the rest
    case 'augment':
      if (affixes.length >= RARITY_AFFIX_COUNTS[ctx.rarity].max) return 'no open slot';
      return eligiblePool(pool, ctx.rarity).some((a) => !used.has(a.tag)) ? null : 'no eligible affix left';
    case 'remove_add': return unlocked.length === 0 ? 'no unlocked affix to remove' : null;
    case 'divine_roll': return unlocked.length === 0 ? 'no unlocked affix to re-roll' : null;
    case 'lock_prefix': case 'lock_suffix': {
      const prefix = id === 'lock_prefix';
      const side = affixes.filter((a) => a.bIsPrefix === prefix);
      if (side.length === 0) return prefix ? 'no prefixes to lock' : 'no suffixes to lock';
      return side.every((a) => a.locked) ? (prefix ? 'prefixes already locked' : 'suffixes already locked') : null;
    }
    case 'unlock': return affixes.some((a) => a.locked) ? null : 'nothing is locked';
  }
}

function effect(id: CraftingActionId, pool: AffixPoolEntry[]): Effect {
  switch (id) {
    case 'reforge': return (affixes, { rarity, rng }) => {
      const locked = affixes.filter((a) => a.locked);
      const next = rollItem(pool, rarity, rng, locked).map((a) => ({ ...a, locked: false }));
      return { affixes: next, detail: `Reforged -> ${next.length - locked.length} new affixes` };
    };
    case 'augment': return (affixes, { rarity, rng }) => {
      const rolled = rollAffix(pool, rarity, new Set(affixes.map((a) => a.tag)), rng)!;
      return { affixes: [...affixes, rolled], detail: `Augmented: +${rolled.displayName}` };
    };
    case 'remove_add': return (affixes, { rarity, rng }) => {
      const unlocked = affixes.filter((a) => !a.locked);
      const removed = unlocked[Math.floor(rng() * unlocked.length)];
      const rest = affixes.filter((a) => a.tag !== removed.tag);
      const rolled = rollAffix(pool, rarity, new Set(rest.map((a) => a.tag)), rng);
      return { affixes: rolled ? [...rest, rolled] : rest, detail: `Removed ${removed.displayName}${rolled ? `, added ${rolled.displayName}` : ''}` };
    };
    case 'divine_roll': return (affixes, { rng }) => ({
      affixes: affixes.map((a) => {
        const p = pool.find((e) => e.id === a.poolEntryId);
        return a.locked || !p ? a : { ...a, magnitude: rollMagnitude(p, rng) };
      }),
      detail: 'Re-rolled unlocked magnitudes',
    });
    case 'lock_prefix': case 'lock_suffix': return (affixes) => {
      const prefix = id === 'lock_prefix';
      return { affixes: affixes.map((a) => (a.bIsPrefix === prefix ? { ...a, locked: true } : a)), detail: prefix ? 'Prefixes locked' : 'Suffixes locked' };
    };
    case 'unlock': return (affixes) => ({ affixes: affixes.map((a) => ({ ...a, locked: false })), detail: 'All locks removed' });
  }
}

/**
 * Apply one crafting action. Pure: the input state is never mutated. A refusal
 * returns the input state unchanged (`refused` names why); otherwise the costs
 * are spent, the success roll is made, and the log/craft count advance.
 */
export function applyCraft(state: CraftState, actionId: CraftingActionId, ctx: CraftCtx, pool: AffixPoolEntry[] = AFFIX_POOL): CraftOutcome {
  const action = CRAFTING_ACTIONS.find((a) => a.id === actionId);
  if (!action) return { state, entry: null, refused: `unknown action ${actionId}` };
  if (!canAfford(state.wallet, action.costs)) return { state, entry: null, refused: 'cannot afford' };
  const why = refusal(actionId, state.affixes, ctx, pool);
  if (why) return { state, entry: null, refused: why };

  const wallet = { ...state.wallet };
  const totalSpent = { ...state.totalSpent };
  for (const [cid, n] of Object.entries(action.costs) as [CurrencyId, number][]) {
    wallet[cid] = Math.max(0, wallet[cid] - n);
    totalSpent[cid] += n;
  }
  const succeeded = ctx.rng() <= action.successChance;
  const result = succeeded ? effect(actionId, pool)(state.affixes, ctx) : null;
  const entry: CraftLogEntry = {
    action: actionId, timestamp: ctx.now?.() ?? 0, spent: action.costs, success: succeeded,
    detail: result ? result.detail : `${action.name} failed (${(action.successChance * 100).toFixed(0)}% chance)`,
  };
  return {
    state: {
      affixes: result ? result.affixes : state.affixes, wallet, totalSpent,
      craftCount: state.craftCount + 1, log: [entry, ...state.log].slice(0, LOG_CAP),
    },
    entry,
  };
}
