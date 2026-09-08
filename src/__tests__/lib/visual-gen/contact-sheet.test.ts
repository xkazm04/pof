import { describe, it, expect } from 'vitest';
import {
  buildContactSheetPrompt,
  contactSheetCells,
  sheetCells,
  SHEET_TEXT_BAN,
  type ContactSheetSpec,
} from '@/lib/visual-gen/contact-sheet';

const cast = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}`, brief: `subject number ${i}` }));

const spec = (over: Partial<ContactSheetSpec> = {}): ContactSheetSpec => ({
  cols: 2,
  rows: 2,
  cellSubject: 'game UI item icon',
  style: 'painterly dark-fantasy ARPG art',
  background: 'flat deep charcoal',
  cast: cast(4),
  ...over,
});

describe('sheetCells — slicing geometry', () => {
  it('tiles the image exactly: every pixel covered once, no gaps, no overlap', () => {
    // 1328 % 6 = 2 — the remainder case a naive floor() silently drops.
    const cells = sheetCells(6, 6, 1328, 1328);
    expect(cells).toHaveLength(36);
    const covered = cells.reduce((sum, c) => sum + c.w * c.h, 0);
    expect(covered).toBe(1328 * 1328);
    // right and bottom edges reached exactly
    const maxRight = Math.max(...cells.map((c) => c.x + c.w));
    const maxBottom = Math.max(...cells.map((c) => c.y + c.h));
    expect(maxRight).toBe(1328);
    expect(maxBottom).toBe(1328);
  });

  it('never emits a zero-width or fractional cell', () => {
    for (const c of sheetCells(5, 3, 1327, 641)) {
      expect(Number.isInteger(c.x) && Number.isInteger(c.y)).toBe(true);
      expect(Number.isInteger(c.w) && Number.isInteger(c.h)).toBe(true);
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });

  it('indexes row-major — index 2 of a 2-wide grid is row 1, col 0', () => {
    const cells = sheetCells(2, 2, 100, 100);
    expect(cells[2]).toMatchObject({ index: 2, row: 1, col: 0 });
  });
});

describe('contactSheetCells — identity mapping', () => {
  it('binds each cell to the cast member the prompt lists at that position', () => {
    const s = spec({ cols: 3, rows: 2, cast: cast(6) });
    const cells = contactSheetCells(s, 300, 200);
    expect(cells.map((c) => c.id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5']);
    // the prompt's "Row 2" is the slicer's row index 1
    expect(cells.filter((c) => c.row === 1).map((c) => c.id)).toEqual(['e3', 'e4', 'e5']);
  });
});

describe('buildContactSheetPrompt', () => {
  it('refuses a cast that does not fill the grid, naming both numbers', () => {
    const r = buildContactSheetPrompt(spec({ cols: 3, rows: 3, cast: cast(4) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/9.*4|4.*9/);
  });

  it('bans lettering — the cast names are order instructions, not content', () => {
    const r = buildContactSheetPrompt(spec());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toContain(SHEET_TEXT_BAN);
  });

  it('carries the per-set accent only when the set declares one', () => {
    const withAccent = buildContactSheetPrompt(spec({ accent: 'cool indigo and steel' }));
    const without = buildContactSheetPrompt(spec());
    expect(withAccent.ok && withAccent.data).toContain('cool indigo and steel');
    expect(without.ok && without.data.toLowerCase()).not.toContain('accent');
  });

  it('reproduces the hand-authored production sheet prompt', () => {
    // Ground truth NOT written by this session and not from this repo: the retained
    // production prompt behind the Three Kingdoms game's 108 officer portraits
    // (awesome-gpt-6-astra, works/three-kingdoms/docs/portrait-prompts/wei-prompt.txt),
    // which shipped three real 6x6 sheets. Each clause below is load-bearing there.
    const wei = buildContactSheetPrompt(
      spec({
        cols: 6,
        rows: 6,
        cellSubject: 'head-and-shoulders adult Chinese Three Kingdoms character portrait',
        style: 'classical painterly oil and Chinese ink hybrid',
        background: 'subtle deep charcoal/jade atmospheric background',
        accent: 'cool indigo and steel, with bronze details',
        cast: [
          { id: 'cao-cao', brief: 'commanding middle-aged ruler with trimmed beard' },
          ...cast(35),
        ],
      }),
    );
    expect(wei.ok).toBe(true);
    if (!wei.ok) return;
    const p = wei.data;
    for (const clause of [
      '6 columns',
      '6 rows',
      '36',
      'equal square size',
      'edge-to-edge',
      'no outer margins',
      'no gutters',
      'no visible grid lines',
      'EXACTLY ONE',
      'own cell',
      'never allow',
      'neighbor',
      'Consistent',
      'across all 36',
      'Row 1:',
      'Row 6:',
    ]) {
      expect(p, `missing load-bearing clause: ${clause}`).toContain(clause);
    }
    // the cast is listed row-by-row, left to right, in the slicer's own order
    expect(p).toMatch(/Row 1: commanding middle-aged ruler with trimmed beard;/);
  });
});
