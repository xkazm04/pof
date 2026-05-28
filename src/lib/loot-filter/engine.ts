import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type {
  AffixAxis, FilterEvaluation, FilterOutcome, LootFilterCondition, LootFilterRuleset,
} from './types';

/** True when the item satisfies every populated axis of the condition (AND across, OR within). */
export function matchCondition(item: ItemData, condition: LootFilterCondition): boolean {
  const { rarities, types, subtypes, affixAxes } = condition;
  if (rarities?.length && !rarities.includes(item.rarity)) return false;
  if (types?.length && !types.includes(item.type)) return false;
  if (subtypes?.length && !subtypes.includes(item.subtype)) return false;
  if (affixAxes?.length) {
    const axes = new Set<AffixAxis>((item.affixes ?? []).map((a) => a.category));
    if (!affixAxes.some((ax) => axes.has(ax))) return false;
  }
  return true;
}

/** Resolve one item against an ordered ruleset — first enabled match wins, else default Show. */
export function evaluateItem(item: ItemData, ruleset: LootFilterRuleset): FilterOutcome {
  for (const r of ruleset.rules) {
    if (!r.enabled) continue;
    if (matchCondition(item, r.condition)) {
      return {
        item,
        action: r.action,
        visible: r.action !== 'hide',
        matchedRuleId: r.id,
        matchedRuleName: r.name,
        style: r.style,
      };
    }
  }
  return { item, action: 'show', visible: true, matchedRuleId: null, matchedRuleName: null, style: {} };
}

/** Run a ruleset over a set of items, returning per-item outcomes plus action tallies. */
export function evaluateRuleset(items: ItemData[], ruleset: LootFilterRuleset): FilterEvaluation {
  const outcomes = items.map((it) => evaluateItem(it, ruleset));
  let shown = 0, highlighted = 0, hidden = 0;
  for (const o of outcomes) {
    if (o.action === 'highlight') highlighted++;
    else if (o.action === 'hide') hidden++;
    else shown++;
  }
  return { outcomes, shown, highlighted, hidden };
}
