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
 * reference gets `entityValuesBlock`'s ENTITY VALUES section instead (below).
 */
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';

const MAX_CHARS = 2000;
/**
 * A REFERENCE entity's values are what the producer must reproduce, so they get a far larger budget (/diablo W16: all 8
 * Diablo town conversations, 4-12 KB each, were cut at 2000 characters — producers saw 4 of Adria's 11 gossip lines and
 * none of her quest topics, and honestly wrote the rest as gaps). Past it, the block NAMES what was left out.
 */
export const REFERENCE_MAX_CHARS = 16000;

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

/** The entity's recorded values as bounded `- key: value` lines ('' when it records none). */
export function entityValueLines(entity: LabEntity, max = MAX_CHARS): string {
  const data = (entity.data ?? {}) as Record<string, unknown>;
  const lines = Object.entries(data)
    .filter(([k]) => k !== 'sourced')
    .map(([k, v]) => {
      const r = renderValue(v);
      return r ? `- ${k}: ${r}` : null;
    })
    .filter((l): l is string => !!l);
  const body = lines.join('\n');
  if (body.length <= max) return body;
  // Keep whole lines while they fit, and name every key that did not, so a cut is never mistaken for the whole record.
  const kept: string[] = [];
  let used = 0;
  for (const l of lines) { if (used + l.length + 1 > max) break; kept.push(l); used += l.length + 1; }
  const cut = lines.slice(kept.length).map((l) => l.slice(2, l.indexOf(':')));
  return `${kept.join('\n')}\n- … (truncated at ${max} characters — NOT shown: ${cut.join(', ')})`;
}

export function referenceValuesBlock(entity: LabEntity): string {
  const ref = entity.reference;
  if (!ref) return '';
  const body = entityValueLines(entity, REFERENCE_MAX_CHARS);
  return [
    `# REFERENCE VALUES — ${ref.sourceGame} · ${ref.sourceFile} (${ref.sourceRow})`,
    `This entity replicates a shipped game: "${entity.name}". Where a field of this step corresponds to a value below,`,
    'REPRODUCE the value exactly — do not rebalance it or invent a replacement. Where the step needs something the reference',
    `does not state, write exactly "${REFERENCE_GAP}" as its value instead of a plausible number (a declared gap is graded as missing, never as filled).`,
    // /diablo W21: a unique carries its raw row AND the engine-resolved instance (`effective`); producers reproduced the raw row.
    ...((entity.data as Record<string, unknown> | undefined)?.effective
      ? ['`effective` below is what the ENGINE actually spawns (raw row + engine rules, per difficulty, single-player unless stated): for',
        'gameplay values (level, hit points, armour, to-hit, damage, resistances) reproduce `effective` (Normal difficulty), not the raw row.']
      : []),
    body || '- (no values recorded)',
  ].join('\n');
}

/**
 * ENTITY VALUES — the same section for an AUTHORED entity (/diablo W03, decision D11). PoF's own
 * entities carry design data too (an ability's damage, cooldown and element; an item's slot and
 * rarity) and it never reached their produce prompts either, so every step re-invented values the
 * entity already declares. The instruction differs from the reference one: the values are a design
 * record to stay CONSISTENT with, not a shipped game to reproduce — the direction may change one,
 * and the producer then says so.
 */
export function entityValuesBlock(entity: LabEntity): string {
  if (entity.reference) return referenceValuesBlock(entity);
  const body = entityValueLines(entity);
  if (!body) return '';
  return [
    `# ENTITY VALUES — ${entity.name} (this entity's recorded design data)`,
    'Where a field of this step corresponds to a value below, keep it CONSISTENT with that value. Change one only when the',
    'direction asks for it, and then state the change explicitly — never silently re-invent a value this entity already declares.',
    body,
  ].join('\n');
}
