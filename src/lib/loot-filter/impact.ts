import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import { matchCondition } from './engine';
import type { FilterAction, FilterEvaluation, LootFilterRule } from './types';

const ENDGAME_RARITIES = new Set(['Epic', 'Legendary']);

export type RuleFlag = 'dead' | 'shadowed' | null;

/** What one rule does to the previewed drops under first-enabled-match-wins. */
export interface RuleImpact {
  ruleId: string;
  /** Items the condition matches, ignoring order. */
  matches: number;
  /** Items this rule actually claims (no earlier enabled rule matched them). */
  wins: number;
  flag: RuleFlag;
  /** For a shadowed rule: the earlier enabled rule that claims its matches. */
  shadowedBy: string | null;
}

export interface RulesetWarning {
  ruleId: string;
  count: number;
  itemNames: string[];
  message: string;
}

export interface RulesetImpact {
  rules: RuleImpact[];
  /** Items no enabled rule claims (default Show). */
  defaulted: number;
  warnings: RulesetWarning[];
}

/** Attribute every item to the rule that claims it; flag dead / shadowed rules and Hide rules that swallow epic+ drops. */
export function analyzeRuleset(items: ItemData[], rules: LootFilterRule[]): RulesetImpact {
  const wins = new Map<string, number>();
  const matches = new Map<string, number>();
  const shadowedBy = new Map<string, string>();
  const hidden = new Map<string, string[]>();
  let defaulted = 0;

  for (const it of items) {
    let winner: LootFilterRule | null = null;
    for (const r of rules) {
      if (!r.enabled || !matchCondition(it, r.condition)) continue;
      matches.set(r.id, (matches.get(r.id) ?? 0) + 1);
      if (winner) {
        if (!shadowedBy.has(r.id)) shadowedBy.set(r.id, winner.id);
      } else {
        winner = r;
      }
    }
    if (!winner) { defaulted++; continue; }
    wins.set(winner.id, (wins.get(winner.id) ?? 0) + 1);
    if (winner.action === 'hide' && ENDGAME_RARITIES.has(it.rarity)) {
      hidden.set(winner.id, [...(hidden.get(winner.id) ?? []), it.name]);
    }
  }

  const impacts = rules.map((r): RuleImpact => {
    const m = matches.get(r.id) ?? 0;
    const w = wins.get(r.id) ?? 0;
    const flag: RuleFlag = !r.enabled ? null : m === 0 ? 'dead' : w === 0 ? 'shadowed' : null;
    return { ruleId: r.id, matches: m, wins: w, flag, shadowedBy: flag === 'shadowed' ? shadowedBy.get(r.id) ?? null : null };
  });

  const warnings: RulesetWarning[] = [];
  for (const r of rules) {
    const names = hidden.get(r.id);
    if (names?.length) warnings.push({ ruleId: r.id, count: names.length, itemNames: names, message: `hides ${names.length} epic+ drops` });
  }
  return { rules: impacts, defaulted, warnings };
}

export interface ActionChange {
  itemId: string;
  name: string;
  from: FilterAction;
  to: FilterAction;
}

/** Items present in both evaluations whose resolved action differs. */
export function diffEvaluations(before: FilterEvaluation, after: FilterEvaluation): ActionChange[] {
  const prior = new Map(before.outcomes.map((o) => [o.item.id, o.action]));
  const changes: ActionChange[] = [];
  for (const o of after.outcomes) {
    const from = prior.get(o.item.id);
    if (from !== undefined && from !== o.action) changes.push({ itemId: o.item.id, name: o.item.name, from, to: o.action });
  }
  return changes;
}
