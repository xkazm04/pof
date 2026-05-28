import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_TEMPLATES,
  BASED_ON_TAG_PREFIX,
  forkTemplate,
  getAllTemplateTags,
  getLineageId,
  isLineageTag,
  findTemplateById,
} from '@/lib/genome/archetype-templates';

describe('archetype templates', () => {
  it('ships the five curated archetypes the requirement calls out', () => {
    const names = ARCHETYPE_TEMPLATES.map((t) => t.name).sort();
    expect(names).toEqual(['Berserker', 'Glass Cannon', 'Speedster', 'Spellblade', 'Tank']);
  });

  it('every template has a non-empty plain-language feel one-liner', () => {
    for (const t of ARCHETYPE_TEMPLATES) {
      expect(t.feel.length).toBeGreaterThan(10);
      // ensure it reads as a sentence, not just stats
      expect(/\d{2,}/.test(t.feel)).toBe(false);
    }
  });

  it('every template has at least one curatorial tag', () => {
    for (const t of ARCHETYPE_TEMPLATES) {
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.tags.every((tag) => !isLineageTag(tag))).toBe(true);
    }
  });

  it('getAllTemplateTags returns sorted unique tags', () => {
    const tags = getAllTemplateTags();
    expect(new Set(tags).size).toBe(tags.length);
    expect([...tags]).toEqual([...tags].sort());
  });

  it('findTemplateById resolves known ids and returns undefined for unknown', () => {
    expect(findTemplateById('berserker')?.name).toBe('Berserker');
    expect(findTemplateById('definitely-not-a-real-template')).toBeUndefined();
  });
});

describe('forkTemplate', () => {
  it('clones blueprint values into a fresh genome with a new id', () => {
    const t = findTemplateById('berserker')!;
    const a = forkTemplate(t);
    const b = forkTemplate(t);
    expect(a.id).not.toBe(b.id);
    expect(a.name).toBe('Berserker Fork');
    expect(a.color).toBe(t.color);
    expect(a.combat.baseDamage).toBe(t.blueprint.combat.baseDamage);
    expect(a.attributes.baseHP).toBe(t.blueprint.attributes.baseHP);
    expect(a.description).toBe(t.blueprint.description);
  });

  it('stamps a based-on lineage tag identifying the source template', () => {
    const t = findTemplateById('glass-cannon')!;
    const g = forkTemplate(t);
    expect(g.tags).toBeDefined();
    expect(g.tags!.some(isLineageTag)).toBe(true);
    expect(getLineageId(g.tags)).toBe('glass-cannon');
    expect(g.tags).toContain(`${BASED_ON_TAG_PREFIX}glass-cannon`);
  });

  it('mutating the fork does not leak back into the template blueprint', () => {
    const t = findTemplateById('tank')!;
    const original = t.blueprint.combat.baseDamage;
    const fork = forkTemplate(t);
    fork.combat.baseDamage = 9999;
    expect(t.blueprint.combat.baseDamage).toBe(original);
  });

  it('preserves curatorial tags alongside the lineage tag', () => {
    const t = findTemplateById('speedster')!;
    const g = forkTemplate(t);
    for (const tag of t.tags) {
      expect(g.tags).toContain(tag);
    }
  });
});

describe('lineage helpers', () => {
  it('getLineageId returns null for genomes with no lineage tag', () => {
    expect(getLineageId(undefined)).toBeNull();
    expect(getLineageId([])).toBeNull();
    expect(getLineageId(['melee', 'dps'])).toBeNull();
  });
});
