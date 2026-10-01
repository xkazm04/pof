/**
 * "Price this item": what does a hand-built affix set cost to CRAFT?
 *
 * The designer's affix tags become a craft goal; a seeded Monte Carlo steps
 * the ONE crafting kernel (`applyCraft`) from a start item with a COPY of a
 * wallet until the goal is held, the wallet runs dry, or a step cap hits.
 * Pure and React-free: the live wallet is never touched.
 *
 * Spend and craft distributions are over the runs that REACHED the goal
 * (cost-to-obtain within this wallet); `null` when none did.
 */
import type { AffixPoolEntry, CraftedAffix, Rarity } from './data';
import { AFFIX_POOL, RARITY_AFFIX_COUNTS } from './data';
import type { CraftingActionId, CurrencyId } from './types';
import { CRAFTING_ACTIONS, CURRENCIES } from './constants';
import { applyCraft, canAfford, defaultWallet, isEligible, zeroWallet } from './craftingKernel';
import type { CraftCtx, CraftOutcome, CraftState, Rng, Wallet } from './craftingKernel';

export interface CraftGoal { rarity: Rarity; targetTags: string[] }

export interface Dist { mean: number; p50: number; p90: number }

export type CraftGoalReport =
  | { status: 'unreachable'; rarity: Rarity; targetTags: string[]; reason: string }
  | {
    status: 'priced'; rarity: Rarity; targetTags: string[]; runs: number;
    successRate: number;
    spend: Record<CurrencyId, Dist> | null;
    crafts: { p50: number; p90: number } | null;
    failures: { walletExhausted: number; stepCap: number; stuck: number };
  };

export type CraftStep = (state: CraftState, actionId: CraftingActionId, ctx: CraftCtx, pool?: AffixPoolEntry[]) => CraftOutcome;

export interface PriceCraftGoalArgs extends CraftGoal {
  start?: CraftedAffix[];
  wallet?: Wallet;
  runs?: number;
  rng: Rng;
  maxSteps?: number;
  pool?: AffixPoolEntry[];
  /** Injectable for tests; defaults to the kernel's `applyCraft`. */
  step?: CraftStep;
}

const DEFAULT_RUNS = 400;
const DEFAULT_MAX_STEPS = 1000;
const LOCK_COSTS = CRAFTING_ACTIONS.find((a) => a.id === 'lock_prefix')?.costs ?? {};

const holdsGoal = (affixes: CraftedAffix[], targets: string[]) => {
  const tags = new Set(affixes.map((a) => a.tag));
  return targets.every((t) => tags.has(t));
};

/**
 * The pricer's policy: null when every target is held; augment while a slot is
 * open; on a full item, free locked strays (unlock), protect a side made only
 * of targets (lock, if affordable), else annul a stray (remove_add).
 */
export function nextCraftAction(state: Pick<CraftState, 'affixes' | 'wallet'>, goal: CraftGoal): CraftingActionId | null {
  const { affixes } = state;
  if (holdsGoal(affixes, goal.targetTags)) return null;
  if (affixes.length < RARITY_AFFIX_COUNTS[goal.rarity].max) return 'augment';
  const targets = new Set(goal.targetTags);
  if (!affixes.some((a) => !targets.has(a.tag) && !a.locked)) return 'unlock';
  for (const prefix of [true, false]) {
    const side = affixes.filter((a) => a.bIsPrefix === prefix);
    const allTargets = side.length > 0 && side.every((a) => targets.has(a.tag));
    if (allTargets && !side.every((a) => a.locked) && canAfford(state.wallet, LOCK_COSTS)) {
      return prefix ? 'lock_prefix' : 'lock_suffix';
    }
  }
  return 'remove_add';
}

/** Why the crafting rules can never produce this goal on this rarity, or null. */
export function goalUnreachableReason(goal: CraftGoal, pool: AffixPoolEntry[] = AFFIX_POOL): string | null {
  const reasons: string[] = [];
  for (const tag of goal.targetTags) {
    const entry = pool.find((a) => a.tag === tag);
    if (!entry) reasons.push(`${tag} is not in the affix pool`);
    else if (!isEligible(entry, goal.rarity)) {
      reasons.push(`${entry.displayName} (${tag}) rolls only on a ${entry.minRarity} or better base; a ${goal.rarity} base never offers it`);
    }
  }
  const slots = RARITY_AFFIX_COUNTS[goal.rarity].max;
  if (goal.targetTags.length > slots) {
    reasons.push(`${goal.targetTags.length} targets but a ${goal.rarity} base has only ${slots} slots`);
  }
  return reasons.length ? reasons.join('; ') : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nearest-rank percentile of an ascending-sorted list. */
function pct(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

function dist(values: number[]): Dist {
  const sorted = [...values].sort((a, b) => a - b);
  return { mean: round1(values.reduce((s, v) => s + v, 0) / values.length), p50: pct(sorted, 0.5), p90: pct(sorted, 0.9) };
}

type RunEnd = { kind: 'success'; spent: Wallet; crafts: number } | { kind: 'walletExhausted' | 'stepCap' | 'stuck' };

function runOnce(goal: CraftGoal, start: CraftedAffix[], wallet: Wallet, ctx: CraftCtx, maxSteps: number, step: CraftStep, pool: AffixPoolEntry[]): RunEnd {
  let state: CraftState = { affixes: start, wallet: { ...wallet }, totalSpent: zeroWallet(), craftCount: 0, log: [] };
  for (let i = 0; i < maxSteps; i++) {
    const action = nextCraftAction(state, goal);
    if (!action) return { kind: 'success', spent: state.totalSpent, crafts: state.craftCount };
    const out = step(state, action, ctx, pool);
    if (out.refused) return { kind: out.refused === 'cannot afford' ? 'walletExhausted' : 'stuck' };
    state = out.state;
  }
  return holdsGoal(state.affixes, goal.targetTags)
    ? { kind: 'success', spent: state.totalSpent, crafts: state.craftCount }
    : { kind: 'stepCap' };
}

/**
 * Price a craft goal: `runs` seeded simulations from `start` with a copy of
 * `wallet`. An unreachable goal returns its reason without stepping once.
 */
export function priceCraftGoal(args: PriceCraftGoalArgs): CraftGoalReport {
  const pool = args.pool ?? AFFIX_POOL;
  const goal: CraftGoal = { rarity: args.rarity, targetTags: [...new Set(args.targetTags)] };
  const reason = goalUnreachableReason(goal, pool);
  if (reason) return { status: 'unreachable', rarity: goal.rarity, targetTags: goal.targetTags, reason };

  const runs = Math.max(1, Math.floor(args.runs ?? DEFAULT_RUNS));
  const wallet = args.wallet ?? defaultWallet();
  const ctx: CraftCtx = { rarity: goal.rarity, rng: args.rng };
  const step = args.step ?? applyCraft;
  const failures = { walletExhausted: 0, stepCap: 0, stuck: 0 };
  const wins: { spent: Wallet; crafts: number }[] = [];
  for (let r = 0; r < runs; r++) {
    const end = runOnce(goal, args.start ?? [], wallet, ctx, args.maxSteps ?? DEFAULT_MAX_STEPS, step, pool);
    if (end.kind === 'success') wins.push(end);
    else failures[end.kind]++;
  }
  const spend = wins.length
    ? Object.fromEntries(CURRENCIES.map((c) => [c.id, dist(wins.map((w) => w.spent[c.id]))])) as Record<CurrencyId, Dist>
    : null;
  const crafts = wins.length ? (({ p50, p90 }) => ({ p50, p90 }))(dist(wins.map((w) => w.crafts))) : null;
  return {
    status: 'priced', rarity: goal.rarity, targetTags: goal.targetTags, runs,
    successRate: wins.length / runs, spend, crafts, failures,
  };
}
