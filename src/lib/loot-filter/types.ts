import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';

/** What a matching rule does to a drop — mirrors PoE / Last Epoch Show / Hide / Highlight. */
export type FilterAction = 'show' | 'hide' | 'highlight';

/** The affix dimension a rule keys on (mirrors `ItemAffix.category`). */
export type AffixAxis = 'offensive' | 'defensive' | 'utility';

/**
 * A rule's match criteria. Axes combine OR-within / AND-across: an item matches
 * when, for every populated axis, its value is in the list. An empty or omitted
 * axis is an unconstrained wildcard.
 */
export interface LootFilterCondition {
  rarities?: string[];
  types?: string[];
  subtypes?: string[];
  /** Matches if the item carries at least one affix whose category is listed. */
  affixAxes?: AffixAxis[];
}

/** Visual / audio treatment applied to drops surfaced by a Show or Highlight rule. */
export interface LootFilterStyle {
  /** Hex text / border tint (e.g. '#FBBF24'). */
  color?: string;
  /** Alert sound id (label only — resolved to a UE cue at import). */
  sound?: string;
  /** Whether to spawn a vertical loot beam. */
  beam?: boolean;
}

/** One ordered rule. The first enabled rule that matches an item wins. */
export interface LootFilterRule {
  id: string;
  name: string;
  enabled: boolean;
  action: FilterAction;
  condition: LootFilterCondition;
  style: LootFilterStyle;
}

/** A named, ordered collection of rules — the unit exported to UE. */
export interface LootFilterRuleset {
  id: string;
  name: string;
  rules: LootFilterRule[];
  updatedAt: string;
}

/** The resolved verdict for a single item under a ruleset. */
export interface FilterOutcome {
  item: ItemData;
  action: FilterAction;
  visible: boolean;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  style: LootFilterStyle;
}

/** Aggregate of running a ruleset over a set of items. */
export interface FilterEvaluation {
  outcomes: FilterOutcome[];
  shown: number;
  highlighted: number;
  hidden: number;
}
