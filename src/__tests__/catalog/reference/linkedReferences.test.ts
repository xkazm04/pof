import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import {
  collectLinkedReferences,
  linkedReferencesBlock,
} from '@/lib/catalog/reference/linkedReferences';
import { buildStepProducePrompt } from '@/lib/catalog/stepPrompt';
import type { EntityProvenance, StoredCatalogEntity } from '@/lib/catalog/types';

const provenance = (row: string): EntityProvenance => ({
  kind: 'ingest',
  sourceGame: 'Synthetic Reference',
  sourceProject: 'synthetic-fixture',
  sourceFile: 'fixtures/entities.tsv',
  sourceRow: row,
  licenceNote: 'test fixture',
  ingestedAt: 'test-time',
  canonProfile: 'pof',
});

const character: StoredCatalogEntity = {
  id: 'character-guide',
  catalogId: 'characters',
  name: 'Guide',
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data: { role: 'guide' },
  provenance: provenance('character-guide'),
};

const dialog: StoredCatalogEntity = {
  id: 'dialog-guide',
  catalogId: 'dialog-trees',
  name: 'Guide conversation',
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data: {
    ledger: {
      preMenuHandlers: [{ quest: 'quest-welcome', effect: 'offer the welcome task' }],
      services: [{ service: 'supplies', condition: 'after introduction' }],
      talkTopics: [{ topic: 'welcome', lineIds: ['LINE_WELCOME'] }],
    },
  },
  links: [
    { catalogId: 'characters', entityId: character.id, role: 'host' },
    { catalogId: 'quests', entityId: 'quest-welcome', role: 'advances' },
  ],
  provenance: provenance('dialog-guide'),
};

const quest: StoredCatalogEntity = {
  id: 'quest-welcome',
  catalogId: 'quests',
  name: 'Welcome task',
  categoryPath: [],
  tags: [],
  lifecycle: 'planned',
  data: { objective: 'Bring the sealed note to the archivist.' },
  provenance: provenance('quest-welcome'),
};

const entities = [character, dialog, quest];

describe('linked produce-prompt references', () => {
  it('carries a character\'s incoming-linked dialog ledger and its linked quest', () => {
    const linked = collectLinkedReferences(character, entities);
    expect(linked.map((entity) => `${entity.catalogId}/${entity.id}`)).toEqual([
      'dialog-trees/dialog-guide',
      'quests/quest-welcome',
    ]);

    const step = getCatalogPipeline('characters')!.steps.find((candidate) => candidate.label === 'Concept & Role')!;
    const prompt = buildStepProducePrompt(step, {
      id: character.id,
      name: character.name,
      lifecycle: character.lifecycle,
      data: character.data,
      links: character.links,
    }, undefined, { catalogId: 'characters', rules: [], linkedEntities: entities });

    expect(prompt).toContain('## Linked reference: dialog-trees dialog-guide — ground truth, cite it');
    expect(prompt).toContain('"services":[{"service":"supplies","condition":"after introduction"}]');
    expect(prompt).toContain('## Linked reference: quests quest-welcome — ground truth, cite it');
    expect(prompt).toContain('Bring the sealed note to the archivist.');
    expect(prompt.indexOf('# LINKED REFERENCES')).toBeLessThan(prompt.indexOf('# ACCEPTANCE CONTRACT'));
  });

  it('marks budget truncation explicitly and stays inside the requested cap', () => {
    const oversizedDialog = {
      ...dialog,
      data: { ledger: { summary: 'x'.repeat(2000) } },
    };
    const cap = 400;
    const block = linkedReferencesBlock(character, [character, oversizedDialog, quest], cap);

    expect(block.length).toBeLessThanOrEqual(cap);
    expect(block).toContain(`TRUNCATED at ${cap} characters`);
    expect(block).toContain('additional linked ground truth was NOT shown');
  });
});
