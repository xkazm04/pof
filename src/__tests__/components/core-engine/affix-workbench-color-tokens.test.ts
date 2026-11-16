/**
 * The workbench takes its colours from @/lib/chart-colors and theme variables:
 * no hex, rgb()/rgba() literal or raw Tailwind palette class (red-500...) in
 * affix-workbench/*.ts(x), including inside template strings the no-hex ESLint rule skips.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_loot', 'affix-workbench');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const PALETTE = '(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)';

/** Colour literals that bypass the tokens. */
export function colorBypasses(src: string): string[] {
  const code = stripComments(src);
  const res = [/#[0-9a-fA-F]{3,8}\b/g, /\brgba?\(/g, new RegExp(String.raw`\b(?:bg|text|border|ring|from|to|via|fill|stroke)-${PALETTE}-\d{2,3}\b`, 'g')];
  return res.flatMap((re) => [...code.matchAll(re)].map((m) => m[0]));
}

describe('affix-workbench colour tokens', () => {
  it('the scanner sees each bypass shape (instrument self-check)', () => {
    expect(colorBypasses('color:#e2e8f0;').length).toBe(1);
    expect(colorBypasses('background:rgba(15,15,25,0.9)').length).toBe(1);
    expect(colorBypasses('className="hover:bg-red-500/20 hover:text-red-400"').length).toBe(2);
    expect(colorBypasses('color:var(--text);bg-surface-deep // #fff').length).toBe(0);
  });

  it('no hex, rgba or raw palette class in affix-workbench/*.ts(x)', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n))) {
      const hits = colorBypasses(readFileSync(join(DIR, f), 'utf-8'));
      if (hits.length) offenders.push(`${f}: ${hits.join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
