import { describe, expect, it } from 'vitest';
import { loreParity, type LoreFactGraph, type LoreParityArtifact } from '@/lib/catalog/reference/loreParity';

const graph: LoreFactGraph = {
  entities: [
    { id: 'e-mapmaker', name: 'Copper Mapmaker', aliases: ['The Surveyor'], kind: 'person' },
    { id: 'e-orchard', name: 'Glass Orchard', aliases: ['Shining Grove'], kind: 'place' },
    { id: 'e-comet', name: 'Paper Comet', aliases: [], kind: 'event' },
    { id: 'e-council', name: 'Velvet Council', aliases: [], kind: 'group' },
  ],
  facts: [
    { subject: 'e-mapmaker', relation: 'charted', object: 'e-orchard', textIds: ['PAGE_A'], speakers: [], status: 'stated' },
    { subject: 'e-orchard', relation: 'observed', object: 'e-mapmaker', textIds: ['PAGE_A'], speakers: [], status: 'implied' },
    { subject: 'e-mapmaker', relation: 'recorded', object: 'e-comet', textIds: ['PAGE_OTHER'], speakers: [], status: 'stated' },
    { subject: 'e-orchard', relation: 'hosts', object: 'e-council', textIds: ['PAGE_B'], speakers: [], status: 'rumoured' },
  ],
};

const artifact: LoreParityArtifact = {
  catalogId: 'codex',
  entityId: 'entry-mapmaker',
  step: 'Cross-References',
  data: {
    graph: {
      nodes: [
        { id: 'codex::entry-mapmaker' },
        { id: 'SHINING GROVE' },
        { id: 'Paper Comet' },
        { id: 'Velvet Council' },
        { id: 'Clockwork Lagoon' },
      ],
      edges: [
        { from: 'SHINING GROVE', to: 'codex::entry-mapmaker' },
        { from: 'codex::entry-mapmaker', to: 'Paper Comet' },
        { from: 'SHINING GROVE', to: 'Velvet Council' },
        { from: 'Clockwork Lagoon', to: 'Paper Comet' },
      ],
    },
  },
};

describe('loreParity', () => {
  it('selects facts by source text or the entry subject and deduplicates recall pairs', () => {
    const report = loreParity({
      graph,
      entries: [{ entityId: 'entry-mapmaker', name: 'The Surveyor', textIds: ['PAGE_A'] }],
      artifacts: [artifact],
    });
    const entry = report.entries[0];

    expect(entry.referenceFacts).toHaveLength(3);
    expect(entry.referencePairs).toBe(2);
    expect(entry.coveredReferencePairs).toBe(2);
    expect(entry.recall).toBe(1);
  });

  it('matches names, aliases, case, and catalog-qualified ids in either edge direction', () => {
    const entry = loreParity({
      graph,
      entries: [{ entityId: 'entry-mapmaker', name: 'Copper Mapmaker', textIds: ['PAGE_A'] }],
      artifacts: [artifact],
    }).entries[0];

    expect(entry.supported).toHaveLength(2);
    expect(entry.supported[0]).toMatchObject({
      fromEntities: ['e-orchard'],
      toEntities: ['e-mapmaker'],
    });
    expect(entry.unsupported).toHaveLength(1);
    expect(entry.unresolvedNodes.map((node) => node.id)).toEqual(['Clockwork Lagoon']);
    expect(entry.precision).toBe(0.5);
  });

  it('aggregates totals and returns null rates for empty denominators (nothing to measure is not a failure)', () => {
    const report = loreParity({
      graph,
      entries: [
        { entityId: 'entry-mapmaker', name: 'Copper Mapmaker', textIds: ['PAGE_A'] },
        { entityId: 'entry-empty', name: 'Unwritten Almanac', textIds: ['PAGE_NONE'] },
      ],
      artifacts: [artifact],
    });

    expect(report.entries[1]).toMatchObject({ precision: null, recall: null, referencePairs: 0 });
    expect(report.totals).toMatchObject({
      entries: 2,
      referenceFacts: 3,
      referencePairs: 2,
      coveredReferencePairs: 2,
      producedEdges: 4,
      supported: 2,
      unsupported: 1,
      unresolvedNodes: 1,
      precision: 0.5,
      recall: 1,
    });
  });

  it('matches a produced node by its label or by the graph entity id, ignoring a leading article', () => {
    const report = loreParity({
      graph,
      entries: [{ entityId: 'entry-mapmaker', name: 'Copper Mapmaker', textIds: ['PAGE_A'] }],
      artifacts: [{
        catalogId: 'codex',
        entityId: 'entry-mapmaker',
        step: 'Cross-References',
        data: {
          graph: {
            nodes: [{ id: 'node-1', label: 'The Copper Mapmaker' }, { id: 'e-orchard', label: 'Somewhere' }],
            edges: [{ from: 'node-1', to: 'e-orchard' }],
          },
        },
      }],
    });

    expect(report.entries[0].unresolvedNodes).toEqual([]);
    expect(report.entries[0].supported).toHaveLength(1);
  });
});
