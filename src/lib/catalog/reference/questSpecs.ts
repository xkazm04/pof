/**
 * Diablo I quest specifications derived from engine code, like the quest canon laws: the
 * reference tables do not hold these behaviours. Learning-only scaffolding; delete it with
 * the exercise.
 */
import { REFERENCE_GAP } from '@/lib/catalog/acceptance/markers';
import { SOURCED_FIELD, type SourcedStamp } from '@/lib/catalog/acceptance/sourced';
import { DIABLO1_CANON } from '@/lib/catalog/canon/profiles/diablo1';
import type { StoredCatalogEntity } from '@/lib/catalog/types';
import type { StepSeed } from '@/lib/catalog/reference/stepSeeds';
import { D1_QUEST_SPECS } from '@/lib/catalog/reference/questSpecsData';

export const D1_VANILLA_QUEST_IDS = [
  'd1-Q_ROCK', 'd1-Q_MUSHROOM', 'd1-Q_GARBUD', 'd1-Q_ZHAR',
  'd1-Q_VEIL', 'd1-Q_DIABLO', 'd1-Q_BUTCHER', 'd1-Q_LTBANNER',
  'd1-Q_BLIND', 'd1-Q_BLOOD', 'd1-Q_ANVIL', 'd1-Q_WARLORD',
  'd1-Q_SKELKING', 'd1-Q_PWATER', 'd1-Q_SCHAMB', 'd1-Q_BETRAYER',
] as const;

export type QuestId = (typeof D1_VANILLA_QUEST_IDS)[number];
export type QuestGiver =
  | { kind: 'towner' | 'monster' | 'object'; id: string }
  | { kind: 'none' };

export interface QuestSpec {
  giver: QuestGiver;
  startTrigger: { kind: string; condition: string };
  stages: { id: string; state: string; advancesWhen: string }[];
  completion: string;
  failure: string;
  rewards: { kind: string; what: string }[];
  setLevel: 'SL_NONE' | 'SL_SKELKING' | 'SL_POISONWATER' | 'SL_BONECHAMB' | 'SL_VILEBETRAYER';
  lines: { stage: string; line: string; speaker: string }[];
  refs: string[];
}

export { D1_QUEST_SPECS };

const questLaw = (id: string) => {
  if (!DIABLO1_CANON.some((rule) => rule.id === id)) {
    throw new Error(`canon rule ${id} is missing — the quest seed has no law to read`);
  }
  return id;
};

function stamp(entity: StoredCatalogEntity, spec: QuestSpec, columns: string[]): SourcedStamp {
  return {
    sourceGame: entity.provenance?.sourceGame ?? 'Diablo I (1996)',
    sourceFile: spec.refs.join(', '),
    sourceRow: entity.id,
    columns,
  };
}

function conversationLinks(questId: QuestId, conversations: readonly StoredCatalogEntity[]) {
  return conversations.flatMap((conversation) => {
    if (!conversation.id.startsWith('d1-dialog-TOWN_')) return [];
    const topics = ((conversation.data as { topics?: unknown[] } | undefined)?.topics ?? []);
    const namesQuest = topics.some((value) => {
      if (!value || typeof value !== 'object') return false;
      const topic = value as { quest?: unknown; questEntity?: unknown };
      return topic.quest === questId.slice(3) || topic.questEntity === questId;
    });
    return namesQuest
      ? [{ catalogId: 'dialog-trees', entityId: conversation.id, role: 'quest-dialog' }]
      : [];
  });
}

/** Build the five quest pipeline artifacts whose values the engine actually specifies. */
export function seedQuestSteps(
  questEntity: StoredCatalogEntity,
  conversations: readonly StoredCatalogEntity[],
): StepSeed[] {
  const expansion = (questEntity.data as { derived?: { expansion?: unknown } } | undefined)?.derived?.expansion;
  if (expansion === 'hellfire') return [];

  const questId = questEntity.id as QuestId;
  const spec = D1_QUEST_SPECS[questId];
  if (!spec) throw new Error(`no vanilla Diablo I quest specification for ${questEntity.id}`);

  const failureLaw = questLaw('d1-quest-failure-law');
  const journalLaw = questLaw('d1-quest-journal-law');
  const graphNodes = [
    { id: 'start', label: `${spec.startTrigger.kind}: ${spec.startTrigger.condition}` },
    ...spec.stages.map((stage) => ({ id: stage.id, label: `${stage.state} — ${stage.advancesWhen}` })),
    { id: 'success', label: spec.completion, terminal: true },
  ];
  const graphEdges = graphNodes.slice(1).map((node, index) => ({
    from: graphNodes[index].id,
    to: node.id,
  }));
  const dialogLinks = conversationLinks(questId, conversations);
  const giver = spec.giver.kind === 'none' ? 'giver:none' : `${spec.giver.kind}:${spec.giver.id}`;
  const questLogLink = questEntity.links?.find((link) => link.role === 'quest-log-line');
  const questLogLine = questLogLink?.entityId ?? REFERENCE_GAP;

  return [
    {
      catalogId: 'quests', entityId: questId, step: 'Objective Graph',
      data: {
        graph: { nodes: graphNodes, edges: graphEdges, note: `${failureLaw}: no fail terminal exists.` },
        [SOURCED_FIELD]: stamp(questEntity, spec, ['startTrigger', 'stages', 'completion', `(law ${failureLaw})`]),
      },
      gaps: [`fail terminal: ${failureLaw} says vanilla quests have no failed or abandoned state`],
    },
    {
      catalogId: 'quests', entityId: questId, step: 'Triggers & World-State',
      data: {
        triggers: {
          start: `${spec.startTrigger.kind}: ${spec.startTrigger.condition}`,
          // Not a gap: the engine STATES the answer — a vanilla quest cannot fail (W17: the brief had asked for the marker).
          fail: `none — an accepted quest can never fail or be abandoned (${failureLaw}); ${spec.failure}`,
          worldMutation: spec.stages.map((stage) => `${stage.id}: ${stage.state}`).join('; '),
        },
        [SOURCED_FIELD]: stamp(questEntity, spec, ['startTrigger', 'stages', `(law ${failureLaw})`]),
      },
      gaps: [],
    },
    {
      catalogId: 'quests', entityId: questId, step: 'Rewards',
      data: {
        rewards: spec.rewards.map((reward) => `${reward.kind}: ${reward.what}`),
        rewardDetail: { entries: spec.rewards },
        [SOURCED_FIELD]: stamp(questEntity, spec, ['rewards']),
      },
      gaps: spec.rewards.length ? [] : ['rewards: Q_DIABLO has no separate scripted quest reward'],
    },
    {
      catalogId: 'quests', entityId: questId, step: 'NPC & Dialog Binding',
      data: {
        npcs: [
          giver,
          ...spec.lines.map((line) => `${line.speaker}:${line.line} (${line.stage})`),
          ...dialogLinks.map((link) => `dialog-trees::${link.entityId}`),
        ],
        links: dialogLinks,
        [SOURCED_FIELD]: stamp(questEntity, spec, ['giver', 'lines', 'dialog topic quest']),
      },
      gaps: [],
    },
    {
      catalogId: 'quests', entityId: questId, step: 'Journal / Lore',
      data: {
        journal: `${questLogLine} is the engine-selected quest-log line for ${questId}. ${journalLaw} controls visibility: an active quest appears only after its independent journal flag is set, while a completed quest remains listed and cannot be selected for replay. Active and completed entries are grouped and ordered by the quest log.`,
        questLogLine,
        ...(questLogLink ? { links: [questLogLink] } : {}),
        [SOURCED_FIELD]: stamp(questEntity, spec, ['links[role=quest-log-line]', `(law ${journalLaw})`]),
      },
      gaps: questLogLink ? [] : ['questLogLine: the promoted quest entity has no quest-log-line link'],
    },
  ];
}
