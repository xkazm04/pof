/**
 * One affix-category colour rule in the workbench. The pool panel, drag ghost
 * and item card used getCategoryColor (defensive=info, utility=emerald) while
 * the breakpoint table, its legend and the archetype cards used CATEGORY_COLORS
 * (defensive=emerald, utility=cyan) - so emerald meant "utility" in one view
 * and "defensive" in the next.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_COLORS, getCategoryColor } from '@/components/modules/core-engine/sub_loot/affix-workbench/constants';

const WB = 'src/components/modules/core-engine/sub_loot/affix-workbench';
const CATS = ['offensive', 'defensive', 'utility'] as const;
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('affix-workbench — one category colour rule', () => {
  it('getCategoryColor agrees with CATEGORY_COLORS for every category', () => {
    expect(CATS.filter((c) => getCategoryColor(c) !== CATEGORY_COLORS[c])).toEqual([]);
  });

  it('no file but constants.ts maps a category to a colour', () => {
    const forks = fs.readdirSync(WB).filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'constants.ts')
      .filter((f) => {
        const src = stripComments(fs.readFileSync(path.join(WB, f), 'utf8'));
        return /\bdefensive\s*:\s*[A-Z_]/.test(src) || /category\s*===\s*'defensive'\s*\?/.test(src);
      });
    expect(forks).toEqual([]);
  });
});
