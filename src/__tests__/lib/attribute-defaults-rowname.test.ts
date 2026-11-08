import { describe, it, expect } from 'vitest';
import {
  buildAttributeDefaultsPython, type AttributeRow,
} from '@/components/modules/core-engine/sub_combat/attributes/attribute-defaults-export';

const NAMES = ['Elite Knight', "Boss's", 'Quote"d', 'Line\nBreak', 'elite_knight', 'Elite-Knight'];
const rows: AttributeRow[] = NAMES.map((rowName) => ({ rowName, values: { Health: 10 } }));
const py = buildAttributeDefaultsPython(rows);

describe('attribute-defaults emitter with arbitrary row names', () => {
  it('every row variable is a valid, distinct Python identifier', () => {
    const vars = [...py.matchAll(/^(\S+) = unreal\.ARPGAttributeInitRow\(\)$/gm)].map((m) => m[1]);
    expect(vars).toHaveLength(NAMES.length);
    for (const v of vars) expect(v).toMatch(/^row_[a-z0-9_]+$/);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it('the add_data_table_row name is a JSON-quoted literal that round-trips', () => {
    const literals = [...py.matchAll(/add_data_table_row\(dt, ("(?:[^"\\\n]|\\.)*"), /g)].map((m) => JSON.parse(m[1]) as string);
    expect(literals).toEqual(NAMES);
  });

  it('a newline in a row name cannot escape the header comment', () => {
    const lines = py.split('\n');
    const bad = lines.filter((l) => l.trim() !== '' && !/^(#|import |[A-Za-z_]\w*[ .=(])/.test(l));
    expect(bad).toEqual([]);
  });
});
