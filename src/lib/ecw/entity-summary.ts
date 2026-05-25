export interface SummaryField {
  label: string;
  value: string;
}

/** Noise keys that aren't useful in a headline summary. */
const SKIP = new Set(['id', 'color', 'icon', 'tag']);

/**
 * Headline view of an entity's `data` for the Overview surface: top-level
 * primitive fields (string/number/boolean) in declaration order, minus noise
 * keys, capped at `max`. Booleans render as yes/no. Non-objects return [].
 */
export function summarizeEntityData(data: unknown, max = 8): SummaryField[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const out: SummaryField[] = [];
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SKIP.has(key)) continue;
    if (typeof val === 'string' || typeof val === 'number') out.push({ label: key, value: String(val) });
    else if (typeof val === 'boolean') out.push({ label: key, value: val ? 'yes' : 'no' });
    if (out.length >= max) break;
  }
  return out;
}
