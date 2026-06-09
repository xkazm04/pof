import { describe, it, expect } from 'vitest';
import {
  GENRE_GENOME_TEMPLATES, GENRE_TEMPLATE_SETS,
  getGenreTemplateSet, instantiateCharacterTemplate,
  instantiateItemTemplate, dominantAxis,
} from '@/lib/genome/genre-genome-templates';
import { BASED_ON_TAG_PREFIX } from '@/lib/genome/archetype-templates';
import { SUB_GENRE_TEMPLATES } from '@/lib/genre-evolution-engine';
import { DEFAULT_ATTRIBUTES } from '@/lib/genome/defaults';
import type { SubGenreId } from '@/types/telemetry';
import type { TraitAxis } from '@/types/item-genome';

const SUB_GENRE_IDS = SUB_GENRE_TEMPLATES.map((t) => t.id);
const AXES: TraitAxis[] = ['offensive', 'defensive', 'utility', 'economic'];

describe('GENRE_GENOME_TEMPLATES coverage', () => {
  it('defines a template set for every engine-detectable sub-genre', () => {
    for (const id of SUB_GENRE_IDS) {
      const set = GENRE_GENOME_TEMPLATES[id];
      expect(set, `missing template set for "${id}"`).toBeDefined();
      expect(set.subGenre).toBe(id);
    }
    // no extra/orphan keys beyond the engine's sub-genres
    expect(Object.keys(GENRE_GENOME_TEMPLATES).sort()).toEqual([...SUB_GENRE_IDS].sort());
  });

  it('every set ships at least one character and one item template', () => {
    for (const set of GENRE_TEMPLATE_SETS) {
      expect(set.characters.length, set.subGenre).toBeGreaterThanOrEqual(1);
      expect(set.items.length, set.subGenre).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses globally-unique template ids across characters and items', () => {
    const ids = GENRE_TEMPLATE_SETS.flatMap((s) => [
      ...s.characters.map((c) => c.id),
      ...s.items.map((i) => i.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getGenreTemplateSet resolves a known sub-genre and is undefined otherwise', () => {
    expect(getGenreTemplateSet('souls-like')?.subGenre).toBe('souls-like');
    expect(getGenreTemplateSet('not-a-genre' as SubGenreId)).toBeUndefined();
  });
});

describe('item templates are high-coherence', () => {
  it('each item blueprint carries all four trait axes', () => {
    for (const set of GENRE_TEMPLATE_SETS) {
      for (const item of set.items) {
        const axes = item.blueprint.traits.map((t) => t.axis).sort();
        expect(axes, item.id).toEqual([...AXES].sort());
      }
    }
  });

  it('each item has a single dominant axis weighted >= 0.7 (coherence anchor)', () => {
    for (const set of GENRE_TEMPLATE_SETS) {
      for (const item of set.items) {
        const dom = dominantAxis(item.blueprint.traits);
        expect(dom.weight, `${item.id} dominant weight`).toBeGreaterThanOrEqual(0.7);
        // dominant must be the strict, unique maximum
        const ties = item.blueprint.traits.filter((t) => t.weight === dom.weight);
        expect(ties.length, `${item.id} dominant tie`).toBe(1);
        // dominant axis must carry affinity tags so the DNA roller actually biases
        expect(dom.affinityTags.length, `${item.id} dominant tags`).toBeGreaterThan(0);
      }
    }
  });

  it('is tagged high-coherence for discoverability', () => {
    for (const set of GENRE_TEMPLATE_SETS) {
      for (const item of set.items) {
        expect(item.tags, item.id).toContain('high-coherence');
      }
    }
  });
});

describe('souls-like character semantics', () => {
  it('is deliberate (slow attacks) and stamina-heavy', () => {
    const char = GENRE_GENOME_TEMPLATES['souls-like'].characters[0];
    // Deliberate = noticeably slower than the 1.2 default attack speed
    expect(char.blueprint.combat.attackSpeed).toBeLessThanOrEqual(0.9);
    // Stamina-heavy = a deeper pool than the default baseline
    expect(char.blueprint.attributes.baseStamina).toBeGreaterThan(DEFAULT_ATTRIBUTES.baseStamina);
    // Punishing regen so stamina management matters
    expect(char.blueprint.attributes.staminaRegenPerSec).toBeLessThan(DEFAULT_ATTRIBUTES.staminaRegenPerSec);
  });
});

describe('instantiateCharacterTemplate', () => {
  it('mints a fresh, lineage-tagged character genome', () => {
    const t = GENRE_GENOME_TEMPLATES['souls-like'].characters[0];
    const g = instantiateCharacterTemplate(t);
    expect(g.id).toBeTruthy();
    expect(g.name).toBe(t.name);
    expect(g.author).toBe('Genre Engine');
    expect(g.tags).toContain(`${BASED_ON_TAG_PREFIX}${t.id}`);
    // carries the blueprint stats through
    expect(g.attributes.baseStamina).toBe(t.blueprint.attributes.baseStamina);
    expect(g.combat.attackSpeed).toBe(t.blueprint.combat.attackSpeed);
  });

  it('produces a distinct id and a defensive copy on each call', () => {
    const t = GENRE_GENOME_TEMPLATES['character-action'].characters[0];
    const a = instantiateCharacterTemplate(t);
    const b = instantiateCharacterTemplate(t);
    expect(a.id).not.toBe(b.id);
    // mutating the clone must not bleed back into the template
    a.attributes.baseHP = 1;
    expect(t.blueprint.attributes.baseHP).not.toBe(1);
  });
});

describe('instantiateItemTemplate', () => {
  it('mints a fresh, lineage-tagged item genome with all four axes', () => {
    const t = GENRE_GENOME_TEMPLATES['diablo-like'].items[0];
    const g = instantiateItemTemplate(t);
    expect(g.id).toBeTruthy();
    expect(g.name).toBe(t.name);
    expect(g.itemType).toBe(t.blueprint.itemType);
    expect(g.minRarity).toBe(t.blueprint.minRarity);
    expect(g.traits).toHaveLength(4);
    expect(g.tags).toContain(`${BASED_ON_TAG_PREFIX}${t.id}`);
  });

  it('produces a distinct id and a defensive copy of traits on each call', () => {
    const t = GENRE_GENOME_TEMPLATES['survival-arpg'].items[0];
    const a = instantiateItemTemplate(t);
    const b = instantiateItemTemplate(t);
    expect(a.id).not.toBe(b.id);
    a.traits[0].affinityTags.push('Stat.Bogus');
    expect(t.blueprint.traits[0].affinityTags).not.toContain('Stat.Bogus');
  });
});
