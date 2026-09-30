/** Ordered trigger -> guard -> effect ledgers for the vanilla Diablo I quests. */
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  D1_QUEST_CAUSALITY_DATA,
  D1_QUEST_CAUSALITY_DEPENDENCIES,
  D1_QUEST_CAUSALITY_SCOPE_FLAGS,
  D1_QUEST_SPEC_CAUSALITY_FINDINGS,
} from '@/lib/catalog/reference/questCausalityData';
import type { QuestId } from '@/lib/catalog/reference/questSpecs';

export type QuestCausalityEventKind =
  | 'talk-to-towner'
  | 'talk-to-monster'
  | 'monster-killed'
  | 'monster-left-visibility'
  | 'monster-became-visible'
  | 'item-picked-up'
  | 'item-carried'
  | 'item-handed-in'
  | 'object-operated'
  | 'level-entered'
  | 'speech-finished'
  | 'quest-condition'
  | 'other-quest-state';

export interface QuestCausalityTrigger {
  kind: QuestCausalityEventKind;
  subject: string;
}

export interface QuestCausalityTransition {
  id: string;
  trigger: QuestCausalityTrigger;
  guard: string;
  effect: string;
  refs: readonly string[];
}

export interface QuestCausalityLedgerData {
  questId: QuestId;
  scope: 'vanilla-single-player';
  initialState: string;
  startTransitionIds: readonly string[];
  completionTransitionIds: readonly string[];
  transitions: readonly QuestCausalityTransition[];
  flags: readonly string[];
}

export interface QuestCausalityEndpoint {
  kind: 'quest' | 'monster';
  id: string;
  transitionId?: string;
}

export interface QuestCausalityDependency {
  id: string;
  from: QuestCausalityEndpoint;
  to: QuestCausalityEndpoint;
  guard: string;
  effect: string;
  refs: readonly string[];
}

export interface QuestCausalityLedger extends QuestCausalityLedgerData {
  dependencies: readonly QuestCausalityDependency[];
  refs: readonly string[];
}

export interface QuestSpecCausalityFinding {
  questId: QuestId;
  finding: string;
  refs: readonly string[];
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** Resolve one vanilla quest ledger. Hellfire and unknown quest ids deliberately return undefined. */
export function questCausality(questId: string): QuestCausalityLedger | undefined {
  const data = D1_QUEST_CAUSALITY_DATA[questId as QuestId];
  if (!data) return undefined;
  const dependencies = D1_QUEST_CAUSALITY_DEPENDENCIES.filter(
    (dependency) => dependency.from.id === questId || dependency.to.id === questId,
  );
  return {
    ...data,
    dependencies,
    refs: unique([
      '.reference/devilutionX/Source/quests.cpp:60-112',
      ...data.transitions.flatMap((transition) => transition.refs),
      ...dependencies.flatMap((dependency) => dependency.refs),
    ]),
  };
}

/** The complete vanilla ledger set, in the engine quest-id order used by the data module. */
export function allQuestCausalityLedgers(): QuestCausalityLedger[] {
  return Object.keys(D1_QUEST_CAUSALITY_DATA).map((questId) => questCausality(questId) as QuestCausalityLedger);
}

/** Attach the serializable ledger to a quest projection before it is promoted. */
export function withQuestCausality<T extends StoredCatalogEntity>(entity: T): T {
  const causality = questCausality(entity.id);
  if (!causality) return entity;
  const data = entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data)
    ? entity.data as Record<string, unknown>
    : {};
  return { ...entity, data: { ...data, causality } };
}

function sourceStamp(entity: StoredCatalogEntity, ledger: QuestCausalityLedger): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? 'Diablo I (1996)',
    sourceFile: ledger.refs.join(', '),
    sourceRow: entity.id,
    columns: ['causality.transitions[].trigger', 'causality.transitions[].guard', 'causality.transitions[].effect', 'causality.dependencies'],
  };
}

/** Build the checker-compatible SOURCED artifact for the quest pipeline's causality step. */
export function seedQuestCausalityStep(entity: StoredCatalogEntity): StepSeed | undefined {
  const ledger = questCausality(entity.id);
  if (!ledger) return undefined;
  const byId = new Map(ledger.transitions.map((transition) => [transition.id, transition]));
  const starts = ledger.startTransitionIds.map((id) => byId.get(id)).filter((value) => value !== undefined);
  return {
    catalogId: 'quests',
    entityId: entity.id,
    step: 'Triggers & World-State',
    data: {
      triggers: {
        start: starts.map((transition) => `${transition.trigger.kind} ${transition.trigger.subject}: ${transition.guard}`).join(' OR '),
        fail: 'none — vanilla accepted quests have no failed or abandoned state',
        worldMutation: ledger.transitions.map((transition) => `${transition.id}: ${transition.effect}`).join('; '),
      },
      causality: ledger,
      [SOURCED_FIELD]: sourceStamp(entity, ledger),
    },
    gaps: [],
  };
}

export {
  D1_QUEST_CAUSALITY_DATA,
  D1_QUEST_CAUSALITY_DEPENDENCIES,
  D1_QUEST_CAUSALITY_SCOPE_FLAGS,
  D1_QUEST_SPEC_CAUSALITY_FINDINGS,
};
