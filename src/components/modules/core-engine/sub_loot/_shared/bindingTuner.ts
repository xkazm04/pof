/**
 * Binding tuner — the pure half of the Core tab's "tune an enemy's drops" loop.
 *
 * One state holds the untuned baseline roster, the tuned roster, the ONE editable
 * gold-per-rarity table (the EV panel's sell values), the focused binding and an
 * undo history. Goal-seek solves against that same gold table, and lint runs each
 * binding against the peers of its UNTUNED tier (a drop-chance edit can cross a
 * tier line; the peer group must not move with it). Pure: the store and panels
 * render it.
 */

import {
  LOOT_TIERS, computeExpectedValue, lintLootEconomy, lootTierOf, rarityBreakdown,
  type EconomyFinding, type LootTier,
} from '@/lib/loot/economy';
import { solveWeightsForTargetEV } from '@/lib/loot/auto-balancer';
import { DEFAULT_RARITY_GOLD, type EnemyLootBinding } from './data-binding';

type RarityGold = Record<string, number>;

export type TunerField = 'dropChance' | 'bonusGold';

export type TunerAction =
  | { type: 'select'; id: string | null }
  | { type: 'setField'; id: string; field: TunerField; value: number }
  | { type: 'setWeight'; id: string; index: number; value: number }
  | { type: 'setGold'; rarity: string; value: number }
  | { type: 'goalSeek'; id: string; targetEV: number }
  | { type: 'undo' }
  | { type: 'reset' };

interface TunerSnapshot {
  bindings: EnemyLootBinding[];
  rarityGold: RarityGold;
}

export interface TunerState extends TunerSnapshot {
  baseline: EnemyLootBinding[];
  baselineGold: RarityGold;
  selectedId: string | null;
  history: TunerSnapshot[];
}

export interface TunedSummary {
  evBefore: number;
  evAfter: number;
  delta: number;
  changed: Array<TunerField | 'rarityWeights'>;
}

const HISTORY_CAP = 50;
const MAX_REFINE_STEPS = 200;

export function initialTunerState(bindings: EnemyLootBinding[], rarityGold: RarityGold = DEFAULT_RARITY_GOLD): TunerState {
  return { baseline: bindings, baselineGold: rarityGold, bindings, rarityGold, selectedId: null, history: [] };
}

export function findBinding(list: readonly EnemyLootBinding[], id: string | null): EnemyLootBinding | undefined {
  return id == null ? undefined : list.find((b) => b.archetypeId === id);
}

/** Unrounded EV per kill — the precision the EV panel prints. */
export function exactEV(b: EnemyLootBinding, gold: RarityGold): number {
  return rarityBreakdown(b, gold).reduce((s, r) => s + r.contribution, 0) + b.bonusGold;
}

/** Expected kills until the first Legendary drop (Infinity when it cannot drop). */
export function killsToLegendary(b: EnemyLootBinding): number {
  const sum = b.rarityWeights.reduce((s, w) => s + w, 0);
  const p = sum > 0 ? b.dropChance * ((b.rarityWeights[4] ?? 0) / sum) : 0;
  return p > 0 ? 1 / p : Infinity;
}

/**
 * Closed-form goal-seek, then — only when its integer weights miss the target at
 * EV precision — one-point weight moves that close the gap (each strictly nearer).
 */
export function goalSeekWeights(b: EnemyLootBinding, targetEV: number, gold: RarityGold): number[] {
  const solved = solveWeightsForTargetEV(b, targetEV, gold).weights;
  if (computeExpectedValue({ ...b, rarityWeights: solved }, gold) === Math.round(targetEV)) return solved;
  let w = solved;
  let gap = Math.abs(exactEV({ ...b, rarityWeights: w }, gold) - targetEV);
  for (let step = 0; step < MAX_REFINE_STEPS; step++) {
    let best: number[] | null = null;
    for (let i = 0; i < w.length; i++) {
      if (w[i] <= 0) continue;
      for (let j = 0; j < w.length; j++) {
        if (i === j) continue;
        const next = w.map((x, k) => (k === i ? x - 1 : k === j ? x + 1 : x));
        const g = Math.abs(exactEV({ ...b, rarityWeights: next }, gold) - targetEV);
        if (g < gap - 1e-9) { gap = g; best = next; }
      }
    }
    if (!best) break;
    w = best;
  }
  return w;
}

function clampField(field: TunerField, value: number): number {
  return field === 'dropChance' ? Math.min(1, Math.max(0, value)) : Math.max(0, Math.round(value));
}

function commit(state: TunerState, next: Partial<TunerSnapshot>): TunerState {
  const snap: TunerSnapshot = { bindings: state.bindings, rarityGold: state.rarityGold };
  return { ...state, ...next, history: [...state.history, snap].slice(-HISTORY_CAP) };
}

function patchBinding(state: TunerState, id: string, patch: (b: EnemyLootBinding) => EnemyLootBinding): TunerState {
  const cur = findBinding(state.bindings, id);
  if (!cur) return state;
  const next = patch(cur);
  if (next === cur) return state;
  return commit(state, { bindings: state.bindings.map((b) => (b.archetypeId === id ? next : b)) });
}

const sameWeights = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function tunerReducer(state: TunerState, action: TunerAction): TunerState {
  switch (action.type) {
    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    case 'setField': {
      if (!Number.isFinite(action.value)) return state;
      const v = clampField(action.field, action.value);
      return patchBinding(state, action.id, (b) => (b[action.field] === v ? b : { ...b, [action.field]: v }));
    }
    case 'setWeight': {
      if (!Number.isFinite(action.value)) return state;
      const v = Math.max(0, Math.round(action.value));
      return patchBinding(state, action.id, (b) => (b.rarityWeights[action.index] === undefined || b.rarityWeights[action.index] === v
        ? b : { ...b, rarityWeights: b.rarityWeights.map((w, i) => (i === action.index ? v : w)) }));
    }
    case 'setGold': {
      if (!Number.isFinite(action.value)) return state;
      const v = Math.max(0, action.value);
      return state.rarityGold[action.rarity] === v ? state : commit(state, { rarityGold: { ...state.rarityGold, [action.rarity]: v } });
    }
    case 'goalSeek':
      if (!Number.isFinite(action.targetEV)) return state;
      return patchBinding(state, action.id, (b) => {
        const w = goalSeekWeights(b, action.targetEV, state.rarityGold);
        return sameWeights(w, b.rarityWeights) ? b : { ...b, rarityWeights: w };
      });
    case 'undo': {
      const prev = state.history[state.history.length - 1];
      if (!prev) return state;
      return { ...state, ...prev, history: state.history.slice(0, -1) };
    }
    case 'reset':
      if (state.bindings === state.baseline && state.rarityGold === state.baselineGold) return state;
      return commit(state, { bindings: state.baseline, rarityGold: state.baselineGold });
  }
}

/** EV before → after for one binding, both read against the state's gold table. */
export function tunedSummary(state: TunerState, id: string): TunedSummary | null {
  const before = findBinding(state.baseline, id);
  const after = findBinding(state.bindings, id);
  if (!before || !after) return null;
  const evBefore = computeExpectedValue(before, state.rarityGold);
  const evAfter = computeExpectedValue(after, state.rarityGold);
  const changed: TunedSummary['changed'] = [];
  if (before.dropChance !== after.dropChance) changed.push('dropChance');
  if (before.bonusGold !== after.bonusGold) changed.push('bonusGold');
  if (!sameWeights(before.rarityWeights, after.rarityWeights)) changed.push('rarityWeights');
  return { evBefore, evAfter, delta: evAfter - evBefore, changed };
}

/** Baseline bindings grouped by tier, in tier order (the header picker's optgroups). */
export function tierGroups(baseline: readonly EnemyLootBinding[]): Array<{ tier: LootTier; bindings: EnemyLootBinding[] }> {
  return LOOT_TIERS.map((tier) => ({ tier, bindings: baseline.filter((b) => lootTierOf(b.dropChance) === tier) }));
}

/** Lint every tuned binding against the tuned peers of its UNTUNED tier. */
export function rosterFindings(state: TunerState): Record<string, EconomyFinding[]> {
  const tierById = new Map(state.baseline.map((b) => [b.archetypeId, lootTierOf(b.dropChance)]));
  const out: Record<string, EconomyFinding[]> = {};
  for (const b of state.bindings) {
    const tier = tierById.get(b.archetypeId) ?? lootTierOf(b.dropChance);
    const peers = state.bindings.filter((p) => (tierById.get(p.archetypeId) ?? lootTierOf(p.dropChance)) === tier);
    out[b.archetypeId] = lintLootEconomy(b, peers, state.rarityGold);
  }
  return out;
}
