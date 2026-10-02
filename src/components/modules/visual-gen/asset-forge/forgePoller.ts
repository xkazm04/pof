import type { Result } from '@/types/result';

/**
 * The forge's ONE background poll rail. Every minutes-long forge job — a runner generation,
 * a Blender-MCP generation, a $0 mesh finish, a UE import — polls its status through
 * `startTrackedPoll`, so the skeleton exists once: a self-scheduling `setTimeout` recursion
 * (never a `setInterval`; the next tick is scheduled only after the current body settles, so
 * polls cannot overlap), a wall-clock deadline, a cap on CONSECUTIVE transport misses, and
 * registration in the tracked set the store mirrors into `activePolls`.
 *
 * DELIBERATE LIFETIME: a poll is started by a store action, not a React effect, so neither
 * `SuspendContext` nor a tab/module unmount reaches it — the job is already running (and
 * often already paid for) server-side. It ENDS on: a terminal payload, `maxMisses` misses in
 * a row, the deadline, or an explicit stop (`stopTracked` / the returned handle). A stop wins
 * over a late response: nothing the in-flight fetch returns after it is acted on.
 *
 * Callers supply only the classifier: what a payload means (`isTerminal`), what to do with a
 * progress payload (`onTick`), with a terminal one (`onTerminal`), and with a give-up. The
 * poll is stopped and untracked BEFORE `onTerminal` / `onGiveUp` run.
 */

/** Why a poll gave up, with the rail's own sentence (callers may extend it). */
export type PollGiveUp =
  | { reason: 'misses'; misses: number; lastError: string; message: string }
  | { reason: 'deadline'; minutes: number; message: string };

export interface TrackedPollSpec<T> {
  /** The tracked id — a queue card's id, or a namespaced one (`ue-import:<jobId>`). */
  id: string;
  fetchStatus: () => Promise<Result<T, string>>;
  isTerminal: (data: T) => boolean;
  /** A non-terminal payload (progress). */
  onTick?: (data: T) => void;
  /** The terminal payload — runs once, after the poll is untracked. */
  onTerminal: (data: T) => void | Promise<void>;
  onGiveUp: (giveUp: PollGiveUp) => void;
  deadlineMs: number;
  /** Consecutive transport misses tolerated before giving up (default 3). */
  maxMisses?: number;
  intervalMs: number;
}

export interface TrackedPoll {
  stop: () => void;
}

/** Default cap on consecutive transport misses — one blip never ends a paid job. */
export const MAX_CONSECUTIVE_POLL_FAILURES = 3;

const tracked = new Map<string, TrackedPoll>();
type TrackedListener = (id: string, isTrackedNow: boolean) => void;
const listeners = new Set<TrackedListener>();

/** Subscribe to tracked-set changes (the store mirrors them into `activePolls`). */
export function onTrackedChange(listener: TrackedListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(id: string, isTrackedNow: boolean): void {
  for (const l of listeners) l(id, isTrackedNow);
}

function untrack(id: string): void {
  tracked.delete(id);
  notify(id, false);
}

export function isTracked(id: string): boolean {
  return tracked.has(id);
}

/** Stop and untrack one poll. Returns false when nothing was tracking `id`. */
export function stopTracked(id: string): boolean {
  const poll = tracked.get(id);
  if (!poll) return false;
  poll.stop();
  return true;
}

export function startTrackedPoll<T>(spec: TrackedPollSpec<T>): TrackedPoll {
  const maxMisses = spec.maxMisses ?? MAX_CONSECUTIVE_POLL_FAILURES;
  const startedAt = Date.now();
  let misses = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const handle: TrackedPoll = {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      // Only untrack the registration that is ours — a newer poll may hold the id.
      if (tracked.get(spec.id) === handle) untrack(spec.id);
    },
  };
  const scheduleNext = () => { if (!stopped) timer = setTimeout(() => void tick(), spec.intervalMs); };

  async function tick() {
    timer = null;
    if (stopped) return;
    if (Date.now() - startedAt >= spec.deadlineMs) {
      handle.stop();
      const minutes = Math.round(spec.deadlineMs / 60_000);
      spec.onGiveUp({ reason: 'deadline', minutes, message: `Gave up tracking after ${minutes} min` });
      return;
    }
    let res: Result<T, string>;
    try {
      res = await spec.fetchStatus();
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (stopped) return;
    if (!res.ok) {
      misses++;
      if (misses < maxMisses) { scheduleNext(); return; }
      handle.stop();
      spec.onGiveUp({
        reason: 'misses',
        misses,
        lastError: res.error,
        message: `Status polling failed ${misses} times in a row: ${res.error}`,
      });
      return;
    }
    misses = 0;
    if (spec.isTerminal(res.data)) {
      handle.stop();
      await spec.onTerminal(res.data);
      return;
    }
    spec.onTick?.(res.data);
    scheduleNext();
  }

  tracked.get(spec.id)?.stop();
  tracked.set(spec.id, handle);
  notify(spec.id, true);
  scheduleNext();
  return handle;
}
