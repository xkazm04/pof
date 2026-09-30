import { describe, expect, it } from 'vitest';
import { LINKED_REFERENCES_MAX_CHARS, collectLinkedReferences, linkedReferencesBlock } from '@/lib/catalog/reference/linkedReferences';
import { spellMechanics, withSpellMechanics } from '@/lib/catalog/reference/spellMechanics';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { entityValueLines, REFERENCE_MAX_CHARS } from '@/lib/catalog/referenceValues';

const wrapper = (spell: string): ReferenceWrapper => ({
  wrapperId: `synthetic:${spell}`,
  sourceId: 'synthetic',
  file: 'spells/spelldat.tsv',
  technique: 'synthetic',
  key: spell,
  keyKind: 'column',
  raw: { id: spell },
  rawHash: 'synthetic',
  catalogId: 'spellbook',
  entity: {
    id: `d1-${spell}`,
    catalogId: 'spellbook',
    name: spell,
    categoryPath: [],
    tags: [],
    lifecycle: 'planned',
    data: { synthetic: true },
    links: [{ catalogId: 'status-effects', entityId: 'synthetic-status', role: 'applies' }],
    provenance: {
      kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
      sourceFile: 'spells/spelldat.tsv', sourceRow: spell,
      licenceNote: 'test fixture', ingestedAt: 'test-time',
    },
  },
  mappingVersion: 'synthetic',
});

const missile = (id: string): StoredCatalogEntity => ({
  id: `d1-${id}`,
  catalogId: 'vfx',
  name: id,
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data: { engineSpec: { movement: 'synthetic movement', lifetime: 'synthetic lifetime', collision: 'synthetic collision' } },
  provenance: {
    kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'Synthetic',
    sourceFile: 'missiles/misdat.tsv', sourceRow: id,
    licenceNote: 'test fixture', ingestedAt: 'test-time',
  },
});

describe('spell promotion mechanics', () => {
  it('links a spell to every code-derived missile and carries the structured per-cast hit rule', () => {
    const [lightning] = withSpellMechanics([wrapper('Lightning')]);

    expect(lightning.entity.links).toEqual([
      { catalogId: 'status-effects', entityId: 'synthetic-status', role: 'applies' },
      { catalogId: 'vfx', entityId: 'd1-LightningControl', role: 'host' },
      { catalogId: 'vfx', entityId: 'd1-Lightning', role: 'host' },
    ]);
    expect(lightning.entity.data.mechanics).toMatchObject({
      perCastHits: {
        collisionChecks: 'floor(S/2)+6 per segment',
        damageRoll: 'once-per-segment',
        hitResult: 'persists-and-rechecks',
        monsterHitRecovery: { rule: expect.stringContaining('restart monster hit recovery') },
      },
      fizzle: { rule: expect.stringContaining('skips ConsumeSpell'), branches: [] },
      stoneCurseInteraction: { rule: expect.stringContaining('forces the random hit roll to 0') },
    });
  });

  it('distinguishes free fizzle branches from failures that still consume the resource', () => {
    expect(spellMechanics('Teleport').fizzle.branches).toEqual([
      expect.objectContaining({ setsSpellFizzled: true, resource: 'free' }),
    ]);
    expect(spellMechanics('Guardian').fizzle.branches[0]).toMatchObject({ resource: 'free' });
    expect(spellMechanics('FireWall').fizzle.branches[0]).toMatchObject({ resource: 'free' });
    expect(spellMechanics('StoneCurse').fizzle.branches).toEqual([
      expect.objectContaining({ setsSpellFizzled: true, resource: 'free' }),
      expect.objectContaining({ setsSpellFizzled: false, resource: 'consumed' }),
    ]);
    expect(spellMechanics('Golem').fizzle.branches[0]).toMatchObject({
      setsSpellFizzled: false, resource: 'consumed',
    });
    expect(spellMechanics('TownPortal').fizzle.branches[0]).toMatchObject({
      setsSpellFizzled: false, resource: 'consumed',
    });
    for (const spell of ['Teleport', 'Guardian', 'FireWall', 'StoneCurse', 'Golem', 'TownPortal']) {
      expect(spellMechanics(spell).fizzle.branches.every((branch) =>
        branch.refs.every((ref) => /^\.reference\/devilutionX\/Source\/missiles\.cpp:\d+-\d+$/.test(ref)))).toBe(true);
    }
  });

  it.each([
    ['Lightning', ['LightningControl', 'Lightning']],
    ['StoneCurse', ['StoneCurse']],
  ])('keeps %s mechanics and linked missiles inside the prompt reference budgets', (spell, missileIds) => {
    const [normalized] = withSpellMechanics([wrapper(spell)]);
    const missileEntities = missileIds.map(missile);
    const entities = [normalized.entity, ...missileEntities];
    const linked = collectLinkedReferences(normalized.entity, entities);
    const ownValues = entityValueLines({
      id: normalized.entity.id,
      name: normalized.entity.name,
      lifecycle: normalized.entity.lifecycle,
      data: normalized.entity.data,
      reference: {
        sourceGame: normalized.entity.provenance.sourceGame,
        sourceFile: normalized.entity.provenance.sourceFile,
        sourceRow: normalized.entity.provenance.sourceRow,
      },
    }, REFERENCE_MAX_CHARS);
    const linkedBlock = linkedReferencesBlock(normalized.entity, entities);

    expect(linked.map((entity) => entity.id)).toEqual(missileIds.map((id) => `d1-${id}`));
    expect(ownValues).toContain('- mechanics:');
    expect(ownValues).toContain('"fizzle"');
    expect(ownValues.length).toBeLessThanOrEqual(REFERENCE_MAX_CHARS);
    expect(linkedBlock).toContain('engineSpec');
    expect(linkedBlock.length).toBeLessThanOrEqual(LINKED_REFERENCES_MAX_CHARS);
    expect(linkedBlock).not.toContain('TRUNCATED');
  });
});
