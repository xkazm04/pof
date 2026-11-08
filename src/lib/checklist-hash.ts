/** Checked items per module: `{ moduleId: { itemId: checked } }`. */
export type ChecklistProgress = Record<string, Record<string, boolean>>;

/**
 * Canonical hash of the checked items, stable across key-order differences. The ONE
 * freshness key behind both staleness gates (the GDD hook and the compliance store):
 * a change here moves both, so they cannot disagree about whether a report is stale.
 */
export function hashChecklist(cp: ChecklistProgress): string {
  return Object.keys(cp)
    .sort()
    .map((m) => `${m}:${Object.keys(cp[m]).filter((k) => cp[m][k]).sort().join(',')}`)
    .join('|');
}
