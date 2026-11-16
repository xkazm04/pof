import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// scan-sweep 2026-11-08 cli-terminal-shell: timing values come from UI_TIMEOUTS, so no
// setTimeout in the cli shell components may take a numeric-literal delay.

const DIR = join(process.cwd(), 'src', 'components', 'cli');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Numeric delay literals: `setTimeout(fn, 600)` on one line, or a multi-line callback closed by `}, 600)`. */
export function literalDelays(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  const inline = /setTimeout\([^;\n]*,\s*\d[\d_]*\s*\)/g;
  const closing = /\}\s*,\s*\d[\d_]*\s*\)\s*;?/g;
  for (const re of [inline, closing]) for (const m of code.matchAll(re)) out.push(m[0]);
  return out;
}

describe('cli shell timer delays', () => {
  it('the scanner sees a literal delay (instrument self-check)', () => {
    expect(literalDelays('t = setTimeout(async () => {\n  x();\n}, 600);').length).toBe(1);
    expect(literalDelays('setTimeout(() => a(), 50)').length).toBe(1);
    expect(literalDelays('setTimeout(() => a(), UI_TIMEOUTS.copyFeedback)').length).toBe(0);
  });

  it('no numeric-literal setTimeout delay in src/components/cli/*.tsx', () => {
    const offenders: string[] = [];
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.tsx'))) {
      const hits = literalDelays(readFileSync(join(DIR, f), 'utf-8'));
      if (hits.length) offenders.push(`${f}: ${hits.join(' | ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
