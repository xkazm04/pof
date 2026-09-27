import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A canon profile spreads law arrays at module-evaluation time. When it imports them from a
 * reference module that itself (transitively) reaches the canon — every seeding module does, via
 * acceptance/* — importing that reference module FIRST evaluates the profile while the laws are
 * still uninitialised (TDZ ReferenceError under tsx/CJS). vitest's loader hides it, so this guard
 * is static: a profile may import laws only from modules whose runtime imports are type-only.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const PROFILES = join(ROOT, 'src', 'lib', 'catalog', 'canon', 'profiles');

const runtimeImports = (source: string): string[] =>
  [...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);

const resolve = (specifier: string): string | null =>
  specifier.startsWith('@/lib/catalog/reference/')
    ? join(ROOT, 'src', `${specifier.slice(2)}.ts`)
    : null;

describe('canon profile imports', () => {
  for (const file of readdirSync(PROFILES).filter((name) => name.endsWith('.ts'))) {
    it(`${file} imports laws only from modules with type-only runtime imports`, () => {
      const offenders: string[] = [];
      for (const specifier of runtimeImports(readFileSync(join(PROFILES, file), 'utf8'))) {
        const path = resolve(specifier);
        if (!path) continue;
        const deps = runtimeImports(readFileSync(path, 'utf8'));
        if (deps.length > 0) offenders.push(`${specifier} → ${deps.join(', ')}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});
