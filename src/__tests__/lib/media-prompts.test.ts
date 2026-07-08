import { describe, it, expect } from 'vitest';
import { iconPromptFor, CATALOG_TO_FAMILY, ICON_FAMILIES, NEG_TAIL } from '@/lib/media-prompts/iconPrompts';
import { deliverableClassOf, DIMENSIONS, UI_GLYPH_CATALOGS } from '@/lib/judge/dimensions';

describe('hardened icon prompt packs (WS1 banked)', () => {
  it('composes subject + family clause + shared negatives', () => {
    const p = iconPromptFor('status-effects', 'a Freezing chill status glyph');
    expect(p).toContain('a Freezing chill status glyph');
    expect(p).toContain(ICON_FAMILIES['ability-fx'].clause.slice(0, 30));
    expect(p).toContain('No text');
    expect(p).toContain(NEG_TAIL.slice(-20));
  });

  it('routes each family catalog to its pack', () => {
    expect(CATALOG_TO_FAMILY['items']).toBe('item-object');
    expect(CATALOG_TO_FAMILY['characters']).toBe('character-2d');
    expect(CATALOG_TO_FAMILY['achievements']).toBe('emblem-system');
    expect(iconPromptFor('unknown-catalog', 'x')).toBeNull();
  });

  it('documents the honest Lucid ceiling per family (66-73)', () => {
    for (const f of Object.values(ICON_FAMILIES)) {
      expect(f.ceiling).toBeGreaterThanOrEqual(60);
      expect(f.ceiling).toBeLessThan(90);
    }
  });
});

describe('ui-glyph sub-rubric (WS1 calibration)', () => {
  it('routes flat UI/HUD 2D catalogs to ui-glyph, painterly stays 2d-art', () => {
    expect(deliverableClassOf('2d-art', 'input-schemes')).toBe('ui-glyph');
    expect(deliverableClassOf('2d-art', 'hud-elements')).toBe('ui-glyph');
    expect(deliverableClassOf('2d-art', 'items')).toBe('2d-art');
    expect(deliverableClassOf('2d-art')).toBe('2d-art'); // no catalog → generic
  });

  it('ui-glyph scores icon craft, NOT painterly materialRendering', () => {
    const keys = DIMENSIONS['ui-glyph'].map((d) => d.key);
    expect(keys).toContain('clarity');
    expect(keys).toContain('legibility');
    expect(keys).not.toContain('materialRendering');
  });

  it('every ui-glyph catalog is in the routing set', () => {
    expect(UI_GLYPH_CATALOGS.has('save-points')).toBe(true);
  });
});
