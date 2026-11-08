import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import '@/lib/catalog/gap-analysis/plugins'; // ensure registration side effects
import { pluginFor } from '@/lib/catalog/gap-analysis/plugins';
import { CATALOG_SECTIONS } from '@/lib/catalog/sections';
import { codeSeededEntities } from '@/lib/catalog/seed';

describe('gap-analysis plugins', () => {
  it.each([
    ['items',     ['rarity', 'type']],
    ['bestiary',  ['tier', 'role']],
    ['spellbook', ['tier', 'element']],
    ['materials', ['surfaceType']],
    ['characters', ['role']],
    ['loot-tables', ['archetypeName']],
  ])('%s plugin declares its dimensions', (catalogId, expected) => {
    const p = pluginFor(catalogId);
    expect(p).toBeDefined();
    for (const d of expected) expect(p!.dimensions).toContain(d);
  });

  it('items.summarize renders the key attributes inline', () => {
    const out = pluginFor('items')!.summarize({ type: 'Weapon', subtype: 'Sword', rarity: 'Rare', level: 5 });
    expect(out).toMatch(/Rare/);
    expect(out).toMatch(/Sword/);
    expect(out).toMatch(/Lv.?\s*5/);
  });

  it.each([
    'spellbook', 'materials', 'loot-tables', 'combat-map', 'zone-map', 'screen-flow',
    'state-graph', 'audio', 'animation-assets', 'quests', 'dialog-trees', 'cutscenes',
    'codex', 'factions', 'props', 'status-effects', 'crafting-recipes', 'vendors',
    'progression-curves', 'achievements', 'save-points', 'music', 'ambient', 'vfx',
    'hud-elements', 'icon-sets', 'input-schemes', 'tutorial-beats', 'currencies', 'characters',
  ])('%s plugin is registered', (catalogId) => {
    expect(pluginFor(catalogId)).toBeDefined();
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'an Object.prototype key (%s) is not a registered plugin',
    (catalogId) => {
      expect(pluginFor(catalogId)).toBeUndefined();
    },
  );
});

// The plugin contract (plugins/types.ts) checked against the plugin FILES on disk, not a
// hand-kept id list: a plugin file left out of plugins/index.ts registers nothing, silently.
const PLUGIN_DIR = join(process.cwd(), 'src/lib/catalog/gap-analysis/plugins');
const PLUGIN_IDS = readdirSync(PLUGIN_DIR)
  .filter((f) => f.endsWith('.ts') && !['index.ts', 'registry.ts', 'types.ts'].includes(f))
  .map((f) => f.slice(0, -3));

describe('gap-analysis plugin contract (derived from plugins/*.ts)', () => {
  it('finds the plugin files', () => {
    expect(PLUGIN_IDS.length).toBeGreaterThan(30);
  });

  it.each(PLUGIN_IDS)('%s: its file is imported and registers under its own id', (id) => {
    expect(pluginFor(id)).toBeDefined();
  });

  it.each(PLUGIN_IDS)('%s: declares no @ facet dimension', (id) => {
    expect(pluginFor(id)!.dimensions.filter((d) => d.startsWith('@'))).toEqual([]);
  });

  it.each(PLUGIN_IDS)('%s: every expected share keys a declared dimension and sums to ~1', (id) => {
    const p = pluginFor(id)!;
    for (const [attr, shares] of Object.entries(p.expectedShare ?? {})) {
      expect(p.dimensions).toContain(attr);
      const sum = Object.values(shares).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.02);
      expect(Object.values(shares).every((v) => v > 0)).toBe(true);
    }
  });
});

describe('plugin summarize never hands the proposal prompt an empty sample line', () => {
  it('every code-seeded entity of a plugin catalog summarizes to non-empty text', () => {
    const empty = CATALOG_SECTIONS.flatMap((sec) => {
      const p = pluginFor(sec.catalogId);
      if (!p) return [];
      return codeSeededEntities(sec.catalogId).filter((e) => !p.summarize(e.data)).map((e) => `${sec.catalogId}/${e.id}`);
    });
    expect(empty).toEqual([]);
  });

  it('falls back to a bounded description when the declared fields are absent', () => {
    const long = 'x'.repeat(200);
    const out = pluginFor('quests')!.summarize({ description: long });
    expect(out.length).toBeLessThanOrEqual(81);
    expect(out.startsWith('xxx')).toBe(true);
    expect(pluginFor('items')!.summarize({ rarity: 'Rare', description: 'ignored' })).toBe('Rare');
  });
});
