/**
 * Shared poll-until-ready helper for provider job orchestration (server-side).
 *
 * Extracted from three near-identical sequential poll loops (Leonardo image,
 * Leonardo 3D texture, Scenario texture). Each loop slept for a fixed interval,
 * fetched job status, silently skipped transient failures, returned on a terminal
 * "done" status, threw on a terminal "failed" status, and threw a timeout after a
 * fixed attempt count. Behavior is preserved exactly: callers supply their own
 * interval, attempt cap, and terminal predicates.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PollUntilReadyOptions<T> {
  /** Fetch + parse one status snapshot. Return `undefined` to skip this attempt (transient failure). */
  fetchStatus: () => Promise<T | undefined>;
  /** Terminal success: return the resolved value to stop polling and return it. Return `undefined` to keep polling. */
  isDone: (snapshot: T) => boolean;
  /** Terminal failure: throw to stop polling with an error. */
  isFailed: (snapshot: T) => boolean;
  /** Delay before each poll attempt (matches the original `await sleep(pollMs)` at the top of every iteration). */
  intervalMs: number;
  /** Maximum number of poll attempts before timing out. */
  maxAttempts: number;
  /** Build the error thrown when `isFailed` returns true. */
  onFailed: (snapshot: T) => Error;
  /** Build the error thrown when the attempt cap is exhausted. */
  onTimeout: () => Error;
}

/**
 * Poll a job to a terminal state. Each attempt sleeps `intervalMs` first, then
 * fetches a status snapshot; an `undefined` snapshot is treated as a transient
 * failure and silently skipped (the loop continues). When `isDone` is true the
 * snapshot is returned; when `isFailed` is true `onFailed` is thrown; if neither
 * fires within `maxAttempts`, `onTimeout` is thrown.
 */
export async function pollUntilReady<T>(opts: PollUntilReadyOptions<T>): Promise<T> {
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    await sleep(opts.intervalMs);
    const snapshot = await opts.fetchStatus();
    if (snapshot === undefined) continue; // transient failure → skip this attempt
    if (opts.isDone(snapshot)) return snapshot;
    if (opts.isFailed(snapshot)) throw opts.onFailed(snapshot);
  }
  throw opts.onTimeout();
}
