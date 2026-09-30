import type { CookEvent } from '@/lib/packaging/cook-executor';
import type { CookJobInfo, CookJobKind } from '@/lib/packaging/cook-jobs';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { CookCompletion, CookProgressProps, CookRecordEvent } from './types';

/**
 * The console's side of a cook JOB (`src/lib/packaging/cook-jobs.ts`). The cook is
 * owned by the server; this driver only subscribes: POST execute (start + stream) or
 * GET `?attach=` (reattach), deduplicating by `seq`. The cook settles ONCE, on the
 * `recorded`/`record-error` that follows `done`/`error` (the settle point
 * `cookHoldsPane` documents).
 *
 * A stream that closes with no settle used to be a guess ("the build may still be
 * running"). With a job id the driver ASKS instead: it re-queries the job and resumes
 * from the next seq while the job lives; only a job the server no longer holds, or
 * one that settled without a result, settles the console as failed, naming which.
 * A stream without a job id (a stub server) keeps the old terminal-event rule.
 */

export const COOK_JOBS_URL = '/api/packaging/cook-jobs';
/** Reattaches that deliver nothing new before the console gives up on the stream. */
const MAX_QUIET_REATTACHES = 3;

type WireEvent = (CookEvent | CookRecordEvent) & { seq?: number };

export type CookStreamStart =
  | { mode: 'request'; request: NonNullable<CookProgressProps['request']> }
  | { mode: 'attach'; job: CookJobInfo };

export interface CookStreamHandlers {
  /** Called synchronously before the first fetch: a new cook, clear the console. */
  onStart: () => void;
  /** The job id became known (the execute response header, or the attached job). */
  onJob: (job: { jobId: string; kind: CookJobKind }) => void;
  /** Every non-settling event (phase / progress / log / size notes). */
  onEvent: (ev: WireEvent) => void;
  onSettle: (result: CookCompletion) => void;
}

export const attachUrl = (jobId: string, from: number) =>
  `${COOK_JOBS_URL}?attach=${encodeURIComponent(jobId)}&from=${from}`;

async function refusal(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body?.error === 'string') return `HTTP ${res.status}: ${body.error}`;
  } catch { /* not an envelope */ }
  return `HTTP ${res.status}`;
}

async function readSse(body: ReadableStream<Uint8Array>, onEvent: (ev: WireEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const data = part.replace(/^data:\s?/, '').trim();
      if (!data) continue;
      let ev: WireEvent;
      try { ev = JSON.parse(data) as WireEvent; } catch { continue; }
      onEvent(ev);
    }
  }
}

export async function driveCookStream(start: CookStreamStart, signal: AbortSignal, h: CookStreamHandlers): Promise<void> {
  let jobId: string | null = start.mode === 'attach' ? start.job.jobId : null;
  const kind: CookJobKind = start.mode === 'attach' ? start.job.kind : 'interactive';
  const profileId = start.mode === 'attach' ? start.job.profileId : start.request.profileId;
  let lastSeq = -1;
  // Assigned inside `onWire` (a closure), so declared wide: TS cannot see that write.
  let pending = null as CookCompletion | null;
  let settled = false;
  let quiet = 0;
  const settle = (c: CookCompletion) => {
    if (settled) return;
    settled = true;
    h.onSettle({ ...c, kind, profileId, ...(jobId ? { jobId } : {}) });
  };
  const onWire = (ev: WireEvent) => {
    if (settled) return;
    if (typeof ev.seq === 'number') {
      if (ev.seq <= lastSeq) return; // replayed on resume: already seen
      lastSeq = ev.seq;
    }
    if (ev.type === 'done') pending = { status: 'success', exePath: ev.exePath };
    else if (ev.type === 'error') {
      pending = { status: 'failed', error: ev.message, ...(ev.status === 'cancelled' ? { cancelled: true } : {}) };
    } else if (ev.type === 'recorded' && pending) settle({ ...pending, buildId: ev.buildId });
    else if (ev.type === 'record-error' && pending) settle({ ...pending, recordError: ev.message });
    else h.onEvent(ev);
  };

  h.onStart();
  try {
    let res: Response = start.mode === 'request'
      ? await fetch('/api/packaging/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(start.request),
        signal,
      })
      : await fetch(attachUrl(start.job.jobId, 0), { signal });
    for (;;) {
      if (!res.ok || !res.body) { settle({ status: 'failed', error: await refusal(res) }); return; }
      const header = jobId ? null : res.headers?.get?.('X-Cook-Job-Id');
      if (header) { jobId = header; h.onJob({ jobId, kind }); }

      const before = lastSeq;
      await readSse(res.body, onWire);
      if (settled || signal.aborted) return;

      if (!jobId) {
        // No job to ask (a stub server): the terminal-event rule is all there is.
        settle(pending
          ? { ...pending, recordError: 'The cook stream ended before the build was recorded.' }
          : { status: 'failed', error: 'Cook stream ended without a result — the build may still be running.' });
        return;
      }
      const q = await tryApiFetch<{ job: CookJobInfo | null }>(`${COOK_JOBS_URL}?jobId=${encodeURIComponent(jobId)}`, { signal });
      if (signal.aborted) return;
      const job = q.ok ? q.data.job : null;
      if (!job) {
        const why = q.ok ? 'the server holds no job for it, so the cook is not running' : `the job could not be re-queried (${q.error})`;
        settle(pending
          ? { ...pending, recordError: `The cook stream ended before the build was recorded, and ${why}.` }
          : { status: 'failed', error: `Cook stream ended without a result, and ${why}.` });
        return;
      }
      if (job.settled && job.lastSeq <= lastSeq) {
        settle(pending
          ? { ...pending, recordError: 'The cook job settled without recording the build.' }
          : { status: 'failed', error: `The cook job ended without a cook result${job.outcome ? ` (${job.outcome})` : ''}.` });
        return;
      }
      quiet = lastSeq > before ? 0 : quiet + 1;
      if (quiet > MAX_QUIET_REATTACHES) {
        settle({ status: 'failed', error: `Lost the cook stream: ${quiet} reattaches delivered nothing. The server still reports job ${jobId}.` });
        return;
      }
      if (quiet > 0) await new Promise((r) => setTimeout(r, UI_TIMEOUTS.pofReconnectBase * quiet));
      if (signal.aborted) return;
      res = await fetch(attachUrl(jobId, lastSeq + 1), { signal });
    }
  } catch (err) {
    if (signal.aborted || settled) return;
    settle({ status: 'failed', error: err instanceof Error ? err.message : String(err) });
  }
}
