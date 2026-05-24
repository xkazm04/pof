import type { ItemGenome, TraitAxis } from '@/types/item-genome';
import type { DiffFieldSpec } from '@/lib/genome/genome-diff';
import { AXIS_CONFIGS } from './data';

/* ── Item genome diff specs ────────────────────────────────────────────────── *
 * Trait weights (shown as %), mutation config, and item meta — the fields a
 * designer actually tunes — surfaced in the import-diff preview.
 * ────────────────────────────────────────────────────────────────────────── */

function traitWeight(g: ItemGenome, axis: TraitAxis): number {
  return g.traits.find((t) => t.axis === axis)?.weight ?? 0;
}

const TRAIT_SPECS: DiffFieldSpec<ItemGenome>[] = AXIS_CONFIGS.map((cfg) => ({
  group: 'Traits',
  label: cfg.label,
  get: (g) => traitWeight(g, cfg.axis),
  percent: true,
}));

export const ITEM_DIFF_SPECS: DiffFieldSpec<ItemGenome>[] = [
  ...TRAIT_SPECS,
  { group: 'Mutation', label: 'Mutation Rate', get: (g) => g.mutation.mutationRate, percent: true },
  { group: 'Mutation', label: 'Max Mutations', get: (g) => g.mutation.maxMutations },
  { group: 'Mutation', label: 'Wild Mutation', get: (g) => g.mutation.wildMutation },
  { group: 'Meta', label: 'Item Type', get: (g) => g.itemType },
  { group: 'Meta', label: 'Min Rarity', get: (g) => g.minRarity },
];
