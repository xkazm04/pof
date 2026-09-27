import { describe, expect, it } from 'vitest';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { TownerLedgerData } from '@/lib/catalog/reference/townerLedger';
import {
  allTalkLedgers,
  auditTalkLedgerConsistency,
  D1_TALKING_MONSTER_LEDGERS,
  D1_TOWNER_TALK_LEDGERS,
  DIALOG_TREE_TALK_LAYER_GAPS,
  gossipPoolSize,
  TALK_LEDGER_FINDINGS,
  talkLedger,
  talkingMonsterTalkLedger,
  withTalkLedger,
  type TalkPreMenuHandler,
  type TownerTalkLedgerData,
} from '@/lib/catalog/reference/talkLedger';

describe('talk ledger data', () => {
  it('covers vanilla towners, flags Hellfire-only towners, and records all talking uniques', () => {
    expect(D1_TOWNER_TALK_LEDGERS).toHaveLength(13);
    expect(D1_TOWNER_TALK_LEDGERS.filter((ledger) => ledger.scope === 'vanilla-single-player')).toHaveLength(10);
    expect(D1_TOWNER_TALK_LEDGERS.filter((ledger) => ledger.scope === 'hellfire-flag-only').map((ledger) => ledger.towner))
      .toEqual(['TOWN_FARMER', 'TOWN_COWFARM', 'TOWN_GIRL']);
    expect(D1_TALKING_MONSTER_LEDGERS).toHaveLength(8);
    expect(allTalkLedgers()).toHaveLength(21);
  });

  it('keeps conditional menu order, quest-dialog gating, and initialization-selected gossip explicit', () => {
    const smith = talkLedger('TOWN_SMITH')!;
    expect(smith.menuEntries.map((entry) => entry.id)).toEqual([
      'talk', 'buy-basic', 'buy-premium', 'sell', 'repair', 'visual-trade-repair', 'leave',
    ]);
    expect(smith.questTopics[0]).toMatchObject({
      quest: 'Q_ROCK',
      speech: 'TEXT_INFRA6',
      repeatRule: 'repeatable-while-condition',
    });
    expect(smith.questTopics[0].availabilityCondition).toContain('Quests[Q_ROCK]._qactive == QUEST_ACTIVE');
    expect(smith.questTopics[0].availabilityCondition).toContain('Quests[Q_ROCK]._qlog');
    expect(smith.gossip).toMatchObject({ menuOrder: 'before-quest-topics' });
    expect(gossipPoolSize(smith.gossip)).toBe(11);
    expect(smith.gossip!.selectionRule).toContain('GenerateRnd');
    expect(smith.gossip!.repeatRule).toContain('reuses Towner::gossip');
  });

  it('distinguishes state-guarded lines from lines repeatable under an unchanged condition', () => {
    const ogden = talkLedger('TOWN_TAVERN')!;
    expect(ogden.preMenuHandlers[0]).toMatchObject({
      id: 'intro-before-visiting-dungeon',
      speech: ['TEXT_INTRO'],
      repeatRule: 'repeatable-while-condition',
      outcome: 'stop-before-menu',
    });
    expect(ogden.preMenuHandlers.at(-1)).toMatchObject({
      id: 'tavern-fallback',
      speech: ['TEXT_OGDEN1'],
      repeatRule: 'repeatable',
      outcome: 'open-menu',
    });
    expect(talkLedger('TOWN_WITCH')!.preMenuHandlers.find((handler) => handler.id === 'mushroom-reminder'))
      .toMatchObject({ speech: ['TEXT_MUSH9'], repeatRule: 'one-shot-state-guarded' });
  });

  it('records monster talk-message sequences and the non-semantic quest-complete flag uses', () => {
    expect(talkingMonsterTalkLedger('d1-uniq-gharbad-the-weak')).toMatchObject({
      monster: 'UniqueMonsterType::Garbud',
      speechSequence: ['TEXT_GARBUD1', 'TEXT_GARBUD2', 'TEXT_GARBUD3', 'TEXT_GARBUD4'],
      questFlags: [expect.objectContaining({ flag: 'MFLAG_QUEST_COMPLETE' })],
    });
    expect(talkingMonsterTalkLedger('UniqueMonsterType::Lazarus')).toMatchObject({
      initialSpeech: 'TEXT_VILE13',
      questFlags: [],
    });
  });

  it('reports only the two independently observed older-ledger disagreements', () => {
    expect(TALK_LEDGER_FINDINGS.map((finding) => [finding.dataset, finding.subject, finding.field])).toEqual([
      ['questCausalityData', 'd1-Q_MUSHROOM', 'mushroom-reminder'],
      ['townerLedgerData', 'TOWN_COW', 'preMenuHandlers order'],
    ]);
    expect(DIALOG_TREE_TALK_LAYER_GAPS.map((gap) => gap.ledgerFields).flat()).toContain('gossip.selectionRule');
  });
});

function syntheticHandler(id: string, speech: `TEXT_${string}`): TalkPreMenuHandler {
  return {
    id,
    phase: 'pre-menu',
    quest: 'Q_SYNTH',
    triggerCondition: `${id} condition`,
    effect: `${id} effect`,
    speech: [speech],
    repeatRule: 'one-shot-state-guarded',
    outcome: 'stop-before-menu',
    mutatesQuestState: false,
    refs: ['synthetic.cpp:1'],
  };
}

function syntheticTowner(handlers: readonly TalkPreMenuHandler[]): TownerTalkLedgerData {
  return {
    kind: 'towner',
    towner: 'TOWN_SYNTH',
    entityId: 'd1-TOWN_SYNTH',
    scope: 'vanilla-single-player',
    menuEntries: [],
    questTopics: [],
    gossip: null,
    preMenuHandlers: handlers,
    refs: ['synthetic.cpp:1'],
  };
}

function syntheticLegacy(speechLineIds: readonly string[]): TownerLedgerData {
  return {
    towner: 'TOWN_SYNTH', name: 'Synthetic', expansion: 'diablo', scope: 'full',
    preMenuHandlers: speechLineIds.map((speech, index) => ({
      quest: 'Q_SYNTH', condition: `condition ${index}`, effect: `effect ${index}`,
      speechLineIds: [speech], consumesTurn: true, refs: ['synthetic.cpp:1'],
    })),
    services: [], greetingRules: [], firstVisitBehavior: null, refs: ['synthetic.cpp:1'],
  };
}

describe('synthetic towner integration', () => {
  const first = syntheticHandler('first', 'TEXT_SYNTH_FIRST');
  const second = syntheticHandler('second', 'TEXT_SYNTH_SECOND');

  it('audits ordered handlers rather than treating them as an unordered set', () => {
    expect(auditTalkLedgerConsistency(
      [syntheticTowner([first, second])],
      [syntheticLegacy(['TEXT_SYNTH_FIRST', 'TEXT_SYNTH_SECOND'])],
      {},
    )).toEqual([]);
    expect(auditTalkLedgerConsistency(
      [syntheticTowner([first, second])],
      [syntheticLegacy(['TEXT_SYNTH_SECOND', 'TEXT_SYNTH_FIRST'])],
      {},
    )).toEqual([expect.objectContaining({
      dataset: 'townerLedgerData', subject: 'TOWN_SYNTH', field: 'preMenuHandlers order',
    })]);
  });

  it('attaches town and monster ledgers without mutating the promoted entity candidate', () => {
    const town: StoredCatalogEntity = {
      id: 'd1-dialog-TOWN_SMITH', catalogId: 'dialog-trees', name: 'Synthetic Smith',
      categoryPath: [], lifecycle: 'planned', tags: [], links: [],
      data: { speaker: 'd1-TOWN_SMITH', ledger: { existing: true } },
    };
    const attachedTown = withTalkLedger(town);
    expect(attachedTown).not.toBe(town);
    expect((town.data as Record<string, unknown>).talkLedger).toBeUndefined();
    expect(((attachedTown.data as Record<string, unknown>).talkLedger as { towner: string }).towner).toBe('TOWN_SMITH');
    expect((attachedTown.data as Record<string, unknown>).ledger).toEqual({ existing: true });

    const monster: StoredCatalogEntity = {
      ...town,
      id: 'd1-dialog-gharbad-the-weak',
      data: { speaker: 'd1-uniq-gharbad-the-weak', talker: 'monster' },
    };
    expect(((withTalkLedger(monster).data as Record<string, unknown>).talkLedger as { monster: string }).monster)
      .toBe('UniqueMonsterType::Garbud');
  });
});
