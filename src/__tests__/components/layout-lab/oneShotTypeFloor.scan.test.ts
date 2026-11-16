/**
 * Ratchet: the lab declares a 14px type floor (--lab-fs-xs in lab-tokens.css). The one-shot
 * drawer is lab UI, so its inline fontSize must read a --lab-fs-* token, not a sub-14px literal.
 * Comment-stripped source scan over every .tsx in one-shot/; the count may only shrink (0 now).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Inline numeric fontSize below the floor (`fontSize: 12`), not token strings. */
function subFloorSites(src: string): string[] {
  return stripComments(src).match(/fontSize:\s*(?:[0-9]|1[0-3])(?![0-9.])/g) ?? [];
}

const DIR = join(process.cwd(), 'src/components/layout-lab/one-shot');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.tsx')).sort();

describe('one-shot drawer type floor', () => {
  it('scans the whole folder', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(10);
  });

  it('no sub-14px inline fontSize in any one-shot component', () => {
    const per = Object.fromEntries(FILES.map((f) => [f, subFloorSites(readFileSync(join(DIR, f), 'utf8')).length]));
    expect(per).toEqual(Object.fromEntries(FILES.map((f) => [f, 0])));
  });
});
