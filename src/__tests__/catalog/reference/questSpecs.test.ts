import { describe, expect, it } from 'vitest';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  D1_QUEST_SPECS,
  D1_VANILLA_QUEST_IDS,
  seedQuestSteps,
} from '@/lib/catalog/reference/questSpecs';

function entity(id: string, data: unknown, links: StoredCatalogEntity['links'] = []): StoredCatalogEntity {
  return {
    id,
    catalogId: id.startsWith('d1-dialog-') ? 'dialog-trees' : 'quests',
    name: id,
    categoryPath: [],
    tags: [],
    lifecycle: 'planned',
    data,
    links,
  };
}

const rock = entity(
  'd1-Q_ROCK',
  { derived: { expansion: 'diablo' } },
  [{ catalogId: 'dialog-trees', entityId: 'd1-TEXT_INFRA5', role: 'quest-log-line' }],
);

describe('D1_QUEST_SPECS', () => {
  it('has one engine-derived specification for every vanilla quest id', () => {
    expect(Object.keys(D1_QUEST_SPECS).sort()).toEqual([...D1_VANILLA_QUEST_IDS].sort());
  });

  it('gives every quest at least one pinned source reference', () => {
    for (const spec of Object.values(D1_QUEST_SPECS)) {
      expect(spec.refs.length).toBeGreaterThanOrEqual(1);
      for (const ref of spec.refs) {
        expect(ref.startsWith('https://github.com/diasurgical/devilutionX/blob/4138a82/Source/')).toBe(true);
      }
    }
  });

  it('stores each speaking line as one TEXT_* identifier', () => {
    for (const spec of Object.values(D1_QUEST_SPECS)) {
      for (const line of spec.lines) expect(line.line).toMatch(/^TEXT_[A-Z0-9_]+$/);
    }
  });
});

describe('seedQuestSteps', () => {
  it('does not seed Hellfire quests', () => {
    expect(seedQuestSteps(entity('d1-Q_GRAVE', { derived: { expansion: 'hellfire' } }), [])).toEqual([]);
  });

  it('has no fail terminal and names the failure law in Objective Graph gaps', () => {
    const seed = seedQuestSteps(rock, []).find((item) => item.step === 'Objective Graph')!;
    const graph = seed.data.graph as { nodes: { id: string; terminal?: boolean }[] };
    expect(graph.nodes.some((node) => node.id.includes('fail'))).toBe(false);
    expect(graph.nodes.filter((node) => node.terminal).map((node) => node.id)).toEqual(['success']);
    expect(seed.gaps.some((gap) => gap.includes('d1-quest-failure-law'))).toBe(true);
  });

  it('links exactly the synthetic town conversations whose topics name the quest', () => {
    const conversations = [
      entity('d1-dialog-TOWN_SMITH', { topics: [{ quest: 'Q_ROCK' }] }),
      entity('d1-dialog-TOWN_HEALER', { topics: [{ questEntity: 'd1-Q_ROCK' }] }),
      entity('d1-dialog-TOWN_STORY', { topics: [{ quest: 'Q_DIABLO' }] }),
      entity('dialog-not-a-diablo-towner', { topics: [{ quest: 'Q_ROCK' }] }),
    ];
    const seed = seedQuestSteps(rock, conversations).find((item) => item.step === 'NPC & Dialog Binding')!;
    expect(seed.data.links).toEqual([
      { catalogId: 'dialog-trees', entityId: 'd1-dialog-TOWN_SMITH', role: 'quest-dialog' },
      { catalogId: 'dialog-trees', entityId: 'd1-dialog-TOWN_HEALER', role: 'quest-dialog' },
    ]);
  });

  it('marks every quest seed SOURCED', () => {
    const seeds = seedQuestSteps(rock, []);
    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) expect(seed.data.sourced).toBeDefined();
  });
});
