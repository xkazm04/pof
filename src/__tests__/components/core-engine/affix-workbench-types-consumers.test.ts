/**
 * affix-workbench/types.ts holds only types something imports. Each component
 * owns its own props interface, so a second copy here drifts silently (the
 * old CraftingStationProps still declared a canAfford prop the station no
 * longer takes). Every export must be named by another file in the tree.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = 'src/components/modules/core-engine/sub_loot/affix-workbench/types.ts';
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('affix-workbench/types.ts — no zero-consumer exports', () => {
  it('every exported type is imported by another file', () => {
    const src = stripComments(fs.readFileSync(TYPES, 'utf8'));
    const names = [...src.matchAll(/^export (?:interface|type) (\w+)/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    // Names that appear inside an import FROM types.ts (a same-named local
    // interface in a component does not count as a consumer).
    const imported = new Set(walk('src').filter((f) => path.resolve(f) !== path.resolve(TYPES))
      .flatMap((f) => [...stripComments(fs.readFileSync(f, 'utf8'))
        .matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(?:\.\/types|@\/components\/modules\/core-engine\/sub_loot\/affix-workbench\/types)'/g)])
      .flatMap((m) => m[1].split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]))
      .filter(Boolean));
    const unused = names.filter((n) => !imported.has(n));
    expect(unused).toEqual([]);
  });
});
