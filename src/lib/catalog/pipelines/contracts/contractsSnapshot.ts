/**
 * The `contracts` row's data model (spark `gta-quest-loop`, WP2). PURE — client-safe, no fs.
 *
 * A GTAI quest's source of truth is its package folder, `games/gtai/quests/<id>/` (`quest.json`,
 * `gtai.quest/1`). The catalog entity `gtai-<id>` is a MIRROR: the server reads the folder
 * (`contractsRead.ts`), writes one `ContractSnapshot` into the entity's `data.snapshot`, and each step's
 * artifact carries that step's slice of it. A step's checker grades the slice; nothing here is a toggle.
 *
 * Absent-value convention (the wire contract's): OMIT a key for "not applicable"; `null` is a claim
 * (`runId: null` = no council run could be named). `source: 'awaiting-sync'` = this artifact holds no
 * folder read at all (a stub produce on an entity the sync never wrote) — graded "deferred", never pass.
 */
import type { GuardOverride, QuestVerdict } from '@/lib/games/gtai-quest/types';

export const CONTRACTS_CATALOG = 'contracts';
export const CONTRACT_SNAPSHOT_SCHEMA = 'pof.contractSnapshot/1' as const;
/** Repo-relative folder of the quest packages. Folders starting with `_` (e.g. `_council`) are not quests. */
export const QUESTS_REL = 'games/gtai/quests';
export const COUNCIL_REL = `${QUESTS_REL}/_council`;

/** The five step labels, in order. NEVER rename one: `pipeline_artifacts` is keyed on the label. */
export const CONTRACT_STEPS = [
  { key: 'council', label: 'Council' },
  { key: 'plan', label: 'Plan' },
  { key: 'guards', label: 'Guards' },
  { key: 'package', label: 'Package' },
  { key: 'inGame', label: 'In-game' },
] as const;
export type ContractStepKey = (typeof CONTRACT_STEPS)[number]['key'];

export const contractEntityId = (questId: string) => `gtai-${questId}`;
export const questDirRel = (questId: string) => `${QUESTS_REL}/${questId}`;

export interface CouncilFacts {
  /** The council run behind the quest, or null when none could be named. */
  runId: string | null;
  /** `declared` = the package names it (`provenance.runId`); `inferred` = the only run holding every source path. */
  runIdBasis: 'declared' | 'inferred' | 'none';
  /** Runs that could have produced it (an inference with more than one is ambiguous). */
  candidates: readonly string[];
  runDir: string | null;
  runDirExists: boolean;
  seats: readonly { seat: string; state: string; reason?: string }[];
  /** Present iff `seats.json` EXISTS but did not parse — absent (unrecorded) and corrupt are different states. */
  seatsError?: string;
  /** The council's paths with their titles (empty until the run's proposals are readable). */
  paths: readonly { pathId: string; title: string }[];
  /** `provenance.sources[].pathId` — which paths the owner fused from. */
  sources: readonly string[];
}

export interface PlanFacts {
  parsed: boolean;
  /** Why the package does not parse as `gtai.quest/1` (present iff `parsed` is false). */
  error?: string;
  title: string;
  act: string;
  status: string;
  logline: string;
  goal: string;
  whyNotFiller: string;
  ownerNotes: string;
  beats: readonly { id: string; title: string; summary: string }[];
  /** The save engine's checkpoints (`autosavePoints`): empty for a package that declares none. */
  autosavePoints: readonly { id: string; beat: string; at: string; why: string }[];
  characters: readonly { id: string; name: string; status: string; role: string }[];
}

export interface JudgeFacts {
  present: boolean;
  /** Repo-relative path the report is read from. */
  path: string;
  /** Why a present file is not a usable `gtai.lineJudge/1` report. */
  error?: string;
  judgeSeat?: string;
  authorSeat?: string;
  judgedLines?: number;
  judgedAt?: string;
}

export interface GuardsFacts {
  /** `assessQuest` over `loadQuestContext()`; null when the package does not parse (nothing to assess). */
  verdict: QuestVerdict | null;
  overrides: readonly GuardOverride[];
  judge: JudgeFacts;
  /** Why the guards could not run on a parsed package (a loader or guard threw). */
  error?: string;
}

export interface PackageFacts {
  parsed: boolean;
  /** Each `new` character with the art files found for it under `<questDir>/art/<characterId>*`. */
  newCharacters: readonly { id: string; name: string; art: readonly string[] }[];
  lines: { total: number; reserved: number; recorded: number; unreserved: readonly string[] };
}

export interface InGameFacts {
  engine: string;
  selftest: { present: boolean; path: string; state: string | null; frame?: string; error?: string };
  /** Repo-relative PNG frames under `<questDir>/evidence/` that carry a real PNG signature. */
  frames: readonly string[];
}

export interface ContractSnapshot {
  schema: typeof CONTRACT_SNAPSHOT_SCHEMA;
  source: 'quest-folder';
  questId: string;
  questDir: string;
  derivedAt: string;
  council: CouncilFacts;
  plan: PlanFacts;
  guards: GuardsFacts;
  package: PackageFacts;
  inGame: InGameFacts;
}

/** The slice one step's artifact carries: the folder read for that step, stamped with its quest. */
export type StepSlice<K extends ContractStepKey> = { source: 'quest-folder'; questId: string; questDir: string } & ContractSnapshot[K];
export interface AwaitingSync { source: 'awaiting-sync'; note: string; direction?: string }

export const AWAITING_SYNC_NOTE =
  'no quest package mirrored: contracts rows are written by POST /api/games/gtai/quests/sync from ' +
  `${QUESTS_REL}/<id>/quest.json (run the /gta --quest protocol, then sync)`;

/** The snapshot an entity carries, or null (a starter, or a hand-made entity the sync never wrote). */
export function snapshotOf(entityData: unknown): ContractSnapshot | null {
  const s = (entityData as { snapshot?: unknown } | null | undefined)?.snapshot as Partial<ContractSnapshot> | undefined;
  return s && s.schema === CONTRACT_SNAPSHOT_SCHEMA && s.source === 'quest-folder' && typeof s.questId === 'string'
    ? (s as ContractSnapshot)
    : null;
}

/** One step's artifact `data` from a snapshot (or the awaiting-sync marker). Pure; used by produce AND sync. */
export function stepData(snapshot: ContractSnapshot | null, key: ContractStepKey, direction?: string): Record<string, unknown> {
  const dir = direction?.trim();
  if (!snapshot) {
    const marker: AwaitingSync = { source: 'awaiting-sync', note: AWAITING_SYNC_NOTE, ...(dir ? { direction: dir } : {}) };
    return { [key]: marker };
  }
  // No `derivedAt` in the slice: an unchanged folder re-synced must write byte-identical step content,
  // or every sync would archive a revision (`upsertArtifact` archives on content change).
  const { questId, questDir } = snapshot;
  return { [key]: { source: 'quest-folder', questId, questDir, ...snapshot[key] } };
}
