import { describe, it, expect } from 'vitest';
import {
  FILE_SIZE_SECTIONS, SECTION_BUDGETS, GROWTH_HISTORY, SCHEMA_VERSIONS,
} from '@/components/modules/core-engine/sub_save/_shared/data';
import {
  SAVE_PERSISTED_FIELDS, SAVE_VERSION_FIELD,
} from '@/lib/save-schema/fields';

const GROUPS = new Set<string>(SAVE_PERSISTED_FIELDS.map((f) => f.group));
const FIELD_NAMES = new Set<string>([
  ...SAVE_PERSISTED_FIELDS.map((f) => f.ueName), SAVE_VERSION_FIELD.ueName,
]);
const VERSION_LABELS = new Set(SCHEMA_VERSIONS.map((v) => v.label));

describe('save size fixtures resolve against the field authority', () => {
  it('keys every file-size section on a SaveFieldGroup', () => {
    const orphans = FILE_SIZE_SECTIONS.filter((s) => !GROUPS.has(s.label)).map((s) => s.label);
    expect(orphans).toEqual([]);
  });

  it('names every subsection after a UARPGSaveGame field', () => {
    const orphans = FILE_SIZE_SECTIONS.flatMap((s) => s.subsections ?? [])
      .filter((sub) => !FIELD_NAMES.has(sub.label)).map((sub) => sub.label);
    expect(orphans).toEqual([]);
  });

  it('keys every budget on a SaveFieldGroup', () => {
    const orphans = SECTION_BUDGETS.filter((b) => !GROUPS.has(b.sectionLabel)).map((b) => b.sectionLabel);
    expect(orphans).toEqual([]);
  });

  it('charts only generations that SCHEMA_VERSIONS declares', () => {
    const orphans = GROWTH_HISTORY.filter((g) => !VERSION_LABELS.has(g.version)).map((g) => g.version);
    expect(orphans).toEqual([]);
  });

  it('keeps each section total equal to its subsections', () => {
    for (const s of FILE_SIZE_SECTIONS) {
      const sum = (s.subsections ?? []).reduce((a, x) => a + x.bytes, 0);
      expect(s.bytes).toBe(sum);
    }
  });
});
