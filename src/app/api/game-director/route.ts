import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  updateSessionStatus,
  updateSessionSummary,
  addFinding,
  getFindings,
  getAllFindings,
  addEvent,
  getEvents,
  getDirectorStats,
  getHealthTrend,
  updateFindingTriage,
  markFindingFixDispatched,
  getSessionByHarnessRun,
} from '@/lib/game-director-db';
import type {
  CreateSessionPayload,
  PlaytestFinding,
  PlaytestSummary,
  DirectorEvent,
  PlaytestStatus,
  UpdateTriagePayload,
  SessionSource,
} from '@/types/game-director';
import { isTriageStatus, validateTriageRepro } from '@/types/game-director';
import { simulatePlaytest } from '@/lib/game-director-sim';
import { ingestExternalPlaytest } from '@/lib/game-director/external-ingest';
import { createDbDirectorWriter, createDbMatrixRoutingDeps } from '@/lib/game-director/db-writer';
import { routeFindingsToMatrix } from '@/lib/game-director/matrix-routing';
import { processSession } from '@/lib/regression-tracker';
import { listRuns, getRun } from '@/lib/harness-runs-db';
import {
  previewHarnessRun,
  importHarnessRun,
  type HarnessRunOption,
} from '@/lib/game-director/harness-import';
import { normalizeProjectId } from '@/lib/project-id';
import { logger } from '@/lib/logger';

/**
 * Coerce a client-supplied `source` to a known value. Anything unrecognised
 * falls back to the caller's default rather than reaching the DB CHECK
 * constraint — and an unrecognised value can never resolve to 'external',
 * because provenance is only ever claimed explicitly.
 */
function normalizeSource(value: unknown, fallback: SessionSource): SessionSource {
  return value === 'external' || value === 'simulated' ? value : fallback;
}

/** Append one completion-pipeline disclosure to a session's timeline. */
function stampPipelineEvent(sessionId: string, tag: string, message: string, data?: Record<string, unknown>) {
  addEvent({
    id: `ev-${Date.now()}-${tag}-${Math.random().toString(36).slice(2, 7)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    type: 'action',
    message,
    data,
  });
}

/**
 * On completion, route the session's findings to the feature matrix — the step
 * that turns a finding into work somebody owns. Best-effort by design: the
 * session is already written, so a routing failure is DISCLOSED on the timeline
 * rather than failing the completion. Every outcome, including "nothing was
 * written and here is why", lands as an event so the session detail can state
 * it instead of leaving the reader to assume a write happened.
 */
async function routeSessionFindings(sessionId: string, source: SessionSource, projectIdOverride?: string) {
  const session = getSession(sessionId);
  if (!session) return;
  const projectId = projectIdOverride?.trim() || session.config?.projectId?.trim() || '';
  const findings = getFindings(sessionId);

  const stampEvent = (message: string, data?: Record<string, unknown>) =>
    stampPipelineEvent(sessionId, 'matrix', message, data);

  if (findings.length === 0) {
    stampEvent('Matrix routing: this session recorded no findings, so no feature-matrix row was updated.', {
      matrixRowsUpdated: 0,
    });
    return;
  }

  try {
    const result = await routeFindingsToMatrix(
      { sessionId, sessionName: session.name, source, findings, projectId },
      createDbMatrixRoutingDeps(),
    );
    if (!result.ok) {
      stampEvent(`Matrix routing SKIPPED — ${result.error}`, { matrixRowsUpdated: 0, skipped: true });
      return;
    }
    stampEvent(`Matrix routing: ${result.data.disclosure}.`, {
      matrixRowsUpdated: result.data.updated.length,
      alreadyPresent: result.data.alreadyPresent.length,
      unrouted: result.data.unrouted,
      rows: result.data.updated,
    });
  } catch (routingError) {
    logger.error('[game-director] matrix routing failed:', routingError);
    stampEvent(`Matrix routing FAILED — ${String(routingError)}. No row is known to have been updated.`, {
      matrixRowsUpdated: 0,
      failed: true,
    });
  }
}

/**
 * On completion, analyze the session for regressions — so the Regressions pill,
 * the alerts and the trend markers exist for every completed session without
 * anyone remembering to click Analyze. Best-effort and disclosed exactly like
 * matrix routing: the session is already written, so a failure is stated on the
 * timeline instead of failing the completion. The tracker decides the pass by
 * session time: a session older than the newest analyzed one only backfills.
 */
function analyzeSessionRegressions(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) return;
  try {
    const report = processSession(session);
    const counts = `${report.newFindings.length} new, ${report.regressions.length} regressed, ${report.newlyFixed.length} newly fixed`;
    const message = report.mode === 'backfill'
      ? `Regression analysis (backfill — older than the newest analyzed session, so it recorded occurrences only and changed no status): ${counts}.`
      : `Regression analysis: ${counts}.`;
    stampPipelineEvent(sessionId, 'regression', message, {
      mode: report.mode,
      newFindings: report.newFindings.length,
      regressions: report.regressions.length,
      newlyFixed: report.newlyFixed.length,
      persistent: report.persistent.length,
    });
  } catch (analysisError) {
    logger.error('[game-director] regression analysis failed:', analysisError);
    stampPipelineEvent(
      sessionId, 'regression',
      `Regression analysis FAILED — ${String(analysisError)}. No regression state is known to have changed.`,
      { failed: true },
    );
  }
}

/**
 * The ONE set of completion side-effects, shared by every path that completes a
 * session (simulate, ingest-external, the external writer's complete): route the
 * findings to the matrix, then analyze regressions. Each step discloses itself.
 */
async function completeSessionPipeline(sessionId: string, source: SessionSource, projectIdOverride?: string) {
  await routeSessionFindings(sessionId, source, projectIdOverride);
  analyzeSessionRegressions(sessionId);
}

// ─── GET: list sessions, get single session, get findings, get events, get stats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'list';
    const sessionId = searchParams.get('sessionId');

    switch (action) {
      case 'list':
        // Bound the UI list — the sessions table grows unbounded over the project's
        // life; the switcher only ever shows the most recent handful.
        return apiSuccess(listSessions(200));

      case 'get':
        if (!sessionId) return apiError('sessionId required', 400);
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);
        return apiSuccess(session);

      case 'findings':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getFindings(sessionId));

      case 'all-findings':
        // Batch path for FindingsExplorer: one request returning every finding,
        // grouped/filtered client-side. Replaces the per-session fan-out.
        return apiSuccess(getAllFindings());

      case 'events':
        if (!sessionId) return apiError('sessionId required', 400);
        return apiSuccess(getEvents(sessionId));

      case 'stats':
        return apiSuccess(getDirectorStats());

      case 'trend': {
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam))) : 30;
        return apiSuccess(getHealthTrend(limit));
      }

      case 'harness-runs': {
        // The stored harness runs of ONE project, each with the session it was
        // already imported as. harness_runs keeps the raw project path while the
        // Director's projectId may be spelled differently, so the join is on the
        // normalized id — over the newest 500 runs (listRuns' ceiling).
        const projectId = normalizeProjectId(searchParams.get('projectId'));
        if (!projectId) return apiError('projectId required — harness runs are listed per project', 400);
        const rows: HarnessRunOption[] = listRuns({ limit: 500 })
          .filter((r) => normalizeProjectId(r.projectPath) === projectId)
          .map((r) => ({
            runId: r.runId,
            projectName: r.projectName,
            projectPath: r.projectPath,
            status: r.status,
            startedAt: r.startedAt,
            endedAt: r.endedAt,
            iteration: r.iteration,
            passRate: r.passRate,
            ingestedSessionId: getSessionByHarnessRun(r.runId)?.id ?? null,
          }));
        return apiSuccess(rows);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    logger.error('[game-director] GET error:', err);
    return apiError(String(err));
  }
}

// ─── POST: create session, start session, add finding, add event, run analysis
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case 'create': {
        const { name, buildPath, config, source } = body as CreateSessionPayload & { action: string };
        const id = `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        // Unstated provenance is 'simulated': a caller must SAY it is feeding real
        // playtest data, and the default can only ever understate the truth.
        const session = createSession(id, name, buildPath, config, normalizeSource(source, 'simulated'));
        return apiSuccess(session);
      }

      case 'update-status': {
        const { sessionId, status } = body as { action: string; sessionId: string; status: PlaytestStatus };
        updateSessionStatus(sessionId, status);
        return apiSuccess({ ok: true });
      }

      case 'complete': {
        const { sessionId, summary, durationMs, systemsTestedCount, findingsCount, source } = body as {
          action: string;
          sessionId: string;
          summary: PlaytestSummary;
          durationMs: number;
          systemsTestedCount: number;
          findingsCount: number;
          source?: SessionSource;
        };
        // This is the EXTERNAL writer seam: a real harness (Gauntlet, the pof-mcp
        // headless runner, a human) POSTs its own measured summary here, so the
        // default provenance is 'external'. The in-repo simulator never reaches
        // this branch — it calls updateSessionSummary directly with 'simulated'.
        const completedSource = normalizeSource(source, 'external');
        updateSessionSummary(
          sessionId, summary, durationMs, systemsTestedCount, findingsCount,
          completedSource,
        );
        await completeSessionPipeline(sessionId, completedSource);
        return apiSuccess({ ok: true });
      }

      case 'add-finding': {
        const { finding } = body as { action: string; finding: PlaytestFinding };
        addFinding(finding);
        return apiSuccess({ ok: true });
      }

      case 'update-triage': {
        const {
          findingId, triageStatus, triageNote, snoozedUntil, reproAttempts, reproBuildId,
        } = body as UpdateTriagePayload & { action: string };
        if (!findingId || !triageStatus) return apiError('findingId and triageStatus required', 400);
        if (!isTriageStatus(triageStatus)) return apiError(`Unknown triage status: ${triageStatus}`, 400);
        // An 'unreproducible' verdict must state how many attempts it is speaking
        // for before it is allowed to be written — a verdict with no denominator
        // is a conclusion over an unstated scope, and it would be indistinguishable
        // from a dismissal the moment it landed in the queue.
        const repro = validateTriageRepro(triageStatus, reproAttempts, reproBuildId);
        if (!repro.ok) return apiError(repro.error, 400);
        const updated = updateFindingTriage(
          findingId,
          triageStatus,
          triageNote ?? '',
          snoozedUntil ?? null,
          repro.data,
        );
        if (!updated) return apiError('Finding not found', 404);
        return apiSuccess(updated);
      }

      case 'mark-fix-dispatched': {
        const { findingId } = body as { action: string; findingId: string };
        if (!findingId) return apiError('findingId required', 400);
        const updated = markFindingFixDispatched(findingId);
        if (!updated) return apiError('Finding not found', 404);
        return apiSuccess(updated);
      }

      case 'add-event': {
        const { event } = body as { action: string; event: DirectorEvent };
        addEvent(event);
        return apiSuccess({ ok: true });
      }

      case 'simulate': {
        // Runs the in-repo dev fixture: replays authored findings and stamps the
        // session `source: 'simulated'`. Nothing is launched or measured.
        const { sessionId } = body as { action: string; sessionId: string };
        const session = getSession(sessionId);
        if (!session) return apiError('Session not found', 404);

        await simulatePlaytest(sessionId, session.config);
        // The simulated path routes its findings the same way a real one does —
        // and the line it writes SAYS it is simulated, so a canned finding can
        // never read as an observed gap on the module's own work queue.
        await completeSessionPipeline(sessionId, 'simulated');
        const updatedSession = getSession(sessionId);
        return apiSuccess(updatedSession);
      }

      case 'ingest-external': {
        // The REAL-run door. A harness run record (the `game-plan.json` +
        // `progress.json` state pair the harness already writes) becomes a
        // session stamped `source: 'external'` end to end. A record that does
        // not satisfy the session contract is REFUSED with its reason — an
        // empty session stamped 'external' would read as a build that was
        // measured and found clean.
        const { run, sessionName, projectId } = body as {
          action: string;
          run: unknown;
          sessionName?: string;
          projectId?: string;
        };
        const outcome = await ingestExternalPlaytest(run, {
          writer: createDbDirectorWriter(),
          sessionName,
          projectId,
        });
        if (!outcome.ok) return apiError(outcome.error, 400);
        await completeSessionPipeline(outcome.data.sessionId, 'external', projectId);
        return apiSuccess(outcome.data);
      }

      case 'preview-harness-run': {
        // What importing a STORED run would write — the import's own validation
        // and mapping, projected to counts. Writes nothing.
        const { runId, projectId, sessionName } = body as {
          action: string; runId?: string; projectId?: string; sessionName?: string;
        };
        if (!runId) return apiError('runId required', 400);
        const run = getRun(runId);
        if (!run) return apiError(`Harness run ${runId} not found`, 404);
        const preview = previewHarnessRun(run, { now: () => Date.now(), projectId, sessionName });
        if (!preview.ok) return apiError(preview.error, 400);
        return apiSuccess({ ...preview.data, ingestedSessionId: getSessionByHarnessRun(runId)?.id ?? null });
      }

      case 'ingest-harness-run': {
        // Import a stored run, at most once: a re-import (sequential or
        // concurrent) is 409 naming the session that already holds the run.
        // Completion goes through the SAME pipeline as every other completion.
        const { runId, projectId, sessionName } = body as {
          action: string; runId?: string; projectId?: string; sessionName?: string;
        };
        if (!runId) return apiError('runId required', 400);
        const run = getRun(runId);
        if (!run) return apiError(`Harness run ${runId} not found`, 404);
        const outcome = await importHarnessRun(run, {
          writer: createDbDirectorWriter(),
          projectId,
          sessionName,
          findIngested: (id) => getSessionByHarnessRun(id)?.id ?? null,
          complete: (id) => completeSessionPipeline(id, 'external', projectId),
        });
        if (!outcome.ok) {
          return outcome.error.kind === 'duplicate'
            ? apiError(outcome.error.message, 409, { sessionId: outcome.error.sessionId })
            : apiError(outcome.error.message, 400);
        }
        return apiSuccess(outcome.data);
      }

      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    logger.error('[game-director] POST error:', err);
    return apiError(String(err));
  }
}

// ─── DELETE: remove session
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) return apiError('sessionId required', 400);
    deleteSession(sessionId);
    return apiSuccess({ ok: true });
  } catch (err) {
    logger.error('[game-director] DELETE error:', err);
    return apiError(String(err));
  }
}
