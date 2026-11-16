import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleForRecipe, getRecipe } from '@/lib/catalog/recipe';
import { CATALOG_MODULE } from '@/lib/catalog/catalog-module';

const RECIPE_CATALOGS = ['spellbook', 'items', 'loot-tables', 'bestiary', 'combat-map', 'screen-flow', 'zone-map', 'state-graph', 'materials', 'characters', 'currencies'];

describe('recipe catalog -> module has ONE source (CATALOG_MODULE)', () => {
  it('every recipe catalog scopes to its owning module, except the documented superset', () => {
    for (const c of RECIPE_CATALOGS) {
      expect(getRecipe(c), c).toBeDefined();
      if (c === 'currencies') expect(moduleForRecipe(c)).toBeUndefined();
      else expect(moduleForRecipe(c), c).toBe(CATALOG_MODULE[c]);
    }
  });

  it('recipe.ts carries no second hand-written catalog->module literal map', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/catalog/recipe.ts'), 'utf-8');
    const literals = src.match(/^\s*'?[\w-]+'?:\s*'arpg-[\w-]+',?\s*$/gm) ?? [];
    expect(literals).toEqual([]);
  });
});
