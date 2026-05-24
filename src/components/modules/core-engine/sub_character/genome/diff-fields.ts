import type { CharacterGenome } from '@/types/character-genome';
import type { DiffFieldSpec } from '@/lib/genome/genome-diff';
import type { FieldDef, ProfileKey } from './types';
import {
  MOVEMENT_FIELDS, COMBAT_FIELDS, DODGE_FIELDS, CAMERA_FIELDS, ATTRIBUTE_FIELDS,
} from './field-data';

/* ── Character genome diff specs ───────────────────────────────────────────── *
 * Derived from the existing profile FieldDef arrays so the import-diff preview
 * stays in lock-step with the editor sliders (label, unit, and % handling).
 * ────────────────────────────────────────────────────────────────────────── */

const PROFILE_GROUPS: { key: ProfileKey; title: string; fields: FieldDef[] }[] = [
  { key: 'movement', title: 'Movement', fields: MOVEMENT_FIELDS },
  { key: 'combat', title: 'Combat', fields: COMBAT_FIELDS },
  { key: 'dodge', title: 'Dodge', fields: DODGE_FIELDS },
  { key: 'camera', title: 'Camera', fields: CAMERA_FIELDS },
  { key: 'attributes', title: 'Attributes', fields: ATTRIBUTE_FIELDS },
];

export const CHARACTER_DIFF_SPECS: DiffFieldSpec<CharacterGenome>[] = PROFILE_GROUPS.flatMap(
  ({ key, title, fields }) =>
    fields.map((field): DiffFieldSpec<CharacterGenome> => ({
      group: title,
      label: field.label,
      get: (g) => (g[key] as unknown as Record<string, number>)[field.key],
      // FieldDef encodes percentage values with a '%' unit; everything else
      // keeps its literal unit suffix.
      percent: field.unit === '%',
      unit: field.unit === '%' ? undefined : field.unit || undefined,
    })),
);
