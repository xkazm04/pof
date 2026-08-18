import type { ZoneGraphParams } from '@/lib/world/zone-graph-generator';

/**
 * What every UE generation run records, whether it worked or not.
 *
 * The ledger used to hold room count + seed and nothing else, and only the
 * LATEST row was queryable — so the seed that produced a good map was
 * unrecoverable one re-roll later, and a run that FAILED left no trace at all.
 * These fields exist so a run is reconstructible: what generated it, with which
 * parameters, against which design document, and what came of it.
 */
export interface GenerationRunBase {
  id: number;
  seed: number;
  /** The generator that ran ('' only for rows written before it was recorded). */
  algorithm: string;
  /** Generator parameters exactly as dispatched — the rest of "what this run was". */
  params: Record<string, unknown>;
  /** The level design document this run belongs to, or null when it ran unattached. */
  docId: number | null;
  /** The UE map the run wrote ('' when the run never reported one). */
  mapPath: string;
  /** False for a failed run. A failed run is still a row — it never vanishes. */
  success: boolean;
  /** Why it failed. Always '' on success, and never empty on a failure. */
  failureReason: string;
  createdAt: string;
}

export interface ProcgenRun extends GenerationRunBase {
  /** Rooms the generator reported. 0 on a failed run — read `success` first. */
  roomCount: number;
}

export interface ScatterRun extends GenerationRunBase {
  /** Instances the scatter reported. 0 on a failed run — read `success` first. */
  instanceCount: number;
}

export interface ZoneGraphPin {
  id: number;
  seed: number;
  params: ZoneGraphParams;
  label: string;
  zoneCount: number;
  topology: string;
  createdAt: string;
}
