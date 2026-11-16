/* ── Crafting Currency ──────────────────────────────────────────────────── */

export type CurrencyId = 'chaos' | 'exalted' | 'annulment' | 'divine' | 'eternal' | 'forging';

export interface CurrencyDef {
  id: CurrencyId;
  name: string;
  icon: string;
  color: string;
  description: string;
  defaultBalance: number;
}

/* ── Crafting Actions ───────────────────────────────────────────────────── */

export type CraftingActionId = 'reforge' | 'augment' | 'remove_add' | 'divine_roll' | 'lock_prefix' | 'lock_suffix' | 'unlock';

export interface CraftingActionDef {
  id: CraftingActionId;
  name: string;
  description: string;
  costs: Partial<Record<CurrencyId, number>>;
  successChance: number;
  color: string;
}

/* ── Craft Log ──────────────────────────────────────────────────────────── */

export interface CraftLogEntry {
  action: CraftingActionId;
  timestamp: number;
  spent: Partial<Record<CurrencyId, number>>;
  success: boolean;
  detail: string;
}

/* ── View Mode ──────────────────────────────────────────────────────────── */

export type ViewMode = 'workbench' | 'breakpoints';
export type PoolCategory = 'all' | 'offensive' | 'defensive' | 'utility';
