import { describe, expect, it } from 'vitest';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  allQuestCausalityLedgers,
  D1_QUEST_CAUSALITY_DATA,
  D1_QUEST_CAUSALITY_DEPENDENCIES,
  D1_QUEST_SPEC_CAUSALITY_FINDINGS,
  questCausality,
  seedQuestCausalityStep,
  withQuestCausality,
} from '@/lib/catalog/reference/questCausality';
import { D1_VANILLA_QUEST_IDS } from '@/lib/catalog/reference/questSpecs';

function entity(id: string, data: unknown = { derived: { expansion: 'diablo' } }): StoredCatalogEntity {
  return {
    id,
    catalogId: 'quests',
    name: id,
    categoryPath: [],
    tags: [],
    lifecycle: 'planned',
    data,
  };
}

describe('quest causality data', () => {
  it('covers every vanilla quest with ordered, pinned transitions', () => {
    expect(Object.keys(D1_QUEST_CAUSALITY_DATA)).toEqual([...D1_VANILLA_QUEST_IDS]);
    for (const ledger of allQuestCausalityLedgers()) {
      expect(ledger.transitions.length).toBeGreaterThan(0);
      expect(new Set(ledger.transitions.map((transition) => transition.id)).size).toBe(ledger.transitions.length);
      for (const id of [...ledger.startTransitionIds, ...ledger.completionTransitionIds]) {
        expect(ledger.transitions.some((transition) => transition.id === id)).toBe(true);
      }
      for (const transition of ledger.transitions) {
        expect(transition.guard.length).toBeGreaterThan(0);
        expect(transition.effect.length).toBeGreaterThan(0);
        expect(transition.refs.length).toBeGreaterThan(0);
        for (const sourceRef of transition.refs) {
          expect(sourceRef).toMatch(/^\.reference\/devilutionX\/Source\/.+\.cpp:\d+(?:-\d+)?$/);
        }
      }
    }
  });

  it('records the causal splits found by the audit', () => {
    const veil = questCausality('d1-Q_VEIL')!;
    expect(veil.transitions.find((transition) => transition.id === 'hand-in-golden-elixir')!.effect)
      .toContain('immediately spawn UITEM_STEELVEIL');
    expect(veil.transitions.find((transition) => transition.id === 'finish-final-speech')!.effect)
      .not.toContain('UITEM_STEELVEIL');

    const banner = questCausality('d1-Q_LTBANNER')!;
    expect(banner.transitions.find((transition) => transition.id === 'hand-in-sign-snotspill')!.effect)
      .toContain('_qactive=QUEST_DONE');
    expect(banner.transitions.find((transition) => transition.id === 'finish-snotspill-exchange')!.effect)
      .toContain('_qvar1=3');

    for (const monster of ['UniqueMonsterType::BlackJade', 'UniqueMonsterType::RedVex']) {
      const dependency = D1_QUEST_CAUSALITY_DEPENDENCIES.find((item) => item.to.id === monster)!;
      expect(dependency.from).toMatchObject({ id: 'd1-Q_BETRAYER', transitionId: 'finish-lazarus-greeting' });
      expect(dependency.effect).toContain('no ');
    }
    expect(D1_QUEST_SPEC_CAUSALITY_FINDINGS.map((finding) => finding.questId))
      .toEqual(['d1-Q_VEIL', 'd1-Q_LTBANNER', 'd1-Q_BETRAYER', 'd1-Q_ZHAR']);
  });
});

describe('synthetic quest integration', () => {
  it('attaches a serializable ledger without mutating the promoted projection input', () => {
    const synthetic = entity('d1-Q_VEIL', { derived: { expansion: 'diablo' }, marker: 'keep' });
    const attached = withQuestCausality(synthetic);
    expect(attached).not.toBe(synthetic);
    expect((synthetic.data as Record<string, unknown>).causality).toBeUndefined();
    expect((attached.data as Record<string, unknown>).marker).toBe('keep');
    expect(((attached.data as Record<string, unknown>).causality as { questId: string }).questId).toBe('d1-Q_VEIL');
    expect(() => JSON.stringify(attached)).not.toThrow();
  });

  it('leaves Hellfire and unknown synthetic quests unattached', () => {
    const hellfire = entity('d1-Q_GRAVE', { derived: { expansion: 'hellfire' } });
    expect(withQuestCausality(hellfire)).toBe(hellfire);
    expect(seedQuestCausalityStep(hellfire)).toBeUndefined();
  });

  it('builds the checker-shaped SOURCED trigger artifact from the ledger', () => {
    const seed = seedQuestCausalityStep(entity('d1-Q_LTBANNER'))!;
    expect(seed.step).toBe('Triggers & World-State');
    expect(seed.gaps).toEqual([]);
    expect(seed.data.sourced).toBeDefined();
    expect(seed.data.causality).toMatchObject({ questId: 'd1-Q_LTBANNER' });
    expect(seed.data.triggers).toMatchObject({
      start: expect.any(String),
      fail: expect.any(String),
      worldMutation: expect.any(String),
    });
  });
});
