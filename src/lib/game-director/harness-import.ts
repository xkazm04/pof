/**
 * Import a STORED harness run as a Game Director session — the in-app door
 * beside `scripts/game-director/ingest-run.mjs`.
 *
 * Every orchestrated run already lands in `harness_runs` (`plan_json` +
 * `progress_json`), which is exactly the `{ plan, progress }` pair
 * `ingestExternalPlaytest` consumes. This module adds the three things the
 * terminal door never had:
 *
 * - **A preview** — `previewHarnessRun` runs the same `validateRunRecord` +
 *   `buildIngestPlan` the import will, and projects it to what the operator
 *   decides on (build identity, findings, unrouted, refused, score). It writes
 *   nothing; `buildIngestPlan` is pure, so a preview costs one function call.
 * - **Run identity** — the run id is stamped into `config.harnessRunId`, so one
 *   run is one session (`playtest-signal-to-defect` →
 *   `session-instrumentation-contract`: build identity precise enough that two
 *   people cannot disagree about it). A second import is REFUSED naming the
 *   session that holds it, instead of a duplicate double-weighted in avgScore.
 * - **Single flight** — the "already imported?" lookup and the claim on the run
 *   are one synchronous step (no await between them), and a concurrent import of
 *   the same run waits on the one in flight and is then refused. A double click
 *   cannot write two sessions even with a writer that yields before it inserts.
 *
 * Scope, stated: dedupe covers THIS door only. A run ingested through the raw
 * `ingest-external` action (the script) carries no run identity and is not
 * recognised here, and that door stays as it is.
 *
 * No database here: the writer, the completion pipeline and the lookup are
 * injected (the route binds them), so the whole seam is unit-testable.
 */

import type { GamePlan, ProgressEntry } from '@/lib/harness/types';
import { ok, err, type Result } from '@/types/result';
import {
  validateRunRecord,
  buildIngestPlan,
  ingestExternalPlaytest,
  type DirectorWriter,
  type HarnessRunRecord,
  type IngestOutcome,
  type RejectedEntry,
  type SessionContract,
  type UnroutedEntry,
} from './external-ingest';

/** The slice of a stored run (`HarnessRunDetail`) the import reads. */
export interface HarnessRunSource {
  runId: string;
  plan: GamePlan | null;
  progress: ProgressEntry[];
}

/** One row of the Director's run picker (`GET ?action=harness-runs`). */
export interface HarnessRunOption {
  runId: string;
  projectName: string;
  projectPath: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  iteration: number;
  passRate: number;
  /** The session this run was already imported as; null = never imported. */
  ingestedSessionId: string | null;
}

/** What the session WOULD contain — computed by the import's own mapping. */
export interface HarnessRunPreview {
  runId: string;
  contract: SessionContract;
  findingsCount: number;
  unrouted: UnroutedEntry[];
  rejected: RejectedEntry[];
  overallScore: number;
  sessionName: string;
}

/**
 * The stored `{ plan, progress }` pair, or a refusal naming the run.
 * `startRun` persists a missing plan as `'{}'`, which parses to an empty
 * object — that is "no recorded plan" too, not a plan with no areas.
 */
export function harnessRunToRecord(run: HarnessRunSource): Result<HarnessRunRecord, string> {
  const plan = run.plan as unknown;
  if (!plan || typeof plan !== 'object' || Object.keys(plan).length === 0) {
    return err(`run ${run.runId} has no recorded plan`);
  }
  return ok({ plan: run.plan as GamePlan, progress: Array.isArray(run.progress) ? run.progress : [] });
}

export interface HarnessPreviewOptions {
  now: () => number;
  projectId?: string;
  sessionName?: string;
}

/** Preview = the import's own validation + mapping, projected to counts. Writes nothing. */
export function previewHarnessRun(
  run: HarnessRunSource,
  opts: HarnessPreviewOptions,
): Result<HarnessRunPreview, string> {
  const record = harnessRunToRecord(run);
  if (!record.ok) return record;
  const validated = validateRunRecord(record.data);
  if (!validated.ok) return validated;
  const planned = buildIngestPlan(validated.data, {
    now: opts.now,
    projectId: opts.projectId,
    sessionName: opts.sessionName,
    harnessRunId: run.runId,
  });
  if (!planned.ok) return planned;
  const p = planned.data;
  return ok({
    runId: run.runId,
    contract: p.contract,
    findingsCount: p.findings.length,
    unrouted: p.unrouted,
    rejected: p.rejected,
    overallScore: p.summary.overallScore,
    sessionName: p.create.name,
  });
}

/** Why an import did not write: the run is already a session, or its record is refused. */
export type HarnessImportRefusal =
  | { kind: 'duplicate'; sessionId: string; message: string }
  | { kind: 'invalid'; message: string };

function duplicate(runId: string, sessionId: string): HarnessImportRefusal {
  return {
    kind: 'duplicate',
    sessionId,
    message: `Harness run ${runId} is already imported as session ${sessionId} — a second import would count the same run twice, so it was refused.`,
  };
}

export interface HarnessImportDeps {
  writer: DirectorWriter;
  /** The ONE completion pipeline (matrix routing + regression analysis) the route runs for every completion. */
  complete: (sessionId: string) => Promise<void>;
  /** Session id this run was already imported as, or null. Must be synchronous. */
  findIngested: (runId: string) => string | null;
  now?: () => number;
  projectId?: string;
  sessionName?: string;
}

type ImportResult = Result<IngestOutcome, HarnessImportRefusal>;

/** Imports in flight, keyed by run id — the single-flight guard. */
const inFlight = new Map<string, Promise<ImportResult>>();

async function runImport(run: HarnessRunSource, deps: HarnessImportDeps): Promise<ImportResult> {
  const record = harnessRunToRecord(run);
  if (!record.ok) return err({ kind: 'invalid', message: record.error });
  const outcome = await ingestExternalPlaytest(record.data, {
    writer: deps.writer,
    now: deps.now,
    projectId: deps.projectId,
    sessionName: deps.sessionName,
    harnessRunId: run.runId,
  });
  if (!outcome.ok) return err({ kind: 'invalid', message: outcome.error });
  await deps.complete(outcome.data.sessionId);
  return ok(outcome.data);
}

/**
 * Import one stored run, at most once. The lookup, the in-flight check and the
 * claim run in one synchronous step, so no interleaving request can slip
 * between "not imported yet" and "this import owns the run".
 */
export async function importHarnessRun(run: HarnessRunSource, deps: HarnessImportDeps): Promise<ImportResult> {
  const existing = deps.findIngested(run.runId);
  if (existing) return err(duplicate(run.runId, existing));

  const pending = inFlight.get(run.runId);
  if (pending) {
    const first = await pending;
    return first.ok ? err(duplicate(run.runId, first.data.sessionId)) : first;
  }

  const flight = runImport(run, deps);
  inFlight.set(run.runId, flight);
  try {
    return await flight;
  } finally {
    inFlight.delete(run.runId);
  }
}
