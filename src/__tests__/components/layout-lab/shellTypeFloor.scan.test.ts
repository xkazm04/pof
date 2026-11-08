/**
 * Ratchet: the lab declares a 14px type floor (--lab-fs-xs in lab-tokens.css). These shell
 * surfaces must read a --lab-fs-* token instead of a hard-coded sub-14px inline fontSize.
 * Comment-stripped source scan; the count may only shrink (it is 0 now).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/components/layout-lab');
const FILES = ['CatalogMatrix', 'MatrixBatchDrain', 'CanonView', 'CatalogTree', 'StepCrashBoundary'].map((n) => `${n}.tsx`);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Inline numeric fontSize below the floor (`fontSize: 12`), not token strings. */
export function subFloorSites(src: string): string[] {
  return stripComments(src).match(/fontSize:\s*(?:[0-9]|1[0-3])(?![0-9.])/g) ?? [];
}

describe('lab shell type floor', () => {
  it('counter sees a sub-14px literal and ignores tokens and comments', () => {
    expect(subFloorSites("style={{ fontSize: 12 }} // fontSize: 11")).toHaveLength(1);
    expect(subFloorSites("style={{ fontSize: 'var(--lab-fs-xs)' }}")).toHaveLength(0);
    expect(subFloorSites('style={{ fontSize: 14 }}')).toHaveLength(0);
  });

  it('no sub-14px inline fontSize in the matrix, drain, canon, tree and crash-boundary files', () => {
    const per = Object.fromEntries(FILES.map((f) => [f, subFloorSites(readFileSync(join(DIR, f), 'utf8')).length]));
    expect(per).toEqual(Object.fromEntries(FILES.map((f) => [f, 0])));
  });
});
