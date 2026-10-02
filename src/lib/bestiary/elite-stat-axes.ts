/**
 * One stat-axis table for elite modifiers.
 *
 * Elite modifiers key their statMods on HP/Damage/Speed/Range; most archetypes
 * carry HP/ATK/DEF/SPD/INT. Both vocabularies resolve here to one AXIS, and
 * each axis to the UARPGAttributeSet attribute it drives in UE. The card
 * preview (applyModifiers), the inert-mod report and the GameplayEffect codegen
 * all read this table, so a label is never matched by string equality again.
 *
 * Attributes are resolved schema-down (canon rule proj-sot): an axis names a
 * candidate field, and it only counts when the committed FARPGAttributeInitRow
 * snapshot has it. Range and speed have no such field today, so they resolve
 * to null and the codegen writes the contract's `// TODO: unknown attribute`.
 */
import ueSchema from '@/lib/catalog/ue-schema.generated.json';

export type StatAxis = 'hp' | 'damage' | 'speed' | 'range' | 'defense' | 'intelligence';

interface AxisDef {
  /** Every stat label, in either vocabulary, that reads this axis. */
  labels: readonly string[];
  /** The UARPGAttributeSet field this axis would drive, before the schema check. */
  candidate: string | null;
}

const AXIS_DEFS: Record<StatAxis, AxisDef> = {
  hp: { labels: ['HP'], candidate: 'MaxHealth' },
  damage: { labels: ['Damage', 'ATK'], candidate: 'AttackPower' },
  speed: { labels: ['Speed', 'SPD'], candidate: 'MoveSpeed' },
  range: { labels: ['Range'], candidate: null },
  defense: { labels: ['DEF'], candidate: 'Armor' },
  intelligence: { labels: ['INT'], candidate: 'Intelligence' },
};

/** The UE attribute-row fields the project actually declares (schema-down). */
const ATTRIBUTE_FIELDS: ReadonlySet<string> = new Set(
  (ueSchema as Record<string, string[]>).FARPGAttributeInitRow ?? [],
);

const AXIS_BY_LABEL: ReadonlyMap<string, StatAxis> = new Map(
  (Object.entries(AXIS_DEFS) as [StatAxis, AxisDef][]).flatMap(
    ([axis, def]) => def.labels.map((label) => [label, axis] as const),
  ),
);

/** The axis a stat label reads, in either vocabulary; null when it has none. */
export function statAxisOf(label: string): StatAxis | null {
  return AXIS_BY_LABEL.get(label) ?? null;
}

/**
 * The UARPGAttributeSet attribute an axis drives, or null when the project's
 * FARPGAttributeInitRow declares no such field (the codegen then writes a TODO).
 */
export function ueAttributeOf(axis: StatAxis): string | null {
  const candidate = AXIS_DEFS[axis].candidate;
  return candidate && ATTRIBUTE_FIELDS.has(candidate) ? candidate : null;
}

/** True when two stat labels read the same axis (unmapped labels match only themselves). */
export function sameStatAxis(a: string, b: string): boolean {
  const axis = statAxisOf(a);
  return axis === null ? a === b : axis === statAxisOf(b);
}

/**
 * Labels of the statMods in `mod` that change nothing on `archetype`: no stat
 * of the archetype reads the statMod's axis (e.g. '+30% Range' on an archetype
 * with no Range stat).
 */
export function inertStatMods(
  mod: { statMods: readonly { stat: string; label: string }[] },
  archetype: { stats: readonly { label: string }[] },
): string[] {
  return mod.statMods
    .filter((sm) => !archetype.stats.some((s) => sameStatAxis(s.label, sm.stat)))
    .map((sm) => sm.label);
}
