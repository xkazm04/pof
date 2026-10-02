/**
 * The ONE decoder of a lab step record (`LabStepArtifact`).
 *
 * A record is a small state machine kept in booleans: `done` (content exists), `error` (the last
 * produce failed), `syncError`, `serverSeen`. A produce that fails on a step with no prior record
 * writes a not-done FAILURE MARKER (`{ done: false, data: {}, error }`) so the failure is visible.
 * Every reader used to read the marker's PRESENCE as produced content and grade its empty `data`:
 * a fabricated pass on checker-less steps, a phantom deferred gate, a server row shadowed in the
 * matrix and the coach, and a refresh reporting the empty failure as unsaved local work.
 *
 * The rule, for every reader (derivation, matrix, both coaches, store, produce log):
 *  - content exists iff `done` ({@link contentOf}) — only content is ever graded;
 *  - a failure is a fact about the last ATTEMPT ({@link produceFailureOf}), never content;
 *  - a content-less record never shadows a server row ({@link effectiveSteps}, {@link adoptOnto});
 *  - a content-less failure reaches the coach as a verdict whose reason names it
 *    ({@link coachVerdictOf}), so it travels the one hint channel (`settlementOf` →
 *    `coachActionFor`) instead of a second reason path. Pure.
 */
import type { LabStepArtifact } from './labPipelineStore';
import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { SettleVerdict } from '@/lib/catalog/stepSettlement';

/** The record when it holds produced content, else undefined (a failure marker holds none). */
export function contentOf(art: LabStepArtifact | undefined): LabStepArtifact | undefined {
  return art?.done ? art : undefined;
}

export interface ProduceFailure {
  error: string;
  /** When it failed; absent on records from before the stamp existed. */
  errorAt?: string;
}

/** The last produce attempt's failure, or null when it did not fail. */
export function produceFailureOf(art: LabStepArtifact | undefined): ProduceFailure | null {
  if (!art?.error) return null;
  return { error: art.error, ...(art.errorAt ? { errorAt: art.errorAt } : {}) };
}

/**
 * What the coach reads for a step whose only record is a failure: not a grade (the display status
 * stays `unproduced`), a reason. `settlementOf` classifies it as `produce` and `coachActionFor`
 * quotes the reason as the hint. Undefined for a record with content or with no failure.
 */
export function failureVerdictOf(art: LabStepArtifact | undefined): SettleVerdict | undefined {
  const failure = contentOf(art) ? null : produceFailureOf(art);
  return failure ? { status: 'unproduced', reason: `Last produce failed — ${failure.error}` } : undefined;
}

/** The verdict the coach ladder reads: the derived artifact's, else a content-less failure's. */
export function coachVerdictOf(derived: SettleVerdict | undefined, local: LabStepArtifact | undefined): SettleVerdict | undefined {
  return derived ?? failureVerdictOf(local);
}

/**
 * A server record taken onto a local one that has no content (absent, or a failure marker):
 * the server's content and verdict, stamped `serverSeen`, keeping the failure trace so the
 * produce log and the step banner still say the last local attempt failed.
 */
export function adoptOnto(server: LabStepArtifact, cur: LabStepArtifact | undefined): LabStepArtifact {
  const failure = produceFailureOf(cur);
  return { ...server, serverSeen: server.at, ...(failure ?? {}) };
}

/** Project a server artifact into the local record shape so it can seed the shared derivation. */
function asLocal(a: PipelineArtifact): LabStepArtifact {
  return { done: true, data: a.data, ueAssets: a.ueAssets, at: a.updatedAt ?? '' };
}

/**
 * The ONE add-only server/local merge the matrix and the global coach seed the derivation with:
 * local wins when it holds content; a content-less local record (failure marker) never shadows a
 * server row — it only adds its failure trace to it — and stands alone where the server has none.
 */
export function effectiveSteps(
  serverRow: ReadonlyMap<string, PipelineArtifact> | undefined,
  localRow: Record<string, LabStepArtifact> | undefined,
): { serverArts: Record<string, PipelineArtifact>; effective: Record<string, LabStepArtifact> } {
  const serverArts: Record<string, PipelineArtifact> = {};
  const effective: Record<string, LabStepArtifact> = {};
  for (const [step, art] of serverRow ?? []) { serverArts[step] = art; effective[step] = asLocal(art); }
  for (const [step, art] of Object.entries(localRow ?? {})) {
    const srv = effective[step];
    effective[step] = contentOf(art) || !srv ? art : { ...srv, ...(produceFailureOf(art) ?? {}) };
  }
  return { serverArts, effective };
}

/** Parse an ISO stamp defensively — an unparseable one must never look NEWER than the server. */
function ms(at: string | undefined): number {
  const n = at ? Date.parse(at) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Does this local record hold work the server has not got? True when it holds content AND its
 * write-through is on record as failed or it was produced STRICTLY after the server's row — an
 * adoption would destroy something that exists nowhere else, so a refresh keeps it. A failure
 * marker holds no content, so it is never unsaved work (its `at` is the failure time).
 */
export function hasUnsyncedLocalWork(cur: LabStepArtifact, server: LabStepArtifact | undefined): boolean {
  if (!contentOf(cur)) return false;
  if (cur.syncError !== undefined) return true;
  return ms(cur.at) > ms(server?.at ?? cur.serverSeen);
}

/**
 * Is this local record provably a COPY of a server row (rather than local-only work)? Only such a
 * step may be reconciled away when the server drops it. A record from before `serverSeen` existed
 * has no proof either way, so it is never removed.
 */
export function isServerDerived(cur: LabStepArtifact): boolean {
  return cur.serverSeen !== undefined && cur.syncError === undefined && ms(cur.at) <= ms(cur.serverSeen);
}
