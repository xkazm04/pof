/** Runtime conversation behaviour for Diablo I towners, separate from their dialogue text rows. */
import { QUEST_ROW_IDS } from '@/lib/catalog/ingest/diablo1Dialogue';
import { TOWNER_LEDGER_DATA } from '@/lib/catalog/reference/townerLedgerData';

export type TownerExpansion = 'diablo' | 'hellfire';
export type TownerLedgerScope = 'full' | 'flag-only';

export interface TownerPreMenuHandler {
  quest: string | null;
  condition: string;
  effect: string;
  speechLineIds: readonly string[];
  /** True means this interaction returns before StartStore, so no menu opens. */
  consumesTurn: boolean;
  refs: readonly string[];
}

export interface TownerService {
  service: string;
  condition: string;
  effect: string;
  trigger: 'menu-open' | 'menu-option';
  refs: readonly string[];
}

export interface TownerTalkTopic {
  topic: string;
  gating: string;
  lineIds: readonly string[];
  rotates: false;
  refs: readonly string[];
}

export interface TownerGreetingRule {
  condition: string;
  effect: string;
  lineIds: readonly string[];
  opensMenu: boolean;
  refs: readonly string[];
}

export interface TownerFirstVisitBehavior {
  condition: string;
  effect: string;
  lineIds: readonly string[];
  consumesTurn: boolean;
  refs: readonly string[];
}

export interface TownerGossipRule {
  lineIds: readonly string[];
  selection: 'none' | 'random-on-towner-initialization';
  rotates: false;
  refs: readonly string[];
}

export interface TownerLedger {
  towner: string;
  name: string;
  expansion: TownerExpansion;
  scope: TownerLedgerScope;
  preMenuHandlers: readonly TownerPreMenuHandler[];
  services: readonly TownerService[];
  talkTopics: readonly TownerTalkTopic[];
  talkTopicsRotate: false;
  greetingRules: readonly TownerGreetingRule[];
  firstVisitBehavior: TownerFirstVisitBehavior | null;
  gossip: TownerGossipRule;
  refs: readonly string[];
  note?: string;
}

export interface TownerLedgerTopicInput {
  quest: string;
  line: string;
}

export interface TownerLedgerInputs {
  gossipLineIds?: readonly string[];
  topics?: readonly TownerLedgerTopicInput[];
}

export interface TownerLedgerData extends Omit<TownerLedger, 'talkTopics' | 'talkTopicsRotate' | 'gossip' | 'refs'> {
  talkTopicOverrides?: readonly TownerTalkTopic[];
  refs: readonly string[];
}

const TopicRefs = [
  '.reference/devilutionX/Source/stores.cpp:1204-1245',
  '.reference/devilutionX/Source/stores.cpp:1968-2004',
  '.reference/devilutionX/Source/tables/townerdat.cpp:133-209',
] as const;

const GossipRefs = [
  '.reference/devilutionX/Source/towners.cpp:117-138',
  '.reference/devilutionX/Source/stores.cpp:1989-1993',
] as const;
const QuestOrder: readonly string[] = QUEST_ROW_IDS;

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function talkTopics(
  data: TownerLedgerData,
  inputs: TownerLedgerInputs,
): TownerTalkTopic[] {
  const topics = new Map<string, TownerTalkTopic>();
  for (const topic of inputs.topics ?? []) {
    topics.set(topic.quest, {
      topic: topic.quest,
      gating: `Quests[${topic.quest}]._qactive == QUEST_ACTIVE; Quests[${topic.quest}]._qlog; GetTownerQuestDialog(${data.towner}, ${topic.quest}) != TEXT_NONE`,
      lineIds: [topic.line],
      rotates: false,
      refs: TopicRefs,
    });
  }
  for (const override of data.talkTopicOverrides ?? []) {
    const current = topics.get(override.topic);
    topics.set(override.topic, current
      ? {
          ...override,
          lineIds: unique([...current.lineIds, ...override.lineIds]),
          refs: unique([...current.refs, ...override.refs]),
        }
      : override);
  }
  return [...topics.values()].sort((a, b) => {
    const aIndex = QuestOrder.indexOf(a.topic);
    const bIndex = QuestOrder.indexOf(b.topic);
    if (aIndex === -1 || bIndex === -1) return aIndex === bIndex ? 0 : aIndex === -1 ? 1 : -1;
    return aIndex - bIndex;
  });
}

/** Build the serializable ledger attached to a promoted d1-dialog-TOWN_* entity. */
export function townerLedger(towner: string, inputs: TownerLedgerInputs = {}): TownerLedger | undefined {
  const data = TOWNER_LEDGER_DATA.find((entry) => entry.towner === towner);
  if (!data) return undefined;
  const ledgerData = { ...data };
  delete ledgerData.talkTopicOverrides;
  const gossipLineIds = inputs.gossipLineIds ?? [];
  const topics = talkTopics(data, inputs);
  return {
    ...ledgerData,
    talkTopics: topics,
    talkTopicsRotate: false,
    gossip: {
      lineIds: gossipLineIds,
      selection: gossipLineIds.length ? 'random-on-towner-initialization' : 'none',
      rotates: false,
      refs: GossipRefs,
    },
    refs: unique([
      ...data.refs,
      ...data.preMenuHandlers.flatMap((handler) => handler.refs),
      ...data.services.flatMap((service) => service.refs),
      ...data.greetingRules.flatMap((rule) => rule.refs),
      ...(data.firstVisitBehavior?.refs ?? []),
      ...topics.flatMap((topic) => topic.refs),
      ...(gossipLineIds.length ? GossipRefs : []),
    ]),
  };
}

/** Includes the three Hellfire-only towners as flag-only records for audit visibility. */
export function allTownerLedgers(): TownerLedger[] {
  return TOWNER_LEDGER_DATA.map((entry) => townerLedger(entry.towner) as TownerLedger);
}

export { TOWNER_LEDGER_DATA };
