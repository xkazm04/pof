/**
 * REFERENCE VALUES — the section a produce prompt carries for an INGESTED entity (/diablo W02c).
 *
 * A step's produce prompt used to cite the entity by NAME only: its own data never reached the
 * producer, so replicating a shipped game's monster meant a producer inventing a plausible stat
 * block for "Zombie" while the real one (HP 4-7, AC 5, XP 54) sat unused in the entity record.
 *
 * For an entity whose values come from a reference source this renders them, with the source row,
 * and the instruction that matters: reproduce what corresponds, never rebalance it, and write an
 * explicit gap where the step needs something the reference does not state. An entity without a
 * reference gets no section at all, so PoF's own prompts are byte-identical.
 */
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const MAX_CHARS = 2000;

function renderValue(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => (typeof x === 'object' && x !== null
      ? 'label' in x && 'value' in x ? `${String((x as { label: unknown }).label)}: ${String((x as { value: unknown }).value)}` : JSON.stringify(x)
      : String(x)));
    return parts.length ? parts.join(' · ') : null;
  }
  return JSON.stringify(v);
}

export function referenceValuesBlock(entity: LabEntity): string {
  const ref = entity.reference;
  if (!ref) return '';
  const data = (entity.data ?? {}) as Record<string, unknown>;
  const lines = Object.entries(data)
    .filter(([k]) => k !== 'sourced')
    .map(([k, v]) => {
      const r = renderValue(v);
      return r ? `- ${k}: ${r}` : null;
    })
    .filter((l): l is string => !!l);
  let body = lines.join('\n');
  if (body.length > MAX_CHARS) body = `${body.slice(0, MAX_CHARS)}\n- … (truncated at ${MAX_CHARS} characters)`;
  return [
    `# REFERENCE VALUES — ${ref.sourceGame} · ${ref.sourceFile} (${ref.sourceRow})`,
    `This entity replicates a shipped game: "${entity.name}". Where a field of this step corresponds to a value below,`,
    'REPRODUCE the value exactly — do not rebalance it or invent a replacement. Where the step needs something the reference',
    'does not state, write an explicit gap (e.g. "not in the reference") instead of a plausible number.',
    body || '- (no values recorded)',
  ].join('\n');
}
