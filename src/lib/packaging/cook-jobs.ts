/**
 * Cooks as server jobs: one job per project, held on globalThis, shared by the
 * interactive Package button (`POST /api/packaging/execute`) and the nightly runner
 * (`startScheduledRun`). Same shape as `src/lib/evaluator/deep-eval-job.ts`.
 *
 * A cook used to be a generator driven inside the POST response with `signal:
 * req.signal`, so the UAT process tree lived exactly as long as the browser fetch:
 * reload, tab close or pane eviction killed a 20-60 min cook. And the two paths kept
 * two single-flight guards that never saw each other (client state vs a module
 * boolean only the nightly read), so both could run UAT against one staging dir.
 *
 * Here the job owns the process. Every event gets a monotonic `seq` and lands in a
 * bounded ring; a client SUBSCRIBES from a seq (replay, then live) and detaching
 * never cancels. Only `cancelCookJob` aborts the executor, which kills the tree and
 * yields `error{status:'cancelled'}`; the job still finalizes, so a cancelled cook is
 * recorded as cancelled. A settled job stays readable by id for {@link SETTLED_TTL_MS}
 * so a client that reattaches after the end still receives `recorded {buildId}`.
 * Server-only; client code imports only the types.
 */

import { cookExecutor, type CookEvent, type CookExecutorOptions } from './cook-executor';
import type { BuildProfile } from './build-profiles';
import { finalizeCook, type FinalizeDeps } from './finalize-build';
import { logger } from '@/lib/logger';
import { ok, err, type Result } from '@/types/result';

export type CookJobKind = 'interactive' | 'nightly';

/** What the job appends AFTER the terminal event (the finalizer's report). */
export type CookFinalizeEvent =
  | { type: 'recorded'; buildId: number; version: string | null; versionRule?: string }
  | { type: 'size-baseline'; baseline: unknown; note: string }
  | { type: 'size-regression'; note: string }
  | { type: 'record-error'; message: string; note: string };

export type CookJobEvent = CookEvent | CookFinalizeEvent;
export type SequencedCookEvent = CookJobEvent & { seq: number };

/** The job snapshot GET answers (no events). */
export interface CookJobInfo {
  jobId: string;
  projectPath: string;
  profileId: string;
  kind: CookJobKind;
  startedAt: number;
  /** Seq of the newest event, -1 before the first. */
  lastSeq: number;
  settled: boolean;
  finishedAt: number | null;
  /** One line on how the job ended, once settled. */
  outcome: string | null;
}

export interface CookJobListener {
  onEvent: (ev: SequencedCookEvent) => void;
  onSettled?: () => void;
}

/** A job body: emits events, honours the signal, resolves with its outcome line. */
export type CookJobRun = (emit: (ev: CookJobEvent) => void, signal: AbortSignal) => Promise<string>;

interface CookJob {
  info: CookJobInfo;
  key: string;
  events: SequencedCookEvent[];
  logCount: number;
  controller: AbortController;
  listeners: Set<CookJobListener>;
  done: Promise<CookJobInfo>;
}

interface Registry { byId: Map<string, CookJob>; active: Map<string, CookJob>; counter: number }

/** A settled job is kept this long so a late reattach still gets `recorded`. */
export const SETTLED_TTL_MS = 10 * 60_000;
/** Log events kept per job; phase/progress/terminal/finalize events are never dropped. */
export const MAX_JOB_LOG_EVENTS = 4000;

const g = globalThis as typeof globalThis & { __pofCookJobs?: Registry };
const reg: Registry = (g.__pofCookJobs ??= { byId: new Map(), active: new Map(), counter: 0 });

/** Windows paths: separators, trailing slash and case do not make a second project. */
export function cookProjectKey(projectPath: string): string {
  return projectPath.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function isTerminal(ev: CookJobEvent): ev is Extract<CookEvent, { type: 'done' | 'error' }> {
  return ev.type === 'done' || ev.type === 'error';
}

function append(job: CookJob, ev: CookJobEvent): void {
  const seqd = { ...ev, seq: job.info.lastSeq + 1 } as SequencedCookEvent;
  job.info.lastSeq = seqd.seq;
  job.events.push(seqd);
  if (ev.type === 'log' && ++job.logCount > MAX_JOB_LOG_EVENTS) {
    // Drop the OLDEST log line; seq stays monotonic, so a resume never re-reads it.
    job.events.splice(job.events.findIndex((e) => e.type === 'log'), 1);
    job.logCount--;
  }
  for (const l of job.listeners) {
    try { l.onEvent(seqd); } catch (e) { logger.warn('[cook-jobs] a subscriber threw; detaching it', e); job.listeners.delete(l); }
  }
}

/**
 * Start a job for a project, or refuse (naming the job that holds it). The project is
 * locked synchronously, before the body's first await, so two callers can never both
 * pass the check.
 */
export function runCookJob(
  spec: { projectPath: string; profileId: string; kind: CookJobKind },
  run: CookJobRun,
): Result<CookJobInfo, string> {
  const key = cookProjectKey(spec.projectPath);
  const busy = reg.active.get(key);
  if (busy) {
    const who = busy.info.kind === 'nightly' ? 'a nightly build' : 'an interactive cook';
    return err(`${who} is already running for this project (job ${busy.info.jobId})`);
  }
  const controller = new AbortController();
  const info: CookJobInfo = {
    jobId: `cook-${Date.now().toString(36)}-${++reg.counter}`,
    projectPath: spec.projectPath, profileId: spec.profileId, kind: spec.kind,
    startedAt: Date.now(), lastSeq: -1, settled: false, finishedAt: null, outcome: null,
  };
  const job = { info, key, events: [], logCount: 0, controller, listeners: new Set() } as unknown as CookJob;
  reg.byId.set(info.jobId, job);
  reg.active.set(key, job);

  job.done = (async () => {
    let outcome: string;
    try {
      outcome = await run((ev) => append(job, ev), controller.signal);
    } catch (e) {
      outcome = `job crashed: ${e instanceof Error ? e.message : String(e)}`;
      logger.error('[cook-jobs] job body threw', e);
    }
    info.settled = true;
    info.finishedAt = Date.now();
    info.outcome = outcome;
    if (reg.active.get(key) === job) reg.active.delete(key);
    const listeners = [...job.listeners];
    job.listeners.clear();
    for (const l of listeners) { try { l.onSettled?.(); } catch { /* a closed client */ } }
    const ttl = setTimeout(() => { if (reg.byId.get(info.jobId) === job) reg.byId.delete(info.jobId); }, SETTLED_TTL_MS);
    (ttl as { unref?: () => void }).unref?.();
    return { ...info };
  })();
  return ok({ ...info });
}

export interface CookJobContext {
  kind?: CookJobKind;
  profile: BuildProfile;
  projectPath: string;
  projectName: string;
  ueVersion: string;
}

export interface CookJobDeps {
  /** Test seam; defaults to the real UAT executor. */
  executor?: (opts: CookExecutorOptions) => AsyncIterable<CookEvent>;
  finalizeDeps: FinalizeDeps;
}

/**
 * The interactive cook as a job: stream the executor, then finalize through the one
 * shared finalizer (`finalize-build.ts`) and append what it recorded. A cook that
 * ends without a terminal event is reported (failed, or cancelled if the signal
 * fired), never left silent.
 */
export function startCookJob(ctx: CookJobContext, deps: CookJobDeps): Result<CookJobInfo, string> {
  const { profile, projectPath, projectName, ueVersion } = ctx;
  const executor = deps.executor ?? cookExecutor;
  return runCookJob({ projectPath, profileId: profile.id, kind: ctx.kind ?? 'interactive' }, async (emit, signal) => {
    const startedAt = Date.now();
    let last: CookEvent | null = null;
    try {
      for await (const ev of executor({ profile, projectPath, projectName, ueVersion, signal })) {
        last = ev;
        emit(ev);
        if (isTerminal(ev)) break;
      }
    } catch (e) {
      last = null;
      if (!signal.aborted) {
        last = { type: 'error', message: e instanceof Error ? e.message : String(e), status: 'failed', t: Date.now() - startedAt };
        emit(last);
      }
    }
    if (!last || !isTerminal(last)) {
      last = signal.aborted
        ? { type: 'error', message: 'cook cancelled — process tree terminated', status: 'cancelled', t: Date.now() - startedAt }
        : { type: 'error', message: 'cook produced no result', status: 'failed', t: Date.now() - startedAt };
      emit(last);
    }
    emitFinalize(last, startedAt, { projectPath, platform: profile.platform, config: profile.config }, deps.finalizeDeps, emit);
    return last.type === 'done' ? 'cook succeeded' : `cook ${last.status}: ${last.message}`;
  });
}

function emitFinalize(
  last: Extract<CookEvent, { type: 'done' | 'error' }>, startedAt: number,
  fctx: { projectPath: string; platform: string; config: string },
  deps: FinalizeDeps, emit: (ev: CookJobEvent) => void,
): void {
  const done = last.type === 'done';
  try {
    const fin = finalizeCook(
      last.type === 'done'
        ? { kind: 'done', exePath: last.exePath, durationMs: last.durationMs, sizeBytes: last.sizeBytes }
        : { kind: 'error', status: last.status, message: last.message, durationMs: Date.now() - startedAt },
      fctx, deps,
    );
    emit({
      type: 'recorded', buildId: fin.buildId, version: fin.version,
      versionRule: done ? 'bump-per-green-cook' : 'no version — only a green cook carries one',
    });
    // State the reference on EVERY measured cook, pass or fail: a first-ever build and
    // a build that genuinely did not grow must not be the same silence.
    if (fin.baselineNote != null) emit({ type: 'size-baseline', baseline: fin.baseline, note: fin.baselineNote });
    if (fin.regression) emit({ type: 'size-regression', note: fin.regression.note });
  } catch (persistErr) {
    // A cook the app FAILED TO RECORD must not read as a recorded build.
    logger.error('[cook-jobs] failed to record build to history', persistErr);
    emit({
      type: 'record-error',
      message: persistErr instanceof Error ? persistErr.message : String(persistErr),
      note: 'The cook finished, but writing it to build history FAILED — no row exists for '
        + 'this build. It will not appear in history, stats, or the size baseline.',
    });
  }
}

/** Replay events with seq >= fromSeq, then follow live until the job settles. */
export function subscribeCookJob(jobId: string, fromSeq: number, listener: CookJobListener): Result<() => void, string> {
  const job = reg.byId.get(jobId);
  if (!job) return err(`no cook job ${jobId}`);
  for (const ev of job.events) if (ev.seq >= fromSeq) listener.onEvent(ev);
  if (job.info.settled) { listener.onSettled?.(); return ok(() => {}); }
  job.listeners.add(listener);
  return ok(() => { job.listeners.delete(listener); });
}

/** Abort the job's executor (kills the UAT tree). The job settles on its own. */
export function cancelCookJob(jobId: string): Result<CookJobInfo, string> {
  const job = reg.byId.get(jobId);
  if (!job) return err(`no cook job ${jobId}`);
  if (!job.info.settled) job.controller.abort();
  return ok({ ...job.info });
}

export function getCookJob(jobId: string): CookJobInfo | null {
  const job = reg.byId.get(jobId);
  return job ? { ...job.info } : null;
}

/** The job currently holding a project, if any (settled jobs are not active). */
export function activeCookJob(projectPath: string): CookJobInfo | null {
  const job = reg.active.get(cookProjectKey(projectPath));
  return job ? { ...job.info } : null;
}

export function hasActiveCookJob(kind?: CookJobKind): boolean {
  for (const job of reg.active.values()) if (!kind || job.info.kind === kind) return true;
  return false;
}

/** Resolves with the settled snapshot. */
export function awaitCookJob(jobId: string): Promise<CookJobInfo> {
  const job = reg.byId.get(jobId);
  return job ? job.done : Promise.reject(new Error(`no cook job ${jobId}`));
}

/**
 * The job as an SSE body: replay from `fromSeq`, follow live, close when the job
 * settles. The client going away (`signal`, or the reader cancelling) only
 * unsubscribes: it never cancels the cook.
 */
export function cookJobEventStream(jobId: string, fromSeq: number, signal?: AbortSignal): ReadableStream<Uint8Array> | null {
  if (!reg.byId.has(jobId)) return null;
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        try { controller.close(); } catch { /* already closed */ }
      };
      const sub = subscribeCookJob(jobId, fromSeq, {
        onEvent: (ev) => { if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`)); },
        onSettled: close,
      });
      if (sub.ok) unsubscribe = sub.data;
      if (closed) unsubscribe?.();
      signal?.addEventListener('abort', close);
    },
    cancel() { closed = true; unsubscribe?.(); },
  });
}

/** Test seam: drop every job (the registry is process-global). */
export function __resetCookJobsForTests(): void {
  for (const job of reg.active.values()) job.controller.abort();
  reg.byId.clear();
  reg.active.clear();
}

/** SSE response headers shared by the execute and attach routes. */
export const COOK_SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};
