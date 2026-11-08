/**
 * Guard (module-topology-graph): no hard-coded colour literal in the four topology views.
 * ESLint's no-hex rule sees `'#rrggbb'` string literals only — not a Tailwind arbitrary
 * class (`text-[#a78bfa]`), a hex inside a longer string (`'0 0 4px #a78bfa'`) or an
 * `rgba(248, 113, 113, …)` triple — so this scan covers all three, comments stripped
 * first so a file that only TALKS about a colour does not trip it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'components', 'modules', 'evaluator');
const DIRS = ['DependencyGraph', 'NexusView', 'FeatureConstellation', 'CrossModuleOverlapPanel'];

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function hits(src: string): string[] {
  return stripComments(src).match(COLOUR) ?? [];
}

describe('module-topology-graph — no hard-coded colour literals', () => {
  it('the matcher bites on an arbitrary class, an embedded hex and an rgba triple, not on a comment', () => {
    /* eslint-disable no-restricted-syntax -- the seeded colour values ARE the fixture */
    expect(hits('className="text-[#a78bfa]"')).toEqual(['#a78bfa']);
    expect(hits("boxShadow: '0 0 4px #a78bfa'")).toEqual(['#a78bfa']);
    expect(hits('`rgba(248, 113, 113, ${a})`')).toEqual(['rgba(2']);
    expect(hits('// was #3a3a5a\nconst x = 1;')).toEqual([]);
    expect(hits('{/* was rgba(1,2,3,1) */}')).toEqual([]);
  });

  it('every file in the four topology view folders is colour-literal-free', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const name of readdirSync(join(ROOT, dir))) {
        if (!/\.tsx?$/.test(name)) continue;
        for (const hit of hits(readFileSync(join(ROOT, dir, name), 'utf8'))) offenders.push(`${dir}/${name}: ${hit}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
