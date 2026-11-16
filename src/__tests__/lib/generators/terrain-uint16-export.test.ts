/** heightmapToUint16 must not wrap values outside the 0-1 band into low ground. */
import { describe, it, expect } from 'vitest';
import { heightmapToUint16 } from '@/lib/visual-gen/generators/terrain';

describe('heightmapToUint16 range handling', () => {
  it('a [0,2] field keeps its order (non-decreasing in, non-decreasing out)', () => {
    const row = Array.from({ length: 9 }, (_, i) => (i / 8) * 2);
    const out = Array.from(heightmapToUint16(Array.from({ length: 9 }, () => row)));
    const first = out.slice(0, 9);
    for (let i = 1; i < first.length; i++) expect(first[i]).toBeGreaterThanOrEqual(first[i - 1]);
  });

  it('a negative value floors at 0 and an above-band value saturates at 65535', () => {
    const out = heightmapToUint16([[-0.5, 2], [0, 1]]);
    expect(Array.from(out)).toEqual([0, 65535, 0, 65535]);
  });

  it('in-band values are unchanged', () => {
    const out = heightmapToUint16([[0, 0.5], [0.25, 1]]);
    expect(Array.from(out)).toEqual([0, 32768, 16384, 65535]);
  });
});
