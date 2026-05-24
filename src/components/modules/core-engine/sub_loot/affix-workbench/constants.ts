import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_CYAN, ACCENT_EMERALD, ACCENT_PURPLE,
} from '@/lib/chart-colors';
import type { CurrencyDef, CraftingActionDef } from './types';

/* ── Accent Color ───────────────────────────────────────────────────────── */

export const ACCENT = ACCENT_EMERALD;

/* ── Currency Definitions ───────────────────────────────────────────────── */

export const CURRENCIES: CurrencyDef[] = [
  { id: 'chaos', name: 'Chaos Shard', icon: '🔴', color: STATUS_ERROR, description: 'Reforges all affixes randomly', defaultBalance: 200 },
  { id: 'exalted', name: 'Exalted Shard', icon: '🟡', color: STATUS_WARNING, description: 'Adds a single random affix', defaultBalance: 50 },
  { id: 'annulment', name: 'Annulment Shard', icon: '🟣', color: ACCENT_VIOLET, description: 'Removes a random affix', defaultBalance: 30 },
  { id: 'divine', name: 'Divine Shard', icon: '🔵', color: STATUS_INFO, description: 'Re-rolls magnitudes of existing affixes', defaultBalance: 40 },
  { id: 'eternal', name: 'Eternal Lock', icon: '🔒', color: ACCENT_PURPLE, description: 'Locks prefixes or suffixes from modification', defaultBalance: 10 },
  { id: 'forging', name: 'Forging Potential', icon: '⚡', color: ACCENT_EMERALD, description: 'Consumed by every craft — item degrades when depleted', defaultBalance: 100 },
];

/* ── Crafting Action Definitions ────────────────────────────────────────── */

export const CRAFTING_ACTIONS: CraftingActionDef[] = [
  {
    id: 'reforge', name: 'Reforge', description: 'Destroy all unlocked affixes and re-roll randomly',
    costs: { chaos: 3, forging: 8 }, successChance: 1.0, color: STATUS_ERROR,
    requiresAffixes: false, requiresSpace: false,
  },
  {
    id: 'augment', name: 'Augment', description: 'Add one random affix to an open slot',
    costs: { exalted: 1, forging: 5 }, successChance: 0.85, color: STATUS_WARNING,
    requiresAffixes: false, requiresSpace: true,
  },
  {
    id: 'remove_add', name: 'Annul & Exalt', description: 'Remove a random unlocked affix then add a new one',
    costs: { annulment: 1, exalted: 1, forging: 10 }, successChance: 0.7, color: ACCENT_ORANGE,
    requiresAffixes: true, requiresSpace: false,
  },
  {
    id: 'divine_roll', name: 'Divine Roll', description: 'Re-roll magnitudes of all affixes (keeps types)',
    costs: { divine: 1, forging: 3 }, successChance: 1.0, color: STATUS_INFO,
    requiresAffixes: true, requiresSpace: false,
  },
  {
    id: 'lock_prefix', name: 'Lock Prefixes', description: 'Protect all prefixes from modification (1 craft)',
    costs: { eternal: 1, forging: 2 }, successChance: 1.0, color: ACCENT_PURPLE,
    requiresAffixes: true, requiresSpace: false,
  },
  {
    id: 'lock_suffix', name: 'Lock Suffixes', description: 'Protect all suffixes from modification (1 craft)',
    costs: { eternal: 1, forging: 2 }, successChance: 1.0, color: ACCENT_PURPLE,
    requiresAffixes: true, requiresSpace: false,
  },
  {
    id: 'unlock', name: 'Unlock All', description: 'Remove all locks (free)',
    costs: {}, successChance: 1.0, color: STATUS_INFO,
    requiresAffixes: false, requiresSpace: false,
  },
];

/* ── Breakpoint Item Levels ─────────────────────────────────────────────── */

export const BREAKPOINT_ILVLS = [1, 10, 25, 40, 60] as const;

/* ── Category Colors ────────────────────────────────────────────────────── */

export const CATEGORY_COLORS: Record<string, string> = {
  offensive: STATUS_ERROR,
  defensive: ACCENT_EMERALD,
  utility: ACCENT_CYAN,
};

/** Get color for an affix category. */
export function getCategoryColor(category: 'offensive' | 'defensive' | 'utility'): string {
  if (category === 'offensive') return STATUS_ERROR;
  if (category === 'defensive') return STATUS_INFO;
  return ACCENT_EMERALD;
}
