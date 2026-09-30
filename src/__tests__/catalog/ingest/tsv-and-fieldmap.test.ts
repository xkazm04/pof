// The ingest chassis: a tolerant TSV reader plus the mapping-table contract whose whole
// point is that the GAP REPORT IS DERIVED. A hand-written list of "fields PoF has no place
// for" drifts the moment the upstream table gains a column; a residual computed from
// (columns present) minus (columns classified) cannot.
import { describe, it, expect } from 'vitest';
import { parseTsv } from '@/lib/catalog/ingest/tsv';
import { auditColumns, mapped, dropped, gap, type FieldMap } from '@/lib/catalog/ingest/fieldMap';

const SAMPLE = [
  'id\tname\tlevel\ttrnFile\tresistance',
  'MT_NZOMBIE\tZombie\t1\t\tIMMUNE_MAGIC',
  'MT_BZOMBIE\tGhoul\t2\tzombie\bluered\tIMMUNE_MAGIC',
].join('\n');

describe('parseTsv', () => {
  it('reads the header as the column order and yields one record per row', () => {
    const t = parseTsv(SAMPLE);
    expect(t.columns).toEqual(['id', 'name', 'level', 'trnFile', 'resistance']);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0].name).toBe('Zombie');
  });

  it('keeps an EMPTY cell as empty string, never as a missing key', () => {
    // A missing key and a blank cell mean different things: the second is data.
    const t = parseTsv(SAMPLE);
    expect('trnFile' in t.rows[0]).toBe(true);
    expect(t.rows[0].trnFile).toBe('');
  });

  it('ignores blank and comment lines and tolerates CRLF', () => {
    const t = parseTsv('a\tb\r\n# note\r\n\r\n1\t2\r\n');
    expect(t.rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('reports a row whose cell count disagrees with the header rather than silently shifting', () => {
    const t = parseTsv('a\tb\tc\n1\t2\n');
    expect(t.malformed).toHaveLength(1);
    expect(t.malformed[0].line).toBe(2);
    expect(t.rows).toHaveLength(0);
  });

  it.each([
    ['maxBytes', 'a\n1', { maxBytes: 2 }, 3],
    ['maxRows', 'a\n1\n2', { maxRows: 1 }, 2],
    ['maxColumns', 'a\tb\tc\n1\t2\t3', { maxColumns: 2 }, 3],
  ] as const)('refuses input exceeding %s and reports its limit and observed value', (limit, text, limits, observed) => {
    const t = parseTsv(text, limits);
    expect(t.refusal).toMatchObject({ limit, observed });
    expect(t.refusal!.message).toContain(limit);
    expect(t.refusal!.message).toContain(String(observed));
    expect(t.rows).toEqual([]);
  });

  it('accepts an override that raises a limit', () => {
    const text = 'a\n1\n2';
    expect(parseTsv(text, { maxRows: 1 }).refusal?.limit).toBe('maxRows');
    expect(parseTsv(text, { maxRows: 2 }).rows).toEqual([{ a: '1' }, { a: '2' }]);
  });
});

describe('auditColumns — the derived gap report', () => {
  const MAP: FieldMap = {
    id: mapped('id'),
    name: mapped('name'),
    level: mapped('data.level'),
    trnFile: dropped('sprite palette swap — a 1996 renderer detail, not design data'),
    resistance: gap('PoF bestiary has no per-element resistance field'),
    // Declared but absent from the sample — upstream drift guard.
    soundSuffix: dropped('audio asset path'),
  };

  it('classifies every declared column and separates DROPPED from GAP', () => {
    const a = auditColumns(['id', 'name', 'level', 'trnFile', 'resistance'], MAP);
    expect(a.mapped).toEqual(['id', 'name', 'level']);
    expect(a.dropped).toEqual(['trnFile']);
    expect(a.gap.map((g) => g.column)).toEqual(['resistance']);
    expect(a.gap[0].why).toMatch(/resistance/i);
  });

  it('a column present in the data but ABSENT from the map is `unclassified`, not dropped', () => {
    // This is the whole honesty of the thing: "we never looked at it" must not read as
    // "we decided not to carry it". Rule 4b's `unknown` is a defect, applied to ingest.
    const a = auditColumns(['id', 'treasure'], MAP);
    expect(a.unclassified).toEqual(['treasure']);
    expect(a.dropped).not.toContain('treasure');
  });

  it('a mapping declared for a column the source no longer has is reported as drift', () => {
    const a = auditColumns(['id', 'name', 'level', 'trnFile', 'resistance'], MAP);
    expect(a.declaredButAbsent).toEqual(['soundSuffix']);
  });

  it('coverage counts only real columns, so drift cannot inflate it', () => {
    const a = auditColumns(['id', 'name', 'level', 'trnFile', 'resistance'], MAP);
    expect(a.columnCount).toBe(5);
    expect(a.coverage).toBeCloseTo(3 / 5, 5);
  });
});
