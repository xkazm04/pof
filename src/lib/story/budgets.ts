/**
 * `TEXT_BUDGET_EXCEEDED` (§7, §8): a node whose `text` is over its class budget.
 *
 * The budget for a node is `perClass[node.class]`, falling back to `perClass[node.kind]` (a
 * profile may budget by core kind, as §7's own example does with `event` and `choice`). An option
 * `label` is measured against `perClass.option` when the document declares one. A node with no
 * applicable budget is not measured — never treated as a budget of zero. The unit is the
 * document's (`words` | `characters`); an unknown unit counts words. Pure.
 */

import type { StoryBudgets, StoryFinding, StoryGraph } from '@/lib/story/types';
import { structural } from '@/lib/story/structure';

/** How long a text is in the budget's unit. */
export function textSize(text: string, unit: StoryBudgets['unit'] | string): number {
  if (unit === 'characters') return text.length;
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function budgetFindings(graph: StoryGraph): StoryFinding[] {
  const budgets = graph.budgets;
  const perClass = budgets?.perClass ?? {};
  const unit = budgets?.unit ?? 'words';
  const limit = (key: string | undefined): number | undefined => {
    if (key === undefined || !Object.prototype.hasOwnProperty.call(perClass, key)) return undefined;
    const v = perClass[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };

  const out: StoryFinding[] = [];
  for (const n of graph.nodes) {
    if (typeof n.text === 'string') {
      const budget = limit(n.class) ?? limit(n.kind);
      const size = textSize(n.text, unit);
      if (budget !== undefined && size > budget) {
        out.push(structural('TEXT_BUDGET_EXCEEDED', [n.id], `${n.id}: ${size} ${unit}, budget ${budget} for "${n.class ?? n.kind}"`));
      }
    }
    const optionBudget = limit('option');
    if (optionBudget === undefined) continue;
    for (const o of n.options ?? []) {
      if (typeof o.label !== 'string') continue;
      const size = textSize(o.label, unit);
      if (size > optionBudget) {
        out.push(structural('TEXT_BUDGET_EXCEEDED', [n.id], `${n.id} option ${o.id}: ${size} ${unit}, budget ${optionBudget} for "option"`));
      }
    }
  }
  return out;
}
