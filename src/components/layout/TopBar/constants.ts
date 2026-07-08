import { SUB_MODULES, ALL_CHECKLIST_TOTAL } from '@/lib/module-registry';

export const dropdownMotion = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] as const },
};

export const reducedDropdownMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0 },
};

// --- Project stats summary ---

// Precompute total checklist items per module (static — never changes at runtime)
export const MODULE_CHECKLIST_COUNTS: { moduleId: string; total: number }[] = SUB_MODULES
  .filter((m) => m.checklist && m.checklist.length > 0)
  .map((m) => ({ moduleId: m.id, total: m.checklist!.length }));

// Registry-derived single source of truth for the project-wide denominator.
export const TOTAL_CHECKLIST_ITEMS = ALL_CHECKLIST_TOTAL;
export const MODULE_ITEM_IDS: Record<string, string[]> = Object.fromEntries(
  SUB_MODULES
    .filter((m) => m.checklist && m.checklist.length > 0)
    .map((m) => [m.id, m.checklist!.map((c) => c.id)]),
);

export const EMPTY_PROGRESS: Record<string, Record<string, boolean>> = {};
