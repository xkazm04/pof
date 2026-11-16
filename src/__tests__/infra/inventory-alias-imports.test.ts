import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * scan-sweep inventory-genome-economy: CLAUDE.md mandates `@/` imports, never relative
 * parent hops. Pins the dna-genome and economy folders at 0 relative parent imports.
 */

const ROOT = path.join(process.cwd(), 'src', 'components', 'modules', 'core-engine', 'sub_inventory');
const FOLDERS = ['dna-genome', 'economy'];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function relativeParentImports(): string[] {
  const hits: string[] = [];
  for (const folder of FOLDERS) {
    const dir = path.join(ROOT, folder);
    for (const name of fs.readdirSync(dir)) {
      if (!/\.tsx?$/.test(name)) continue;
      const code = stripComments(fs.readFileSync(path.join(dir, name), 'utf8'));
      for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.\.\/[^'"]*)['"]/g)) {
        hits.push(`${folder}/${name}: ${m[1]}`);
      }
    }
  }
  return hits;
}

describe('sub_inventory dna-genome + economy imports', () => {
  it('use the @/ alias, no relative parent imports', () => {
    expect(relativeParentImports()).toEqual([]);
  });
});
