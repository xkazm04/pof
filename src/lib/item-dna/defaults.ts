/** ── Item Genome Defaults & Sanitization ──────────────────────────────────── *
 * Mirrors the character-genome `sanitizeGenome` (src/lib/genome/defaults.ts) for
 * the item DNA side, which previously had no validation layer. Used when
 * importing item genomes from a shared build code or pasted JSON so that
 * malformed / partial data is coerced into a safe ItemGenome instead of
 * crashing the editor.
 * ────────────────────────────────────────────────────────────────────────── */

import { MODULE_COLORS } from '@/lib/chart-colors';
import type {
  ItemGenome, TraitGene, TraitAxis, MutationConfig, EvolutionState,
} from '@/types/item-genome';

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const TRAIT_AXES: TraitAxis[] = ['offensive', 'defensive', 'utility', 'economic'];
export const ITEM_TYPES: ItemGenome['itemType'][] = ['Weapon', 'Armor', 'Consumable', 'Material', 'Accessory'];
export const ITEM_RARITIES: ItemGenome['minRarity'][] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

export const DEFAULT_TRAITS: TraitGene[] = TRAIT_AXES.map((axis) => ({ axis, weight: 0.25, affinityTags: [] }));
export const DEFAULT_MUTATION: MutationConfig = { mutationRate: 0.08, maxMutations: 1, wildMutation: false };

export function createItemId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sanitizeTraits(raw: unknown): TraitGene[] {
  const byAxis = new Map<TraitAxis, TraitGene>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry == null || typeof entry !== 'object') continue;
      const t = entry as Record<string, unknown>;
      const axis = t.axis as TraitAxis;
      if (!TRAIT_AXES.includes(axis)) continue;
      const weight = isFiniteNumber(t.weight) ? clamp01(t.weight) : 0.25;
      const affinityTags = Array.isArray(t.affinityTags)
        ? (t.affinityTags as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
      byAxis.set(axis, { axis, weight, affinityTags });
    }
  }
  // Always return exactly the four canonical axes, filling gaps with defaults.
  return TRAIT_AXES.map((axis) => byAxis.get(axis) ?? { axis, weight: 0.25, affinityTags: [] });
}

function sanitizeMutation(raw: unknown): MutationConfig {
  const o = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    mutationRate: isFiniteNumber(o.mutationRate) ? clamp01(o.mutationRate) : DEFAULT_MUTATION.mutationRate,
    maxMutations: isFiniteNumber(o.maxMutations) ? Math.max(0, Math.round(o.maxMutations)) : DEFAULT_MUTATION.maxMutations,
    wildMutation: typeof o.wildMutation === 'boolean' ? o.wildMutation : DEFAULT_MUTATION.wildMutation,
  };
}

function sanitizeEvolution(raw: unknown): EvolutionState | undefined {
  if (raw == null || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return {
    usageCount: isFiniteNumber(o.usageCount) ? Math.max(0, Math.round(o.usageCount)) : 0,
    evolutionXP: isFiniteNumber(o.evolutionXP) ? Math.max(0, o.evolutionXP) : 0,
    tier: isFiniteNumber(o.tier) ? Math.max(0, Math.min(3, Math.round(o.tier))) : 0,
    dominantTraits: Array.isArray(o.dominantTraits)
      ? (o.dominantTraits as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/* ── Public sanitizer ──────────────────────────────────────────────────────── */

/**
 * Validate and deeply sanitize a raw parsed object into a safe ItemGenome.
 * Returns `{ genome, warnings }` on success or `{ error }` if the data is
 * irrecoverably invalid (e.g. missing name). A fresh id and updatedAt are
 * always assigned so imports never collide with existing genomes.
 */
export function sanitizeItemGenome(
  raw: unknown,
): { genome: ItemGenome; warnings: string[] } | { error: string } {
  if (raw == null || typeof raw !== 'object') return { error: 'Parsed data is not an object' };
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return { error: 'Invalid item genome: missing or empty "name" field' };
  }

  const warnings: string[] = [];
  if (!Array.isArray(obj.traits)) warnings.push('Missing "traits" — using an even 25% split');
  if (obj.mutation == null || typeof obj.mutation !== 'object') warnings.push('Missing "mutation" config — using defaults');

  let itemType: ItemGenome['itemType'] = 'Weapon';
  if (ITEM_TYPES.includes(obj.itemType as ItemGenome['itemType'])) {
    itemType = obj.itemType as ItemGenome['itemType'];
  } else if (obj.itemType !== undefined) {
    warnings.push(`Unknown itemType "${String(obj.itemType)}" — defaulting to Weapon`);
  }

  let minRarity: ItemGenome['minRarity'] = 'Common';
  if (ITEM_RARITIES.includes(obj.minRarity as ItemGenome['minRarity'])) {
    minRarity = obj.minRarity as ItemGenome['minRarity'];
  } else if (obj.minRarity !== undefined) {
    warnings.push(`Unknown minRarity "${String(obj.minRarity)}" — defaulting to Common`);
  }

  const genome: ItemGenome = {
    id: createItemId(),
    name: obj.name.trim(),
    description: typeof obj.description === 'string' ? obj.description : '',
    author: typeof obj.author === 'string' ? obj.author : 'Imported',
    version: typeof obj.version === 'string' ? obj.version : '1.0.0',
    color: typeof obj.color === 'string' ? obj.color : MODULE_COLORS.core,
    updatedAt: new Date().toISOString(),
    traits: sanitizeTraits(obj.traits),
    mutation: sanitizeMutation(obj.mutation),
    itemType,
    minRarity,
    evolution: sanitizeEvolution(obj.evolution),
    tags: Array.isArray(obj.tags)
      ? (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
  };

  return { genome, warnings };
}
