/** Engine-derived cross-monster AI state, events, and pack-model findings. */
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import {
  GROUP_AI_EVENTS_DATA,
  GROUP_AI_FINDINGS_DATA,
  GROUP_AI_INHERITANCE_DATA,
  GROUP_AI_PACK_CONSEQUENCES_DATA,
  GROUP_AI_RELATIONS_DATA,
  GROUP_AI_ROUTINES_DATA,
} from '@/lib/catalog/reference/groupAiLedgerData';
import {
  D1_AI_ROUTINES,
  isD1AiRoutineId,
  type D1AiRoutineId,
} from '@/lib/catalog/reference/aiRoutines';

export type GroupAiRelationName = 'LeaderRelation::None' | 'LeaderRelation::Leashed' | 'LeaderRelation::Separated';
export type GroupAiDirection = 'placement->minion' | 'leader->minion' | 'minion->leader' | 'not-shared';
export type GroupAiExpansion = 'diablo' | 'hellfire-flag-only';
export type GroupAiRoutinePhase = 'common-loop' | 'routine' | 'death-handler';
export type GroupAiFindingDataset = 'aiRoutinesData' | 'aiDecisionGraphsData' | 'packMath';

export interface GroupAiRelationState {
  readonly state: GroupAiRelationName;
  readonly meaning: string;
  readonly enteredWhen: readonly string[];
  readonly leavesWhen: readonly string[];
  readonly perTick: readonly string[];
  readonly refs: readonly string[];
}

export interface GroupAiInheritance {
  readonly id: string;
  readonly direction: GroupAiDirection;
  readonly what: string;
  readonly condition: string;
  readonly effect: string;
  readonly refs: readonly string[];
}

export interface GroupAiEvent {
  readonly id: string;
  readonly trigger: string;
  readonly effect: string;
  /** Engine-symbol formulas and named spatial tests; absent when the event has neither. */
  readonly radiusOrTimer: readonly string[];
  readonly routines: readonly D1AiRoutineId[];
  readonly expansion: GroupAiExpansion;
  readonly refs: readonly string[];
}

export interface GroupAiRoutineUse {
  readonly routine: D1AiRoutineId | 'all-routines';
  readonly phase: GroupAiRoutinePhase;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly eventIds: readonly string[];
  readonly note: string;
  readonly refs: readonly string[];
}

export interface GroupAiFinding {
  readonly dataset: GroupAiFindingDataset;
  readonly status: 'supports' | 'qualifies' | 'missing-layer';
  readonly finding: string;
  readonly refs: readonly string[];
}

export interface GroupAiPackConsequence {
  readonly rank: 1 | 2 | 3;
  readonly name: string;
  readonly expectedEffect: 'high' | 'medium' | 'low';
  readonly modelAssumption: string;
  readonly engineEvidence: string;
  readonly descentConsequence: string;
  readonly refs: readonly string[];
}

export interface GroupAiLedger {
  readonly id: 'd1-group-ai-ledger';
  readonly relations: readonly GroupAiRelationState[];
  readonly inheritance: readonly GroupAiInheritance[];
  readonly events: readonly GroupAiEvent[];
  readonly routines: readonly GroupAiRoutineUse[];
  readonly findings: readonly GroupAiFinding[];
  readonly packConsequences: readonly GroupAiPackConsequence[];
}

export interface GroupAiRoutineAttachment {
  readonly ledgerId: GroupAiLedger['id'];
  readonly routine: D1AiRoutineId;
  readonly relationStates: readonly GroupAiRelationName[];
  readonly inheritanceIds: readonly string[];
  readonly events: readonly GroupAiEvent[];
  readonly uses: readonly GroupAiRoutineUse[];
}

export interface GroupAiLedgerAuditIssue {
  readonly section: 'relations' | 'inheritance' | 'events' | 'routines' | 'packConsequences';
  readonly id: string;
  readonly issue: string;
}

export const GROUP_AI_LEDGER: GroupAiLedger = {
  id: 'd1-group-ai-ledger',
  relations: GROUP_AI_RELATIONS_DATA,
  inheritance: GROUP_AI_INHERITANCE_DATA,
  events: GROUP_AI_EVENTS_DATA,
  routines: GROUP_AI_ROUTINES_DATA,
  findings: GROUP_AI_FINDINGS_DATA,
  packConsequences: GROUP_AI_PACK_CONSEQUENCES_DATA,
};

const eventById = new Map(GROUP_AI_LEDGER.events.map((event) => [event.id, event]));
const commonUses = GROUP_AI_LEDGER.routines.filter((entry) => entry.routine === 'all-routines');

export function groupAiForRoutine(routine: string): GroupAiRoutineAttachment | undefined {
  if (!isD1AiRoutineId(routine)) return undefined;
  const uses = [
    ...commonUses,
    ...GROUP_AI_LEDGER.routines.filter((entry) => entry.routine === routine),
  ];
  const eventIds = new Set(uses.flatMap((entry) => entry.eventIds));
  return {
    ledgerId: GROUP_AI_LEDGER.id,
    routine,
    relationStates: GROUP_AI_LEDGER.relations.map((relation) => relation.state),
    inheritanceIds: GROUP_AI_LEDGER.inheritance.map((entry) => entry.id),
    events: [...eventIds].map((id) => eventById.get(id)).filter((event): event is GroupAiEvent => event !== undefined),
    uses,
  };
}

/** Attach data.groupAi without mutating promoted AI state-graph entities. */
export function withGroupAi<T extends StoredCatalogEntity>(entity: T): T {
  if (entity.catalogId !== 'state-graph' || !entity.id.startsWith('d1-ai-')) return entity;
  const data = entity.data && typeof entity.data === 'object' && !Array.isArray(entity.data)
    ? entity.data as Record<string, unknown>
    : {};
  const routine = typeof data.routine === 'string' ? data.routine : '';
  const groupAi = groupAiForRoutine(routine);
  if (!groupAi) return entity;
  return { ...entity, data: { ...data, groupAi } };
}

/** Structural audit used by tests and the CLI; it accepts synthetic ledgers. */
export function auditGroupAiLedger(ledger: GroupAiLedger = GROUP_AI_LEDGER): GroupAiLedgerAuditIssue[] {
  const issues: GroupAiLedgerAuditIssue[] = [];
  const refsMissingLine = (refs: readonly string[]) => refs.length === 0 || refs.some((ref) => !/:\d+(?:-\d+)?$/.test(ref));
  const duplicateIds = (section: GroupAiLedgerAuditIssue['section'], ids: readonly string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push({ section, id, issue: 'duplicate id' });
      seen.add(id);
    }
  };

  duplicateIds('relations', ledger.relations.map((entry) => entry.state));
  duplicateIds('inheritance', ledger.inheritance.map((entry) => entry.id));
  duplicateIds('events', ledger.events.map((entry) => entry.id));
  for (const [section, entries] of [
    ['relations', ledger.relations],
    ['inheritance', ledger.inheritance],
    ['events', ledger.events],
    ['routines', ledger.routines],
    ['packConsequences', ledger.packConsequences],
  ] as const) {
    for (const entry of entries) {
      const id = 'id' in entry ? entry.id : 'state' in entry ? entry.state : 'routine' in entry ? entry.routine : String(entry.rank);
      if (refsMissingLine(entry.refs)) issues.push({ section, id, issue: 'every ref must end in file:line or file:start-end' });
    }
  }

  const eventIds = new Set(ledger.events.map((event) => event.id));
  for (const entry of ledger.routines) {
    if (entry.routine !== 'all-routines' && !isD1AiRoutineId(entry.routine)) {
      issues.push({ section: 'routines', id: entry.routine, issue: 'unknown AI routine' });
    }
    for (const eventId of entry.eventIds) {
      if (!eventIds.has(eventId)) issues.push({ section: 'routines', id: entry.routine, issue: `unknown event ${eventId}` });
    }
  }

  const ranks = ledger.packConsequences.map((entry) => entry.rank).sort();
  if (ranks.join(',') !== '1,2,3') {
    issues.push({ section: 'packConsequences', id: 'ranks', issue: 'expected exactly ranks 1, 2, and 3' });
  }
  return issues;
}

export const GROUP_AI_ROUTINE_IDS = Object.keys(D1_AI_ROUTINES) as D1AiRoutineId[];

export {
  GROUP_AI_EVENTS_DATA,
  GROUP_AI_FINDINGS_DATA,
  GROUP_AI_INHERITANCE_DATA,
  GROUP_AI_PACK_CONSEQUENCES_DATA,
  GROUP_AI_RELATIONS_DATA,
  GROUP_AI_ROUTINES_DATA,
};
