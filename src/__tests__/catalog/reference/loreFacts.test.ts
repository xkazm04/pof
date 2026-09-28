import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  loadLoreGraph,
  loreFactsFor,
  resolveLoreSubject,
  withLoreFacts,
  type LoreGraph,
} from '@/lib/catalog/reference/loreFacts';

const graph: LoreGraph = {
  entities: [
    { id: 'orin-vale', name: 'Orin Vale', aliases: ['Orin'], kind: 'traveller' },
    { id: 'mira-quill', name: 'Mira Quill', aliases: ['the Archivist'], kind: 'scholar' },
  ],
  facts: [
    {
      subject: 'orin-vale', relation: 'consulted', object: 'mira-quill', qualifier: '',
      textIds: ['TEXT_SYNTH_A'], speakers: ['Synthetic narrator'], status: 'stated', optional: false,
    },
    {
      subject: 'mira-quill', relation: 'visited', object: 'somewhere-else', qualifier: '',
      textIds: ['TEXT_SYNTH_B'], speakers: ['Synthetic narrator'], status: 'rumoured', optional: true,
    },
  ],
  timeline: [
    { event: 'Orin met the Archivist after sunset.', order: 1, textIds: ['TEXT_SYNTH_A'] },
    { event: 'An unrelated bell rang.', order: 2, textIds: ['TEXT_SYNTH_C'] },
  ],
  consistency: [
    { kind: 'open-question', detail: 'Accounts disagree about Orin.', textIds: ['TEXT_SYNTH_A'] },
    { kind: 'open-question', detail: 'A different account is incomplete.', textIds: ['TEXT_SYNTH_D'] },
  ],
};

const entity = (id: string, name: string, data: unknown = {}): StoredCatalogEntity => ({
  id,
  catalogId: 'characters',
  name,
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data,
});

const tempDirs: string[] = [];
afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('loadLoreGraph', () => {
  it('loads a valid external graph and treats an absent file as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pof-lore-facts-'));
    tempDirs.push(dir);
    const path = join(dir, 'synthetic.json');
    writeFileSync(path, JSON.stringify(graph), 'utf8');

    expect(loadLoreGraph(path)).toEqual(graph);
    expect(loadLoreGraph(join(dir, 'absent.json'))).toEqual({
      entities: [], facts: [], timeline: [], consistency: [],
    });
  });

  it('rejects malformed graph records instead of silently dropping them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pof-lore-facts-'));
    tempDirs.push(dir);
    const path = join(dir, 'malformed.json');
    writeFileSync(path, JSON.stringify({ ...graph, facts: [{ subject: 7 }] }), 'utf8');
    expect(() => loadLoreGraph(path)).toThrow('Invalid lore graph at $.facts[0]');
  });
});

describe('lore fact matching', () => {
  it('matches normalized ids, exact names, aliases, and a unique phrase at a display-name edge', () => {
    expect(resolveLoreSubject(entity('d1-dialog-orin-vale', 'Unrelated'), graph)?.id).toBe('orin-vale');
    expect(resolveLoreSubject(entity('synthetic-a', 'Mira Quill'), graph)?.id).toBe('mira-quill');
    expect(resolveLoreSubject(entity('synthetic-b', 'The Archivist'), graph)?.id).toBe('mira-quill');
    expect(resolveLoreSubject(entity('synthetic-c', 'Orin the Traveller'), graph)?.id).toBe('orin-vale');
    expect(resolveLoreSubject(entity('synthetic-d', 'Someone', { aliases: ['Mira Quill'] }), graph)?.id)
      .toBe('mira-quill');
    expect(resolveLoreSubject(entity('synthetic-article', 'The Orin Vale'), graph)?.id).toBe('orin-vale');
  });

  it('refuses ambiguous aliases and does not use fuzzy spelling similarity', () => {
    const ambiguous: LoreGraph = {
      ...graph,
      entities: graph.entities.map((item) => ({ ...item, aliases: [...item.aliases, 'Sage'] })),
    };
    expect(resolveLoreSubject(entity('synthetic-e', 'Sage'), ambiguous)).toBeUndefined();
    expect(resolveLoreSubject(entity('synthetic-f', 'Mera Quil'), graph)).toBeUndefined();
  });

  it('returns subject and object facts plus only prose records that mention the subject', () => {
    const selected = loreFactsFor(entity('synthetic-g', 'Orin'), graph)!;
    expect(selected.subjectId).toBe('orin-vale');
    expect(selected.facts.map((fact) => fact.textIds)).toEqual([['TEXT_SYNTH_A']]);
    expect(selected.timeline.map((event) => event.textIds)).toEqual([['TEXT_SYNTH_A']]);
    expect(selected.consistency.map((note) => note.textIds)).toEqual([['TEXT_SYNTH_A']]);

    const objectSelected = loreFactsFor(entity('synthetic-h', 'Mira Quill'), graph)!;
    expect(objectSelected.facts.map((fact) => fact.textIds)).toEqual([
      ['TEXT_SYNTH_A'], ['TEXT_SYNTH_B'],
    ]);
  });

  it('attaches without mutation and preserves an unmatched entity byte-for-byte', () => {
    const source = entity('synthetic-i', 'Orin', { existing: true });
    const attached = withLoreFacts(source, graph);
    expect(attached).not.toBe(source);
    expect(source.data).toEqual({ existing: true });
    expect((attached.data as Record<string, unknown>).existing).toBe(true);
    expect((attached.data as Record<string, unknown>).loreFacts).toEqual(loreFactsFor(source, graph));

    const unmatched = entity('synthetic-j', 'No Match', { existing: true });
    expect(withLoreFacts(unmatched, graph)).toBe(unmatched);
  });
});
