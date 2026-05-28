import type { FilterAction, LootFilterRuleset } from './types';

/**
 * One row of the UE `DT_LootFilter` DataTable (struct `FLootFilterRow`). Multi-value
 * axes are comma-joined strings so the table imports cleanly from CSV or JSON.
 */
export interface LootFilterDataTableRow {
  Name: string;
  Priority: number;
  Action: 'Show' | 'Hide' | 'Highlight';
  Rarities: string;
  ItemTypes: string;
  Subtypes: string;
  AffixAxes: string;
  TextColor: string;
  Sound: string;
  Beam: boolean;
}

const ACTION_LABEL: Record<FilterAction, LootFilterDataTableRow['Action']> = {
  show: 'Show', hide: 'Hide', highlight: 'Highlight',
};

/** Stable, file-safe identifier derived from a free-text name. */
export function lootFilterSlug(name: string): string {
  const s = name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s.length ? s : 'Unnamed';
}

/** UE content path for the generated DataTable asset. */
export function dataTableAssetPath(ruleset: LootFilterRuleset): string {
  return `/Game/Data/LootFilters/DT_LootFilter_${lootFilterSlug(ruleset.name)}`;
}

/** Enabled rules → ordered DataTable rows (Priority ascending, first rule = highest priority). */
export function rulesetToDataTableRows(ruleset: LootFilterRuleset): LootFilterDataTableRow[] {
  return ruleset.rules
    .filter((r) => r.enabled)
    .map((r, i) => ({
      Name: `LootRule_${i}_${lootFilterSlug(r.name)}`,
      Priority: i,
      Action: ACTION_LABEL[r.action],
      Rarities: (r.condition.rarities ?? []).join(','),
      ItemTypes: (r.condition.types ?? []).join(','),
      Subtypes: (r.condition.subtypes ?? []).join(','),
      AffixAxes: (r.condition.affixAxes ?? []).join(','),
      TextColor: r.style.color ?? '',
      Sound: r.style.sound ?? '',
      Beam: r.style.beam ?? false,
    }));
}

/** The DataTable rows serialised as UE-importable JSON. */
export function rulesetToDataTableJson(ruleset: LootFilterRuleset): string {
  return JSON.stringify(rulesetToDataTableRows(ruleset), null, 2);
}
