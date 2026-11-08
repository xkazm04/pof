/**
 * Workbench timing values come from UI_TIMEOUTS (CLAUDE.md): no numeric-literal
 * setTimeout delay and no numeric `*_MS` constant in affix-workbench/*.ts(x).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_loot', 'affix-workbench');

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Literal delays (inline or closing a multi-line callback) plus numeric `NAME_MS = 400` constants. */
export function literalTimers(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  const res = [/setTimeout\([^;\n]*,\s*\d[\d_]*\s*\)/g, /\}\s*,\s*\d[\d_]*\s*\)\s*;?/g, /\b[A-Z][A-Z0-9_]*_MS\s*=\s*\d[\d_]*/g];
  for (const re of res) for (const m of code.matchAll(re)) out.push(m[0]);
  return out;
}

describe('affix-workbench timers', () => {
  it('the scanner sees each literal shape (instrument self-check)', () => {
    expect(literalTimers('setTimeout(() => a(), 600)').length).toBe(1);
    expect(literalTimers('t = setTimeout(() => {\n  x();\n}, 5000);').length).toBe(1);
    expect(literalTimers('const CRAFT_FLASH_MS = 400;').length).toBe(1);
    expect(literalTimers('setTimeout(() => a(), UI_TIMEOUTS.toast)').length).toBe(0);
  });

  it('no literal timer value in affix-workbench/*.ts(x)', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => /\.tsx?$/.test(n))) {
      const hits = literalTimers(readFileSync(join(DIR, f), 'utf-8'));
      if (hits.length) offenders.push(`${f}: ${hits.join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
