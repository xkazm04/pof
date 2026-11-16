/**
 * Single-flight read-back: one Whisper process at a time in this server process (each spawn loads a model,
 * ~17 s, and three quick generates must not be three concurrent loads). Later requests queue behind the running
 * one; their takes stay `pending` until their turn. A module-level promise chain, no dependency.
 */
import type Database from 'better-sqlite3';
import { logger } from '@/lib/logger';
import { readbackTakes, transcribeLocal, type Transcribe } from '@/lib/voice/readback';
import { shortReason } from '@/lib/voice/readbackState';
import { listTakes, setReadbackStatus } from '@/lib/voice/voice-db';
import type { Result } from '@/types/result';

let tail: Promise<unknown> = Promise.resolve();
const queued = new Set<string>();
const ORPHAN_AGE_MS = 5 * 60_000;

/** Run `fn` after every earlier call has settled (a rejection of one never blocks the next). */
export function singleFlight<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn);
  tail = run.then(() => undefined, () => undefined);
  return run;
}

type Outcome = Result<{ measured: number; failed: string[] }, string>;

/** Read `ids` back in this process's queue and wait for the result. Never rejects: a throw is recorded `failed`. */
export function readbackQueued(db: Database.Database, ids: readonly string[], transcribe: Transcribe = transcribeLocal): Promise<Outcome> {
  try {
    for (const id of ids) { queued.add(id); setReadbackStatus(db, id, 'pending'); }
  } catch (e) {
    for (const id of ids) queued.delete(id);
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(`[voice] read-back could not be queued: ${msg}`);
    return Promise.resolve({ ok: false, error: msg });
  }
  return singleFlight(async (): Promise<Outcome> => {
    try {
      return await readbackTakes(db, ids, transcribe);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn(`[voice] read-back crashed: ${msg}`);
      for (const id of ids) setReadbackStatus(db, id, 'failed', shortReason(`read-back crashed: ${msg}`));
      return { ok: false, error: msg };
    } finally {
      for (const id of ids) queued.delete(id);
    }
  });
}

/** Fire and forget for the takes route: handles its own failure, so the caller can `void` it safely. */
export function readbackInBackground(db: Database.Database, ids: readonly string[], transcribe?: Transcribe): void {
  readbackQueued(db, ids, transcribe).catch((e) => logger.warn(`[voice] read-back queue error: ${String(e)}`));
}

/** Takes left `pending` by a process that no longer runs them (a restart mid-queue) can never resolve: mark them
 *  `failed`. Returns how many. Takes this process has queued, and takes younger than 5 minutes, are untouched. */
export function reapOrphanedPending(db: Database.Database, gameId: string, now = Date.now(), minAgeMs = ORPHAN_AGE_MS): number {
  let n = 0;
  for (const t of listTakes(db, gameId)) {
    // A take younger than `minAgeMs` may be a sibling request's, inserted and not yet queued: leave it.
    if (t.readbackStatus !== 'pending' || queued.has(t.id) || now - t.createdAt < minAgeMs) continue;
    setReadbackStatus(db, t.id, 'failed', 'read-back did not run (the server restarted or it was never queued)');
    n++;
  }
  return n;
}
