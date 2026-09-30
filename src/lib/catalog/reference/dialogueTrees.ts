/** Diablo I town conversations aggregate line rows into the conversation-shaped entity PoF authors. */
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import { QUEST_ROW_IDS } from '@/lib/catalog/ingest/diablo1Dialogue';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { townerLedger, type TownerLedger } from '@/lib/catalog/reference/townerLedger';
import type { ReferenceWrapper } from '@/lib/catalog/reference/wrapper';

type DialogueEntity = ReferenceWrapper['entity'];

interface LabelledValue { label: string; value: string }
interface DialogueLine { line: string; text: string; voiceClip?: string; scrolling: unknown }
interface DialogueTopic extends DialogueLine { quest: string; questEntity: string; questTitle: string; expansion: unknown }

export interface DialogueTreeWrapper { catalogId: 'dialog-trees'; entity: DialogueEntity }
export interface SkippedTowner { towner: string; reason: string }
export interface UnresolvedDialogueLine { towner: string; line: string }
export interface DialogueTreesResult {
  wrappers: DialogueTreeWrapper[];
  skipped: SkippedTowner[];
  unresolved: UnresolvedDialogueLine[];
}

const isLabelledValue = (value: unknown): value is LabelledValue => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LabelledValue>;
  return typeof item.label === 'string' && typeof item.value === 'string';
};

const sourceLineId = (value: string) => value.startsWith('d1-') ? value.slice(3) : value;

const lineFrom = (wrapper: ReferenceWrapper): DialogueLine => ({
  line: wrapper.key,
  text: String(wrapper.entity.data.text ?? ''),
  ...(typeof wrapper.entity.data.voiceClip === 'string' && wrapper.entity.data.voiceClip
    ? { voiceClip: wrapper.entity.data.voiceClip }
    : {}),
  scrolling: wrapper.entity.data.scrolling,
});

/**
 * Build one conversation per towner. Duplicate source keys (notably the three TOWN_COW rows)
 * deliberately share one group and therefore produce one tree, while contributing all their lines.
 */
export function dialogueTrees(wrappers: readonly ReferenceWrapper[]): DialogueTreesResult {
  const lineWrappers = new Map<string, ReferenceWrapper>();
  const questWrappers = new Map<string, ReferenceWrapper>();
  const questTalkByTowner = new Map<string, ReferenceWrapper[]>();
  const towners = new Map<string, ReferenceWrapper[]>();

  for (const wrapper of wrappers) {
    // Only townspeople (towners.tsv) hold conversations — the player classes share the catalog since W18.
    if (wrapper.catalogId === 'characters' && wrapper.file === 'towners/towners.tsv') {
      const group = towners.get(wrapper.key) ?? [];
      group.push(wrapper);
      towners.set(wrapper.key, group);
      continue;
    }
    if (wrapper.catalogId === 'quests') {
      questWrappers.set(wrapper.key, wrapper);
      continue;
    }
    if (wrapper.catalogId !== 'dialog-trees') continue;
    if (Array.isArray(wrapper.entity.data.questTalk)) {
      const group = questTalkByTowner.get(wrapper.key) ?? [];
      group.push(wrapper);
      questTalkByTowner.set(wrapper.key, group);
    } else if (typeof wrapper.entity.data.text === 'string') {
      lineWrappers.set(wrapper.key, wrapper);
      lineWrappers.set(wrapper.entity.id, wrapper);
    }
  }

  const aggregateWrappers: DialogueTreeWrapper[] = [];
  const skipped: SkippedTowner[] = [];
  const unresolved: UnresolvedDialogueLine[] = [];
  const unresolvedSeen = new Set<string>();

  const reportMissing = (towner: string, line: string) => {
    const key = `${towner}:${line}`;
    if (unresolvedSeen.has(key)) return;
    unresolvedSeen.add(key);
    unresolved.push({ towner, line });
  };

  for (const [towner, characterRows] of towners) {
    const first = characterRows[0];
    const read = new Set<ReferenceWrapper>(characterRows);
    const gossip: DialogueLine[] = [];
    const gossipSeen = new Set<string>();
    for (const character of characterRows) {
      for (const link of character.entity.links ?? []) {
        if (link.role !== 'gossip') continue;
        const lineId = sourceLineId(link.entityId);
        const lineWrapper = lineWrappers.get(link.entityId) ?? lineWrappers.get(lineId);
        if (!lineWrapper) { reportMissing(towner, lineId); continue; }
        read.add(lineWrapper);
        if (!gossipSeen.has(lineWrapper.key)) {
          gossipSeen.add(lineWrapper.key);
          gossip.push(lineFrom(lineWrapper));
        }
      }
    }

    const topicByQuest = new Map<string, DialogueTopic>();
    for (const questTalk of questTalkByTowner.get(towner) ?? []) {
      read.add(questTalk);
      for (const item of questTalk.entity.data.questTalk as unknown[]) {
        if (!isLabelledValue(item)) continue;
        const lineId = sourceLineId(item.value);
        const lineWrapper = lineWrappers.get(item.value) ?? lineWrappers.get(lineId);
        if (!lineWrapper) { reportMissing(towner, lineId); continue; }
        const questWrapper = questWrappers.get(item.label);
        read.add(lineWrapper);
        if (questWrapper) read.add(questWrapper);
        const derived = (questWrapper?.entity.data.derived ?? {}) as Record<string, unknown>;
        topicByQuest.set(item.label, {
          quest: item.label,
          questEntity: `d1-${item.label}`,
          questTitle: questWrapper?.entity.name ?? '',
          expansion: derived.expansion,
          ...lineFrom(lineWrapper),
        });
      }
    }
    const topics = QUEST_ROW_IDS.flatMap((quest) => {
      const topic = topicByQuest.get(quest);
      return topic ? [topic] : [];
    });
    const ledger = townerLedger(towner, {
      gossipLineIds: gossip.map((line) => line.line),
      topics: topics.map((topic) => ({ quest: topic.quest, line: topic.line })),
    });

    if (!gossip.length && !topics.length && !ledger) {
      skipped.push({
        towner,
        reason: unresolved.some((item) => item.towner === towner)
          ? 'no referenced dialogue lines could be resolved'
          : 'no gossip or quest-talk lines are present in the reference tables',
      });
      continue;
    }

    const provenance = first.entity.provenance;
    const sources = [...read];
    const questLinks = [
      ...topics.map((topic) => topic.questEntity),
      ...(ledger?.preMenuHandlers.flatMap((handler) => handler.quest ? [`d1-${handler.quest}`] : []) ?? []),
    ];
    aggregateWrappers.push({
      catalogId: 'dialog-trees',
      entity: {
        ...first.entity,
        id: `d1-dialog-${towner}`,
        catalogId: 'dialog-trees',
        name: `${first.entity.name} — conversation`,
        tags: ['diablo-town-talk'],
        links: [
          { catalogId: 'characters', entityId: `d1-${towner}`, role: 'host' },
          ...[...new Set(questLinks)].map((entityId) => ({ catalogId: 'quests', entityId, role: 'advances' })),
        ],
        data: { speaker: `d1-${towner}`, gossip, topics, ...(ledger ? { ledger } : {}) },
        ...(provenance ? {
          provenance: {
            ...provenance,
            sourceFile: [...new Set(sources.map((wrapper) => wrapper.file))].join(', '),
            // Do not de-duplicate rows: equal source keys can be distinct rows (the three cows).
            sourceRow: sources.map((wrapper) => wrapper.entity.provenance?.sourceRow ?? wrapper.key).join('; '),
          },
        } : {}),
      },
    });
  }

  return { wrappers: aggregateWrappers, skipped, unresolved };
}

function stamp(entity: DialogueEntity, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? '',
    sourceFile: entity.provenance?.sourceFile ?? '',
    sourceRow: entity.provenance?.sourceRow ?? '',
    columns,
  };
}

const nodeToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const serviceNodeId = (service: TownerLedger['services'][number], index: number): string =>
  `${service.trigger === 'menu-open' ? 'automatic_service' : 'service'}_${index + 1}_${nodeToken(service.service)}`;

function ledgerStamp(entity: DialogueEntity, ledger: TownerLedger, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? '',
    sourceFile: ledger.refs.join(', '),
    sourceRow: ledger.towner,
    columns,
  };
}

function ledgerConditionsEffects(ledger: TownerLedger): { node: string; condition: string; effect: string }[] {
  return [
    ...ledger.preMenuHandlers.map((handler, index) => ({
      node: `handler_${String(index + 1).padStart(2, '0')}_${nodeToken(handler.quest ?? 'interaction')}`,
      condition: `ordered handler ${index + 1}: ${handler.condition}`,
      effect: `${handler.effect}; ${handler.consumesTurn ? 'return before the menu opens' : 'continue to the menu'}`,
    })),
    ...ledger.greetingRules.map((rule, index) => ({
      node: `greeting_${index + 1}`,
      condition: rule.condition,
      effect: `${rule.effect}; menu ${rule.opensMenu ? 'opens' : 'does not open'}`,
    })),
    ...ledger.services.map((service, index) => ({
      node: serviceNodeId(service, index),
      condition: service.condition,
      effect: service.effect,
    })),
    ...ledger.talkTopics.map((topic) => ({
      node: `topic_${nodeToken(topic.topic)}`,
      condition: topic.gating,
      effect: `selecting the topic speaks ${topic.lineIds.join(' or ')}; the topic mapping does not rotate`,
    })),
    ...(ledger.gossip.lineIds.length ? [{
      node: 'gossip',
      condition: 'the Talk submenu is open and Gossip is selected',
      effect: `speak the one line selected when the towner initialized (${ledger.gossip.lineIds.join(', ')}); do not rotate it per click`,
    }] : []),
  ];
}

function ledgerGraph(ledger: TownerLedger) {
  const menuGreeting = ledger.greetingRules.find((rule) => rule.opensMenu);
  const automaticServices = ledger.services
    .map((service, index) => ({ service, index }))
    .filter(({ service }) => service.trigger === 'menu-open');
  const optionServices = ledger.services
    .map((service, index) => ({ service, index }))
    .filter(({ service }) => service.trigger === 'menu-option');
  const hasTalk = ledger.gossip.lineIds.length > 0 || ledger.talkTopics.length > 0;
  const nodes = [
    { id: 'interaction', label: `${ledger.towner} interaction — evaluate pre-menu handlers in listed order` },
    ...ledger.preMenuHandlers.map((handler, index) => ({
      id: `handler_${String(index + 1).padStart(2, '0')}_${nodeToken(handler.quest ?? 'interaction')}`,
      label: `${handler.condition} → ${handler.effect}`,
      terminal: handler.consumesTurn,
    })),
    ...ledger.greetingRules.map((rule, index) => ({
      id: `greeting_${index + 1}`,
      label: `${rule.condition} → ${rule.effect}`,
      terminal: !rule.opensMenu,
    })),
    ...automaticServices.map(({ service, index }) => ({
      id: serviceNodeId(service, index),
      label: `${service.service}: ${service.effect}`,
    })),
    ...(menuGreeting ? [{ id: 'menu', label: 'Towner menu' }] : []),
    ...(hasTalk ? [{ id: 'talk', label: `Talk submenu; topicsRotate=${String(ledger.talkTopicsRotate)}` }] : []),
    ...(menuGreeting ? [{ id: 'leave', label: 'Leave', terminal: true }] : []),
    ...optionServices.map(({ service, index }) => ({
      id: serviceNodeId(service, index),
      label: `${service.service}: ${service.effect}`,
      terminal: true,
    })),
    ...(ledger.gossip.lineIds.length ? [{
      id: 'gossip',
      label: `Gossip — one initialization-selected line: ${ledger.gossip.lineIds.join(', ')}`,
      terminal: true,
    }] : []),
    ...ledger.talkTopics.map((topic) => ({
      id: `topic_${nodeToken(topic.topic)}`,
      label: `${topic.topic}: ${topic.lineIds.join(', ')}`,
      terminal: true,
    })),
  ];
  const firstGreeting = ledger.greetingRules[0];
  const automaticIds = automaticServices.map(({ service, index }) => serviceNodeId(service, index));
  const greetingTarget = firstGreeting ? 'greeting_1' : undefined;
  const afterGreeting = automaticIds[0] ?? (menuGreeting ? 'menu' : undefined);
  const edges = [
    ...ledger.preMenuHandlers.map((handler, index) => ({
      from: 'interaction',
      to: `handler_${String(index + 1).padStart(2, '0')}_${nodeToken(handler.quest ?? 'interaction')}`,
      label: `${index + 1}: first matching handler — ${handler.condition}`,
    })),
    ...(greetingTarget ? [{ from: 'interaction', to: greetingTarget, label: 'no ordered pre-menu handler matches' }] : []),
    ...(firstGreeting && afterGreeting ? [{ from: 'greeting_1', to: afterGreeting }] : []),
    ...automaticIds.flatMap((id, index) => {
      const target = automaticIds[index + 1] ?? (menuGreeting ? 'menu' : undefined);
      return target ? [{ from: id, to: target, label: 'automatic service completes; menu remains open' }] : [];
    }),
    ...(menuGreeting ? [{ from: 'menu', to: 'leave', label: 'Leave' }] : []),
    ...(menuGreeting && hasTalk ? [{ from: 'menu', to: 'talk', label: 'Talk' }] : []),
    ...optionServices.map(({ service, index }) => ({
      from: 'menu', to: serviceNodeId(service, index), label: service.service,
    })),
    ...(ledger.gossip.lineIds.length ? [{ from: 'talk', to: 'gossip', label: 'Gossip' }] : []),
    ...ledger.talkTopics.map((topic) => ({
      from: 'talk', to: `topic_${nodeToken(topic.topic)}`, label: topic.gating,
    })),
    ...(hasTalk ? [{ from: 'talk', to: 'menu', label: 'Back' }] : []),
  ];
  return { nodes, edges };
}

/** Seed the reference-held graph and VO script, plus ledger-backed conditions/effects when available. */
export function seedDialogSteps(entity: DialogueEntity): StepSeed[] {
  const lawIds = ['d1-dialogue-hub-law', 'd1-dialogue-topics-law'];
  for (const lawId of lawIds) {
    if (!DIABLO1_CANON.some((rule) => rule.id === lawId)) {
      throw new Error(`canon rule ${lawId} is missing — the dialogue graph seed has no law to read`);
    }
  }
  const data = entity.data as { gossip?: DialogueLine[]; topics?: DialogueTopic[]; ledger?: TownerLedger };
  const gossip = data.gossip ?? [];
  const topics = data.topics ?? [];
  const ledger = data.ledger;
  const graphStamp = stamp(entity, [`(laws ${lawIds.join(', ')})`, 'gossipTexts', 'questTalk']);
  const voStamp = stamp(entity, ['txtstrid', 'txtstr', 'sfxnr', 'scrlltxt']);
  const topicNodes = topics.map((topic) => ({
    id: `topic_${topic.quest.toLowerCase()}`,
    label: `${topic.quest}: ${topic.questTitle}`,
    terminal: true,
  }));
  const pooled = gossip.length ? gossip.map((line) => line.line).join(', ') : 'no reference-table gossip lines';
  const tableGraph = {
    nodes: [
      { id: 'quest_handlers', label: 'ENGINE CODE — ordered first-match quest handlers (towners.cpp TalkTo*)' },
      { id: 'handler_line', label: 'A quest handler matched: it speaks its line, changes quest state and ends the talk', terminal: true },
      { id: 'greeting', label: `${entity.name} greeting` },
      { id: 'menu', label: 'Town conversation menu' },
      { id: 'talk', label: 'Talk' },
      { id: 'leave', label: 'Leave', terminal: true },
      { id: 'services', label: 'Services — NPC store is outside this catalog', terminal: true },
      { id: 'gossip', label: `Gossip — pooled lines: ${pooled}`, terminal: true },
      ...topicNodes,
    ],
    edges: [
      { from: 'quest_handlers', to: 'handler_line', label: 'the first handler whose quest condition holds' },
      { from: 'quest_handlers', to: 'greeting', label: 'no ordered quest handler matches' },
      { from: 'greeting', to: 'menu' },
      { from: 'menu', to: 'talk', label: 'Talk' },
      { from: 'menu', to: 'leave', label: 'Leave' },
      { from: 'menu', to: 'services', label: 'Services' },
      { from: 'talk', to: 'gossip', label: 'Gossip' },
      ...topics.map((topic) => ({
        from: 'talk',
        to: `topic_${topic.quest.toLowerCase()}`,
        label: `quest ${topic.quest} ACTIVE and logged`,
      })),
      { from: 'talk', to: 'menu', label: 'Back' },
    ],
  };
  const graph = ledger ? ledgerGraph(ledger) : tableGraph;
  const lines = [...gossip, ...topics];
  const voLines = lines.map((line) =>
    `${line.line}: "${line.text}" [voiceClip: ${line.voiceClip ?? REFERENCE_GAP}; scrolling: ${String(line.scrolling)}]`);
  const unvoicedGaps = lines
    .filter((line) => !line.voiceClip)
    .map((line) => `${line.line}.voiceClip: this reference line is unvoiced; no clip name was invented`);

  const seeds: StepSeed[] = [
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'Branch Graph',
      data: {
        graph,
        [SOURCED_FIELD]: ledger
          ? ledgerStamp(entity, ledger, ['preMenuHandlers', 'services', 'greetingRules', 'talkTopics', 'gossip'])
          : graphStamp,
      },
      gaps: ledger ? [] : [
        'quest_handlers: the ordered first-match handlers live in engine code (towners.cpp TalkTo*), not in the reference tables',
        'services: the NPC store is outside the dialog-trees catalog',
      ],
    },
    {
      catalogId: 'dialog-trees', entityId: entity.id, step: 'VO Script',
      data: { voLines, [SOURCED_FIELD]: voStamp },
      gaps: unvoicedGaps,
    },
  ];
  if (ledger) {
    seeds.push({
      catalogId: 'dialog-trees', entityId: entity.id, step: 'Conditions & Effects',
      data: {
        conditionsEffects: ledgerConditionsEffects(ledger),
        [SOURCED_FIELD]: ledgerStamp(entity, ledger, ['preMenuHandlers[].condition', 'preMenuHandlers[].effect', 'services', 'greetingRules', 'talkTopics']),
      },
      gaps: [],
    });
  }
  return seeds;
}
