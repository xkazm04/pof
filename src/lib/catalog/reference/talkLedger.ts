/** Engine-derived assembly rules for Diablo I town and unique-monster conversations. */
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import { D1_QUEST_CAUSALITY_DATA } from '@/lib/catalog/reference/questCausalityData';
import type { QuestCausalityLedgerData } from '@/lib/catalog/reference/questCausality';
import { TOWNER_LEDGER_DATA } from '@/lib/catalog/reference/townerLedgerData';
import type { TownerLedgerData } from '@/lib/catalog/reference/townerLedger';
import {
  D1_TALKING_MONSTER_LEDGERS,
  D1_TOWNER_TALK_LEDGERS,
} from '@/lib/catalog/reference/talkLedgerData';

export type TalkQuestId = `Q_${string}`;
export type TalkSpeechId = `TEXT_${string}` | `HeroSpeech::${string}`;
export type TalkTownerId = `TOWN_${string}`;
export type TalkUniqueMonsterId = `UniqueMonsterType::${string}`;
export type TalkRepeatRule =
  | 'one-shot-state-guarded'
  | 'repeatable'
  | 'repeatable-while-condition'
  | 'repeatable-until-message-advance'
  | 'cyclic';

export interface TalkMenuEntry {
  id: string;
  kind: 'talk-submenu' | 'service' | 'leave';
  /** Entries are ordered after entries whose conditions are false have been removed. */
  condition: string;
  action: string;
  refs: readonly string[];
}

export interface TalkQuestTopic {
  quest: TalkQuestId;
  speech: `TEXT_${string}`;
  source: 'quest-dialog-table' | 'runtime-override';
  availabilityCondition: string;
  selectionEffect: string;
  repeatRule: 'repeatable-while-condition';
  refs: readonly string[];
}

export interface TalkGossipRule {
  /** Contiguous textdat enum range plus its exact enum-name sequence; no numeric ids are copied. */
  pool: {
    first: `TEXT_${string}`;
    last: `TEXT_${string}`;
    enumNames: readonly `TEXT_${string}`[];
  };
  menuOrder: 'before-quest-topics';
  availabilityCondition: string;
  selectionRule: string;
  repeatRule: string;
  refs: readonly string[];
}

export interface TalkPreMenuHandler {
  id: string;
  phase: 'pre-menu' | 'fallback-menu';
  quest: TalkQuestId | null;
  triggerCondition: string;
  effect: string;
  speech: readonly TalkSpeechId[];
  repeatRule: TalkRepeatRule;
  outcome: 'stop-before-menu' | 'open-menu' | 'no-menu';
  /** Whether questCausalityData should independently contain the mutation. */
  mutatesQuestState: boolean;
  refs: readonly string[];
}

export interface TalkQuestFlag {
  flag: 'MFLAG_QUEST_COMPLETE';
  purpose: string;
  setWhen: string;
  refs: readonly string[];
}

export interface TownerTalkLedgerData {
  kind: 'towner';
  towner: TalkTownerId;
  entityId: `d1-${TalkTownerId}`;
  scope: 'vanilla-single-player' | 'hellfire-flag-only';
  menuEntries: readonly TalkMenuEntry[];
  questTopics: readonly TalkQuestTopic[];
  gossip: TalkGossipRule | null;
  preMenuHandlers: readonly TalkPreMenuHandler[];
  refs: readonly string[];
  note?: string;
}

export interface TalkingMonsterTalkLedgerData {
  kind: 'talking-monster';
  monster: TalkUniqueMonsterId;
  entityId: `d1-uniq-${string}`;
  quest: TalkQuestId;
  initialSpeech: `TEXT_${string}`;
  speechSequence: readonly `TEXT_${string}`[];
  interactionCondition: string;
  menuEntries: readonly TalkMenuEntry[];
  questTopics: readonly TalkQuestTopic[];
  gossip: null;
  preMenuHandlers: readonly TalkPreMenuHandler[];
  questFlags: readonly TalkQuestFlag[];
  refs: readonly string[];
}

export type TalkLedger = TownerTalkLedgerData | TalkingMonsterTalkLedgerData;

export interface TalkLedgerFinding {
  dataset: 'townerLedgerData' | 'questCausalityData';
  subject: string;
  field: string;
  expected: string;
  actual: string;
  refs: readonly string[];
}

export interface TalkLedgerSummary {
  towner: TalkTownerId;
  menuEntries: readonly string[];
  questTopics: readonly { quest: TalkQuestId; speech: `TEXT_${string}` }[];
  gossipPoolSize: number;
}

export interface DialogTreeTalkLayerGap {
  ledgerFields: readonly string[];
  nearestStepFields: readonly string[];
  missingHome: string;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const townersById = new Map(D1_TOWNER_TALK_LEDGERS.map((ledger) => [ledger.towner, ledger]));
const monstersByEntityId = new Map(D1_TALKING_MONSTER_LEDGERS.map((ledger) => [ledger.entityId, ledger]));

/** Resolve a towner ledger by engine enum name or promoted character id. */
export function talkLedger(id: string): TownerTalkLedgerData | undefined {
  const towner = id.startsWith('d1-') ? id.slice(3) : id;
  return townersById.get(towner as TalkTownerId);
}

/** Resolve a talking-monster ledger by UniqueMonsterType name or promoted bestiary id. */
export function talkingMonsterTalkLedger(id: string): TalkingMonsterTalkLedgerData | undefined {
  return id.startsWith('UniqueMonsterType::')
    ? D1_TALKING_MONSTER_LEDGERS.find((ledger) => ledger.monster === id)
    : monstersByEntityId.get(id as `d1-uniq-${string}`);
}

export function allTalkLedgers(): TalkLedger[] {
  return [...D1_TOWNER_TALK_LEDGERS, ...D1_TALKING_MONSTER_LEDGERS];
}

export function gossipPoolSize(gossip: TalkGossipRule | null): number {
  return gossip?.pool.enumNames.length ?? 0;
}

/** The compact, prose-free report shape used by the CLI. */
export function talkLedgerSummary(): TalkLedgerSummary[] {
  return D1_TOWNER_TALK_LEDGERS.map((ledger) => ({
    towner: ledger.towner,
    menuEntries: ledger.menuEntries.map((entry) => entry.id),
    questTopics: ledger.questTopics.map(({ quest, speech }) => ({ quest, speech })),
    gossipPoolSize: gossipPoolSize(ledger.gossip),
  }));
}

function townerFromEntity(entity: StoredCatalogEntity): TownerTalkLedgerData | undefined {
  const data = entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data)
    ? entity.data as Record<string, unknown>
    : {};
  const speaker = typeof data.speaker === 'string' ? data.speaker : '';
  return talkLedger(speaker) ?? talkLedger(entity.id);
}

/** Attach data.talkLedger without mutating the promotion candidate. */
export function withTalkLedger<T extends StoredCatalogEntity>(entity: T): T {
  const data = entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data)
    ? entity.data as Record<string, unknown>
    : {};
  const speaker = typeof data.speaker === 'string' ? data.speaker : '';
  const ledger = townerFromEntity(entity)
    ?? talkingMonsterTalkLedger(speaker)
    ?? talkingMonsterTalkLedger(entity.id);
  if (!ledger) return entity;
  return { ...entity, data: { ...data, talkLedger: ledger } };
}

const handlerSignature = (handler: TalkPreMenuHandler): string =>
  `${handler.quest ?? '-'}:${handler.speech.join(',')}`;

const legacyHandlerSignature = (handler: TownerLedgerData['preMenuHandlers'][number]): string =>
  `${handler.quest ?? '-'}:${handler.speechLineIds.join(',')}`;

function causalText(ledger: QuestCausalityLedgerData): string {
  return ledger.transitions.map((transition) => [
    transition.trigger.kind,
    transition.trigger.subject,
    transition.guard,
    transition.effect,
  ].join(' ')).join('\n');
}

/**
 * Compare this independently pinned assembly ledger with the older ledgers. The comparison is
 * intentionally structural: it checks ordered handler identity and independently recorded quest
 * mutations, without treating a service-success guard as a menu-visibility guard.
 */
export function auditTalkLedgerConsistency(
  towners: readonly TownerTalkLedgerData[] = D1_TOWNER_TALK_LEDGERS,
  legacyTowners: readonly TownerLedgerData[] = TOWNER_LEDGER_DATA,
  questLedgers: Readonly<Record<string, QuestCausalityLedgerData>> = D1_QUEST_CAUSALITY_DATA,
): TalkLedgerFinding[] {
  const findings: TalkLedgerFinding[] = [];
  const legacyByTowner = new Map(legacyTowners.map((ledger) => [ledger.towner, ledger]));

  for (const ledger of towners.filter((entry) => entry.scope === 'vanilla-single-player')) {
    const legacy = legacyByTowner.get(ledger.towner);
    if (!legacy) {
      findings.push({
        dataset: 'townerLedgerData', subject: ledger.towner, field: 'coverage',
        expected: 'one towner ledger', actual: 'missing', refs: ledger.refs,
      });
      continue;
    }
    const expected = ledger.preMenuHandlers
      .filter((handler) => handler.phase === 'pre-menu')
      .map(handlerSignature);
    const actual = legacy.preMenuHandlers
      .filter((handler) => !handler.condition.startsWith('UseMultiplayerQuests();'))
      .map(legacyHandlerSignature);
    if (expected.join('\0') !== actual.join('\0')) {
      findings.push({
        dataset: 'townerLedgerData', subject: ledger.towner, field: 'preMenuHandlers order',
        expected: ledger.preMenuHandlers
          .filter((handler) => handler.phase === 'pre-menu')
          .map((handler) => `${handler.id}[${handlerSignature(handler)}]`)
          .join(' -> '),
        actual: legacy.preMenuHandlers
          .filter((handler) => !handler.condition.startsWith('UseMultiplayerQuests();'))
          .map((handler) => `${handler.condition}[${legacyHandlerSignature(handler)}]`)
          .join(' -> '),
        refs: unique([
          ...ledger.preMenuHandlers.flatMap((handler) => handler.refs),
          ...legacy.preMenuHandlers.flatMap((handler) => handler.refs),
        ]),
      });
    }

    for (const override of legacy.talkTopicOverrides ?? []) {
      const topic = ledger.questTopics.find((candidate) => candidate.quest === override.topic
        && override.lineIds.includes(candidate.speech));
      if (!topic) {
        findings.push({
          dataset: 'townerLedgerData', subject: ledger.towner, field: `questTopics.${override.topic}`,
          expected: override.lineIds.join(' or '), actual: 'missing runtime override',
          refs: unique([...override.refs, ...ledger.refs]),
        });
      }
    }

    for (const handler of ledger.preMenuHandlers) {
      if (!handler.mutatesQuestState || !handler.quest || handler.speech.length === 0) continue;
      const questLedger = questLedgers[`d1-${handler.quest}`];
      if (!questLedger) continue;
      const recorded = causalText(questLedger);
      if (handler.speech.some((speech) => recorded.includes(speech))) continue;
      findings.push({
        dataset: 'questCausalityData', subject: `d1-${handler.quest}`, field: handler.id,
        expected: `${ledger.towner} mutation with ${handler.speech.join(' or ')}`,
        actual: 'no causality transition records this speech-triggered mutation',
        refs: unique([...handler.refs, ...questLedger.transitions.flatMap((transition) => transition.refs)]),
      });
    }
  }

  for (const ledger of D1_TALKING_MONSTER_LEDGERS) {
    const questLedger = questLedgers[`d1-${ledger.quest}`];
    if (!questLedger) continue;
    const recorded = causalText(questLedger);
    for (const handler of ledger.preMenuHandlers) {
      if (!handler.mutatesQuestState || handler.speech.length === 0) continue;
      if (handler.speech.some((speech) => recorded.includes(speech))) continue;
      findings.push({
        dataset: 'questCausalityData', subject: `d1-${ledger.quest}`, field: handler.id,
        expected: `${ledger.monster} mutation with ${handler.speech.join(' or ')}`,
        actual: 'no causality transition records this speech-triggered mutation',
        refs: unique([...handler.refs, ...questLedger.transitions.flatMap((transition) => transition.refs)]),
      });
    }
  }

  return findings;
}

export const TALK_LEDGER_FINDINGS: readonly TalkLedgerFinding[] = auditTalkLedgerConsistency();

/** Fields the current dialog-trees steps can only flatten into labels/prose, not store as typed data. */
export const DIALOG_TREE_TALK_LAYER_GAPS: readonly DialogTreeTalkLayerGap[] = [
  {
    ledgerFields: ['preMenuHandlers[].order', 'preMenuHandlers[].outcome'],
    nearestStepFields: ['Branch Graph.graph', 'Conditions & Effects.conditionsEffects'],
    missingHome: 'no typed first-match priority or short-circuit-before-menu field',
  },
  {
    ledgerFields: ['menuEntries[].condition', 'menuEntries[].action'],
    nearestStepFields: ['Branch Graph.graph', 'Conditions & Effects.conditionsEffects'],
    missingHome: 'no typed store-menu variant or TalkID action field',
  },
  {
    ledgerFields: ['gossip.pool', 'gossip.selectionRule', 'gossip.repeatRule'],
    nearestStepFields: ['Branch Graph.graph', 'VO Script.voLines'],
    missingHome: 'no typed random pool, draw lifecycle, or reuse-until-reinitialization field',
  },
  {
    ledgerFields: ['questTopics[].repeatRule', 'preMenuHandlers[].repeatRule'],
    nearestStepFields: ['Conditions & Effects.conditionsEffects'],
    missingHome: 'no typed re-entry, one-shot, or repeatability field',
  },
  {
    ledgerFields: ['questFlags[].flag', 'questFlags[].setWhen'],
    nearestStepFields: ['Conditions & Effects.conditionsEffects'],
    missingHome: 'no typed talking-monster quest-flag lifecycle field',
  },
] as const;

export {
  D1_TALKING_MONSTER_LEDGERS,
  D1_TOWNER_TALK_LEDGERS,
};
