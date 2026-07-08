import { SUB_MODULES } from '@/lib/module-registry';

// ── Precompute checklist item IDs (static) ──
export const MODULE_ITEM_IDS: Record<string, string[]> = Object.fromEntries(
  SUB_MODULES
    .filter((m) => m.checklist && m.checklist.length > 0)
    .map((m) => [m.id, m.checklist!.map((c) => c.id)]),
);

export const EMPTY_PROGRESS: Record<string, Record<string, boolean>> = {};
