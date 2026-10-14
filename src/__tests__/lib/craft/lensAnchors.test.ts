/**
 * Benchmark anchors (technique: named-benchmark-anchors-per-level). Every lens level above the
 * floor is denominated in a named shipped product, and the floor is a class of output, never a
 * product. A lens whose A2/A3/A4 bullet names no product is an adjective scale for that level:
 * examiners fill it with the middle of the scale and the lens reports examiner uncertainty.
 *
 * Fixing a flagged level edits the lens file, which bumps its version and re-projects every stored
 * gauge under it as ungauged, so known gaps sit in KNOWN_UNANCHORED, owed as a lens-version decision.
 * The list is two-sided: an entry that now names a product must be deleted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LENS_IDS, type LensId } from '@/lib/craft/lens-map';

const LENS_DIR = join(process.cwd(), 'src/lib/craft/lenses');
const LEVELS = ['A4', 'A3', 'A2', 'A1'] as const;

/** `lens:level` pairs whose bullet names a class of studio, not a product. Owed to the lens owner. */
const KNOWN_UNANCHORED = new Set<string>(['production-process:A3']);

function anchorBullets(lens: LensId): Record<string, string> {
  const text = readFileSync(join(LENS_DIR, `${lens}.md`), 'utf8').replace(/\r\n/g, '\n');
  const start = text.indexOf('## Benchmark anchors');
  expect(start, `${lens}: no anchors section`).toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const end = rest.search(/\n## /);
  const body = end === -1 ? rest : rest.slice(0, end);
  const out: Record<string, string> = {};
  for (const chunk of body.split(/\n(?=- \*\*A\d)/)) {
    const m = chunk.match(/^- \*\*(A\d)\b/);
    if (m) out[m[1]] = chunk;
  }
  return out;
}

/** Italic spans that are not a defined-term gloss: the product titles an examiner can go and look at. */
function namedProducts(bullet: string): string[] {
  return [...bullet.matchAll(/(?<!\*)\*([A-Z0-9][^*\n]{1,60})\*(?!\*)/g)].map((m) => m[1]);
}

describe('benchmark anchors name a product per level', () => {
  for (const lens of LENS_IDS) {
    for (const level of LEVELS) {
      if (level === 'A1') continue;
      it(`${lens} ${level}`, () => {
        const bullet = anchorBullets(lens)[level];
        expect(bullet, `${lens}: no ${level} anchor`).toBeTruthy();
        const named = namedProducts(bullet).length > 0;
        if (KNOWN_UNANCHORED.has(`${lens}:${level}`)) {
          expect(named, `${lens}:${level} now names a product; delete it from KNOWN_UNANCHORED`).toBe(false);
        } else {
          expect(named, `${lens}:${level} names no product`).toBe(true);
        }
      });
    }
  }
});

describe('the floor is a class of output', () => {
  for (const lens of LENS_IDS) {
    it(`${lens} A1 names no shipped product`, () => {
      const bullet = anchorBullets(lens).A1;
      expect(bullet, `${lens}: no A1 anchor`).toBeTruthy();
      expect(namedProducts(bullet)).toEqual([]);
    });
  }
});
