/**
 * The ESLint no-hex rule does not see Tailwind arbitrary classes or CSS-function strings,
 * so AssetPipelineDiagram and AssetCard carried hex / rgba literals (10 lines, night
 * 2026-11-08). They read tokens from @/lib/chart-colors and Tailwind color utilities.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src/components/modules/content/models');
const FILES = ['AssetPipelineDiagram.tsx', 'AssetInventory/AssetCard.tsx'];

/** Drop block comments and whole-line `//` comments; JSX text may contain a bare `//`. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const LITERAL = /rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/;

describe('models asset inventory: no colour literals', () => {
  for (const f of FILES) {
    it(`${f} has 0 lines with a hex or rgb(a) literal`, () => {
      const lines = stripComments(readFileSync(join(ROOT, f), 'utf-8')).split(/\r?\n/);
      const hits = lines.filter((l) => LITERAL.test(l));
      expect(hits).toEqual([]);
    });
  }
});
