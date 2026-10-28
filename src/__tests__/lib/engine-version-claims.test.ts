import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';

const ROOT = process.cwd();
const SELF = join('src', '__tests__', 'lib', 'engine-version-claims.test.ts');
const EXT = /\.(ts|tsx|mjs|js|cjs)$/;

/** Collect scannable files; src/__tests__ is excluded (fixtures there deliberately name old installs). */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (name === 'node_modules' || name === '__tests__' || rel === SELF) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

describe('engine version claims', () => {
  it('has no live UE_5.7 engine-path literal in src/, scripts/ or e2e/', () => {
    const hits: string[] = [];
    for (const top of ['src', 'scripts', 'e2e']) {
      for (const f of walk(join(ROOT, top))) {
        const lines = readFileSync(f, 'utf8').split(/\r?\n/);
        lines.forEach((l, i) => {
          if (l.includes('UE_5.7')) hits.push(`${relative(ROOT, f)}:${i + 1}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });

  it('genre canon no longer claims UE 5.7', () => {
    const genre = CANON_SEED.find((r) => r.id === 'game-genre');
    expect(genre).toBeDefined();
    expect(genre!.body).not.toMatch(/5\.7/);
  });
});
