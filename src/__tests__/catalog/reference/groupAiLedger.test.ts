import { describe, expect, it } from 'vitest';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  GROUP_AI_LEDGER,
  GROUP_AI_ROUTINE_IDS,
  auditGroupAiLedger,
  groupAiForRoutine,
  withGroupAi,
  type GroupAiLedger,
} from '@/lib/catalog/reference/groupAiLedger';

function aiEntity(routine: string): StoredCatalogEntity {
  return {
    id: `d1-ai-${routine.toLowerCase()}`,
    catalogId: 'state-graph',
    name: `${routine} AI`,
    categoryPath: [],
    tags: [],
    lifecycle: 'planned',
    data: { routine, untouched: true },
  };
}

describe('Diablo I group AI ledger', () => {
  it('records the complete relation state machine with line-backed laws', () => {
    expect(GROUP_AI_LEDGER.relations.map((entry) => entry.state)).toEqual([
      'LeaderRelation::None',
      'LeaderRelation::Leashed',
      'LeaderRelation::Separated',
    ]);
    for (const relation of GROUP_AI_LEDGER.relations) {
      expect(relation.enteredWhen.length, relation.state).toBeGreaterThan(0);
      expect(relation.leavesWhen.length, relation.state).toBeGreaterThan(0);
      expect(relation.perTick.length, relation.state).toBeGreaterThan(0);
      expect(relation.refs.every((ref) => /:\d+(?:-\d+)?$/.test(ref)), relation.state).toBe(true);
    }
    expect(auditGroupAiLedger()).toEqual([]);
  });

  it('distinguishes bidirectional activation from target non-inheritance', () => {
    const byId = new Map(GROUP_AI_LEDGER.inheritance.map((entry) => [entry.id, entry]));
    expect(byId.get('leader-activation-to-minion')).toMatchObject({
      direction: 'leader->minion',
      what: 'activeForTicks and position.last',
    });
    expect(byId.get('minion-activation-to-leader')).toMatchObject({
      direction: 'minion->leader',
      what: 'activeForTicks and position.last',
    });
    expect(byId.get('enemy-target-not-shared')).toMatchObject({
      direction: 'not-shared',
      what: 'enemy, MFLAG_TARGETS_MONSTER, and enemyPosition',
    });
  });

  it('pins leader death, Fallen morale, summons, and Hellfire scope as separate events', () => {
    const byId = new Map(GROUP_AI_LEDGER.events.map((event) => [event.id, event]));
    expect(byId.get('leader-death-release')?.effect).toContain('Separated children are not selected');
    expect(byId.get('fallen-death-fear')?.radiusOrTimer).toContain('runDistance = max(8 - monster.data().level, 2)');
    expect(byId.get('fallen-war-cry-rally')?.radiusOrTimer).toContain('goalVar1 = 30 * monster.intelligence + 105');
    expect(byId.get('skeleton-king-summon')).toMatchObject({ expansion: 'diablo', routines: ['SkeletonKing'] });
    expect(byId.get('hork-demon-summon')).toMatchObject({ expansion: 'hellfire-flag-only', routines: ['HorkDemon'] });
  });

  it('attaches a common group layer plus routine-specific behavior without mutating the entity', () => {
    const source = aiEntity('Fallen');
    const attached = withGroupAi(source);
    const groupAi = (attached.data as Record<string, unknown>).groupAi as ReturnType<typeof groupAiForRoutine>;

    expect(attached).not.toBe(source);
    expect(source.data).toEqual({ routine: 'Fallen', untouched: true });
    expect(groupAi?.routine).toBe('Fallen');
    expect(groupAi?.uses.map((entry) => entry.routine)).toEqual(['all-routines', 'Fallen']);
    expect(groupAi?.events.map((event) => event.id)).toEqual(expect.arrayContaining([
      'fallen-death-fear', 'fallen-war-cry-rally', 'leash-separation',
    ]));

    const unrelated = aiEntity('not-a-routine');
    expect(withGroupAi(unrelated)).toBe(unrelated);
  });

  it('provides the common group layer to every promoted D1 AI routine', () => {
    expect(GROUP_AI_ROUTINE_IDS).toHaveLength(33);
    for (const routine of GROUP_AI_ROUTINE_IDS) {
      const attachment = groupAiForRoutine(routine);
      expect(attachment?.routine).toBe(routine);
      expect(attachment?.uses[0]).toMatchObject({ routine: 'all-routines', phase: 'common-loop' });
    }
  });

  it('audits synthetic duplicate, dangling-event, source-ref, and consequence-rank failures', () => {
    const synthetic = {
      ...GROUP_AI_LEDGER,
      relations: [GROUP_AI_LEDGER.relations[0], GROUP_AI_LEDGER.relations[0]],
      routines: [{
        ...GROUP_AI_LEDGER.routines[0],
        eventIds: ['missing-event'],
        refs: ['synthetic-without-line'],
      }],
      packConsequences: [GROUP_AI_LEDGER.packConsequences[0]],
    } as GroupAiLedger;
    const issues = auditGroupAiLedger(synthetic);

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ section: 'relations', issue: 'duplicate id' }),
      expect.objectContaining({ section: 'routines', issue: 'unknown event missing-event' }),
      expect.objectContaining({ section: 'routines', issue: 'every ref must end in file:line or file:start-end' }),
      expect.objectContaining({ section: 'packConsequences', id: 'ranks' }),
    ]));
  });

  it('ranks exactly three named pack-model consequences', () => {
    expect(GROUP_AI_LEDGER.packConsequences.map(({ rank, name }) => ({ rank, name }))).toEqual([
      { rank: 1, name: 'Conditional engagement concurrency' },
      { rank: 2, name: 'Dynamic summon roster' },
      { rank: 3, name: 'Fallen casualty morale' },
    ]);
  });
});
