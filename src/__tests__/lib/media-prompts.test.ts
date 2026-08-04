import { describe, it, expect } from 'vitest';
import { iconPromptFor, CATALOG_TO_FAMILY, ICON_FAMILIES, NEG_TAIL } from '@/lib/media-prompts/iconPrompts';
import { deliverableClassOf, DIMENSIONS, UI_GLYPH_CATALOGS } from '@/lib/judge/dimensions';
import { qualityPack } from '@/lib/prompts/quality';

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

describe('multi-element 2D steps are not judged as one glyph', () => {
  it('routes a glyph SET and a wireframe out of ui-glyph, by exact step', () => {
    // The two steps the ui-glyph bar demonstrably mis-scored (18/100 and 10/100) for being
    // exactly what they were asked to be.
    expect(deliverableClassOf('2d-art', 'input-schemes', 'Input Glyphs')).toBe('ui-sheet');
    expect(deliverableClassOf('2d-art', 'hud-elements', 'Wireframe')).toBe('ui-diagram');
  });

  it('leaves every OTHER step in those catalogs on the ui-glyph bar', () => {
    expect(deliverableClassOf('2d-art', 'hud-elements', 'Icon 2D Art')).toBe('ui-glyph');
    expect(deliverableClassOf('2d-art', 'save-points', 'Icon 2D Art')).toBe('ui-glyph');
    expect(deliverableClassOf('2d-art', 'screen-flow', 'Icon 2D Art')).toBe('ui-glyph');
  });

  it('is unchanged when no step is passed — existing callers keep their meaning', () => {
    expect(deliverableClassOf('2d-art', 'input-schemes')).toBe('ui-glyph');
    expect(deliverableClassOf('2d-art', 'hud-elements')).toBe('ui-glyph');
  });

  it('never re-routes a step name outside its own catalog', () => {
    expect(deliverableClassOf('2d-art', 'items', 'Input Glyphs')).toBe('2d-art');
    expect(deliverableClassOf('2d-art', 'save-points', 'Wireframe')).toBe('ui-glyph');
  });

  it('the escape is not leniency — both new rubrics keep a cleanliness bar that bans garbled text', () => {
    for (const cls of ['ui-sheet', 'ui-diagram'] as const) {
      const clean = DIMENSIONS[cls].find((d) => d.key === 'cleanliness');
      expect(clean, `${cls} must keep a cleanliness dimension`).toBeTruthy();
      expect(clean!.bar).toMatch(/garbled/);
    }
  });

  it('ui-sheet judges the SET, ui-diagram judges the LAYOUT', () => {
    expect(DIMENSIONS['ui-sheet'].map((d) => d.key)).toContain('setCohesion');
    expect(DIMENSIONS['ui-sheet'].map((d) => d.key)).toContain('perGlyphClarity');
    expect(DIMENSIONS['ui-diagram'].map((d) => d.key)).toContain('layoutClarity');
    expect(DIMENSIONS['ui-diagram'].map((d) => d.key)).toContain('annotationQuality');
  });

  it('a producer prompt exists for both new classes, so the asked bar matches the judged bar', () => {
    for (const cls of ['ui-sheet', 'ui-diagram'] as const) {
      const pack = qualityPack(cls, 'hud-elements');
      expect(pack).toContain('Hard constraints');
      for (const d of DIMENSIONS[cls]) expect(pack).toContain(d.key);
    }
  });
});
