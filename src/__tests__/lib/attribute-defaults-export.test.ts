import { describe, it, expect } from 'vitest';
import {
  buildAttributeDefaultsPython, DEFAULT_ATTRIBUTE_ROWS, type AttributeRow,
} from '@/components/modules/core-engine/sub_combat/attributes/attribute-defaults-export';

describe('attribute-defaults Python emitter', () => {
  it('ships Player / Skeleton / Boss default rows', () => {
    expect(DEFAULT_ATTRIBUTE_ROWS.map((r) => r.rowName)).toEqual(['Player', 'Skeleton', 'Boss']);
  });

  it('emits a create_asset call for a DataTable with the init row struct', () => {
    const py = buildAttributeDefaultsPython(DEFAULT_ATTRIBUTE_ROWS);
    expect(py).toContain('import unreal');
    expect(py).toContain('DT_AttributeDefaults');
    expect(py).toContain('/Game/Data');
    expect(py).toContain('DataTable');
    expect(py).toContain('FARPGAttributeInitRow');
  });

  it('writes one row per archetype with its Health value', () => {
    const rows: AttributeRow[] = [{ rowName: 'Player', values: { Health: 120, MaxHealth: 120, Armor: 5 } }];
    const py = buildAttributeDefaultsPython(rows);
    expect(py).toContain('Player');
    expect(py).toContain('120');
    expect(py).toContain('armor'); // set_editor_property uses snake_case
  });

  it('never emits a non-finite literal (NaN / Infinity are not Python names)', () => {
    const rows: AttributeRow[] = [{ rowName: 'Player', values: { Health: Infinity, Mana: NaN, Armor: -Infinity, Strength: 12 } }];
    const py = buildAttributeDefaultsPython(rows);
    expect(py).not.toMatch(/(NaN|Infinity)/);
    expect(py).toContain('set_editor_property("strength", 12)');
  });
});
