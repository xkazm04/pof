import { describe, it, expect } from 'vitest';
import '@/lib/catalog/gap-analysis/plugins'; // ensure registration side effects
import { pluginFor } from '@/lib/catalog/gap-analysis/plugins';

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
});
