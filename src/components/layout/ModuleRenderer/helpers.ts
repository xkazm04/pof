import { MODULE_LABELS } from '@/lib/module-registry';

/** Labels for special categories (not sub-modules — not in MODULE_LABELS) */
const SPECIAL_CATEGORY_LABELS: Record<string, string> = {
  'project-setup': 'Project Setup',
  'evaluator': 'Evaluator',
  'game-director': 'Game Director',
};

/** Human-readable label for a module/special-category id, falling back to the id. */
export function moduleLabel(id: string): string {
  return MODULE_LABELS[id] ?? SPECIAL_CATEGORY_LABELS[id] ?? id;
}

/**
 * Promote `id` to the front of `list` (most-recently-used). If the list
 * exceeds `cap`, the tail (least-recently-used) entry is evicted.
 * Mutates `list` in place and returns true if the list changed.
 */
export function lruTouched(list: string[], id: string, cap: number): string[] | null {
  if (list[0] === id) return null; // already MRU — no change
  const next = list.filter(x => x !== id);
  next.unshift(id);
  if (next.length > cap) next.pop();
  return next;
}
