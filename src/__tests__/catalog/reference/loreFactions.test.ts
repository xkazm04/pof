import { describe, expect, it } from 'vitest';
import { loreFactionEntities } from '@/lib/catalog/reference/loreFactions';
import type { LoreGraph } from '@/lib/catalog/reference/loreFacts';

const graph: LoreGraph = {
  entities: [
    { id: 'ivory-order', name: 'Ivory Order', aliases: ['Pale Wardens'], kind: 'faction/order' },
    { id: 'ember-brotherhood', name: 'Ember Brotherhood', aliases: [], kind: 'group/brotherhood' },
    { id: 'five-scribes', name: 'Five Scribes', aliases: [], kind: 'group' },
    { id: 'lone-scribe', name: 'Lone Scribe', aliases: [], kind: 'character' },
  ],
  facts: [{
    subject: 'ivory-order', relation: 'guards', object: 'archive', qualifier: '',
    textIds: ['TEXT_SYNTH_ORDER'], speakers: ['Synthetic narrator'], status: 'stated', optional: false,
  }],
  timeline: [{ event: 'The Ember Brotherhood assembled.', order: 1, textIds: ['TEXT_SYNTH_EMBER'] }],
  consistency: [],
};

describe('loreFactionEntities', () => {
  it('projects explicit faction-like kinds with aliases, lore facts, and runtime source provenance', () => {
    const wrappers = loreFactionEntities(graph, 'operator-graph.json', 'synthetic-time');

    expect(wrappers.map((wrapper) => wrapper.entity.id)).toEqual([
      'd1-ivory-order',
      'd1-ember-brotherhood',
    ]);
    expect(wrappers[0].entity).toMatchObject({
      catalogId: 'factions',
      name: 'Ivory Order',
      data: {
        aliases: ['Pale Wardens'],
        kind: 'faction/order',
        loreFacts: { subjectId: 'ivory-order', facts: [{ textIds: ['TEXT_SYNTH_ORDER'] }] },
      },
      provenance: {
        sourceFile: 'operator-graph.json; text/textdat.tsv',
        sourceRow: 'TEXT_SYNTH_ORDER',
        ingestedAt: 'synthetic-time',
      },
    });
    expect(wrappers[1].entity.data.loreFacts.timeline).toEqual(graph.timeline);
  });

  it('does not promote generic groups or anything when the external graph is empty', () => {
    expect(loreFactionEntities(graph, 'operator-graph.json').some(
      (wrapper) => wrapper.entity.id === 'd1-five-scribes',
    )).toBe(false);
    expect(loreFactionEntities({ entities: [], facts: [], timeline: [], consistency: [] }, 'absent.json'))
      .toEqual([]);
  });
});
