// G1 regression, against the REAL seed rather than a constructed archetype: every code-seeded
// bestiary entity must survive the JSON round-trip `upsertEntity` puts it through. Before the
// fix each one carried a lucide component in `data.icon`, which came back as `{}`.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { seedBestiaryEntries } from '@/lib/catalog/seed-bestiary';
import { jsonUnsafeKeys } from '@/lib/catalog/entityPayload';
import { ARCHETYPES, ARCHETYPE_ICONS, archetypeIcon } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { ArchetypeIconGlyph } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeIconGlyph';

describe('bestiary entities are persistable (G1)', () => {
  const entries = seedBestiaryEntries();

  it('covers a real seed, not an empty one', () => {
    expect(entries.length).toBeGreaterThan(20);
  });

  it('no seeded entity carries a key JSON would hollow', () => {
    const offenders = entries.map((e) => ({ id: e.id, keys: jsonUnsafeKeys(e) })).filter((o) => o.keys.length);
    expect(offenders).toEqual([]);
  });

  it('an entity round-trips byte-identical, iconKey included', () => {
    for (const e of entries) expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });

  it('every archetype names a registered icon', () => {
    const bad = ARCHETYPES.filter((a) => !(a.iconKey in ARCHETYPE_ICONS)).map((a) => a.id);
    expect(bad).toEqual([]);
  });

  it('an absent or unknown key falls back to the generic glyph instead of rendering nothing', () => {
    expect(archetypeIcon({})).toBe(ARCHETYPE_ICONS.skull);
    expect(archetypeIcon({ iconKey: 'not-a-key' })).toBe(ARCHETYPE_ICONS.skull);
    const html = renderToStaticMarkup(createElement(ArchetypeIconGlyph, { archetype: { iconKey: 'shield' }, className: 'x' }));
    expect(html).toContain('<svg');
    expect(html).toContain('lucide-shield');
  });
});
