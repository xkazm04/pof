/**
 * Guard (holistic-quality-overview): no hard-coded hex colour in the Project Health and
 * Summary views. ESLint's no-hex rule sees string literals but not a Tailwind arbitrary
 * class (`hover:bg-[#15152e]`), so this scan covers both — comments stripped first, so a
 * file that only TALKS about a hex value does not trip it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'components', 'modules', 'evaluator');
const DIRS = ['HolisticHealthView', 'UnifiedSummaryView'];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function hexHits(src: string): string[] {
  return stripComments(src).match(HEX) ?? [];
}

describe('holistic-quality-overview — no hard-coded hex colours', () => {
  it('the matcher bites on a literal and an arbitrary Tailwind class, not on a comment', () => {
    /* eslint-disable no-restricted-syntax -- the seeded hex values ARE the fixture */
    expect(hexHits("const c = '#4b5563';")).toEqual(['#4b5563']);
    expect(hexHits('className="hover:bg-[#15152e]"')).toEqual(['#15152e']);
    expect(hexHits('// was #3a3a5a\nconst x = 1;')).toEqual([]);
  });

  it('every file in both view folders is hex-free', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const name of readdirSync(join(ROOT, dir))) {
        if (!/\.tsx?$/.test(name)) continue;
        for (const hit of hexHits(readFileSync(join(ROOT, dir, name), 'utf8'))) {
          offenders.push(`${dir}/${name}: ${hit}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
