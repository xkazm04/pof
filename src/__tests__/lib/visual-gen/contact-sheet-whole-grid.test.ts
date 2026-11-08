import { describe, it, expect } from 'vitest';
import { buildContactSheetPrompt } from '@/lib/visual-gen/contact-sheet';

const spec = (cols: number, rows: number, n: number) => ({
  cols, rows, cellSubject: 'icon', style: 's', background: 'b',
  cast: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, brief: `b${i}` })),
});

describe('buildContactSheetPrompt grid shape', () => {
  it('refuses a fractional grid whose product happens to equal the cast', () => {
    const r = buildContactSheetPrompt(spec(2.5, 2, 5));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/whole number/);
  });
  it('accepts a non-square whole grid', () => {
    expect(buildContactSheetPrompt(spec(3, 2, 6)).ok).toBe(true);
  });
});
