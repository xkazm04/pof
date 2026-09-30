import { describe, expect, it } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { getCatalogPipeline } from '@/lib/catalog/pipeline-registry';
import { graphValid } from '@/lib/catalog/acceptance/graphCheckers';
import { seedDialogSteps } from '@/lib/catalog/reference/dialogueTrees';
import {
  allTownerLedgers,
  TOWNER_LEDGER_DATA,
  townerLedger,
} from '@/lib/catalog/reference/townerLedger';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

describe('townerLedger', () => {
  it('covers every vanilla towner and flags the three Hellfire towners without expanding their behavior', () => {
    const ledgers = allTownerLedgers();
    expect(ledgers).toHaveLength(13);
    expect(ledgers.filter((ledger) => ledger.expansion === 'diablo' && ledger.scope === 'full')).toHaveLength(10);
    expect(ledgers.filter((ledger) => ledger.expansion === 'hellfire')).toEqual(expect.arrayContaining([
      expect.objectContaining({ towner: 'TOWN_FARMER', scope: 'flag-only' }),
      expect.objectContaining({ towner: 'TOWN_COWFARM', scope: 'flag-only' }),
      expect.objectContaining({ towner: 'TOWN_GIRL', scope: 'flag-only' }),
    ]));
    expect(TOWNER_LEDGER_DATA.every((ledger) => ledger.refs.length > 0)).toBe(true);
  });

  it('keeps optional Talk topics separate from ordered pre-menu handlers', () => {
    const ledger = townerLedger('TOWN_SMITH', {
      gossipLineIds: ['TEXT_SYNTH_GOSSIP'],
      topics: [{ quest: 'Q_SYNTHETIC', line: 'TEXT_SYNTH_TOPIC' }],
    })!;
    expect(ledger.preMenuHandlers.map((handler) => handler.quest)).toEqual([
      'Q_ROCK', 'Q_ROCK', 'Q_ANVIL', 'Q_ANVIL',
    ]);
    expect(ledger.talkTopics).toEqual([expect.objectContaining({
      topic: 'Q_SYNTHETIC', lineIds: ['TEXT_SYNTH_TOPIC'], rotates: false,
    })]);
    expect(ledger.gossip).toMatchObject({
      lineIds: ['TEXT_SYNTH_GOSSIP'], selection: 'random-on-towner-initialization', rotates: false,
    });
  });

  it('records the consequential handler and service exceptions', () => {
    expect(townerLedger('TOWN_DRUNK')!.preMenuHandlers).toEqual([]);
    expect(townerLedger('TOWN_PEGBOY')!.preMenuHandlers).toEqual([]);
    expect(townerLedger('TOWN_BMAID')!.preMenuHandlers.map((handler) => handler.quest)).toEqual(['Q_GRAVE']);
    expect(townerLedger('TOWN_BMAID')!.services.map((service) => service.service)).toEqual(['storage']);
    expect(townerLedger('TOWN_STORY')!.services.map((service) => service.service)).toEqual(['identify']);
    expect(townerLedger('TOWN_HEALER')!.services[0]).toMatchObject({ service: 'heal', trigger: 'menu-open' });
  });

  it('puts Ogden first-visit TEXT_INTRO ahead of every quest handler', () => {
    const ogden = townerLedger('TOWN_TAVERN')!;
    expect(ogden.preMenuHandlers[0]).toMatchObject({
      quest: null,
      speechLineIds: ['TEXT_INTRO'],
      consumesTurn: true,
    });
    expect(ogden.firstVisitBehavior).toMatchObject({ lineIds: ['TEXT_INTRO'], consumesTurn: true });
  });

  it('adds the code-mutated mushroom topic without copying a quest-dialog table row', () => {
    const pepin = townerLedger('TOWN_HEALER')!;
    expect(pepin.talkTopics).toEqual([expect.objectContaining({
      topic: 'Q_MUSHROOM', lineIds: ['TEXT_MUSH3'], rotates: false,
    })]);
  });
});

describe('towner ledger dialog seeds', () => {
  const ledger = townerLedger('TOWN_COW')!;
  const entity = {
    id: 'd1-dialog-TOWN_COW',
    catalogId: 'dialog-trees',
    name: 'Synthetic Cow — conversation',
    categoryPath: [], lifecycle: 'planned', tags: [], links: [],
    data: { speaker: 'd1-TOWN_COW', gossip: [], topics: [], ledger },
    provenance: {
      kind: 'ingest', sourceGame: 'Synthetic', sourceProject: 'tests', sourceFile: 'synthetic.tsv',
      sourceRow: 'synthetic-cow', licenceNote: 'synthetic', ingestedAt: 't0', canonProfile: 'diablo1',
    },
  } as unknown as ReferenceWrapper['entity'];
  const seeds = seedDialogSteps(entity);

  it('adds a SOURCED Conditions & Effects artifact with checker-readable rows', () => {
    expect(seeds.map((seed) => seed.step)).toEqual(['Branch Graph', 'VO Script', 'Conditions & Effects']);
    const conditions = seeds[2];
    expect(conditions.data.sourced).toBeDefined();
    expect(conditions.data.conditionsEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ node: 'handler_01_interaction' }),
    ]));

    const accept = getCatalogPipeline('dialog-trees')!.steps.find((step) => step.label === 'Conditions & Effects')!.accept;
    const unsourced = { ...conditions.data };
    delete unsourced.sourced;
    expect(accept(unsourced, { catalog: 'dialog-trees', siblings: {}, has: () => true, canonProfile: 'diablo1' }).status).toBe('pass');
  });

  it('builds a valid ledger graph with no table-only handler or service gaps', () => {
    expect(seeds[0].gaps).toEqual([]);
    expect(graphValid('graph', 'valid')(seeds[0].data).status).toBe('pass');
  });

  it('keeps every full vanilla ledger graph valid with synthetic dialogue inputs', () => {
    for (const item of TOWNER_LEDGER_DATA.filter((entry) => entry.scope === 'full')) {
      const itemLedger = townerLedger(item.towner, {
        gossipLineIds: item.greetingRules.some((rule) => rule.opensMenu) ? ['TEXT_SYNTH_GOSSIP'] : [],
      })!;
      const itemEntity = {
        ...entity,
        id: `d1-dialog-${item.towner}`,
        data: { speaker: `d1-${item.towner}`, gossip: [], topics: [], ledger: itemLedger },
      } as unknown as ReferenceWrapper['entity'];
      const branch = seedDialogSteps(itemEntity)[0];
      expect(graphValid('graph', 'valid')(branch.data), item.towner).toMatchObject({ status: 'pass' });
    }
  });
});
