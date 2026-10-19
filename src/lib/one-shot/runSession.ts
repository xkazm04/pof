/**
 * One cancellation vocabulary for the one-shot job. A run session mints, per run, an epoch and an
 * AbortController; everything that awaits on behalf of a run asks `isLive()` afterwards and
 * discards its result when the run was cancelled or superseded. A cancel therefore targets a run
 * IDENTITY (the epoch), never a kind: a later run cannot revive an earlier, suspended one the way a
 * shared boolean flag could.
 */
export interface Run {
  readonly epoch: number;
  readonly kind: string;
  readonly signal: AbortSignal;
  /** True until this run is cancelled, superseded by `begin`, or ended. */
  isLive(): boolean;
  /** Release the session if this run still holds it (idempotent; never touches a newer run). */
  end(): void;
}

export interface RunSession {
  /** Start a run, superseding (aborting) any live one. */
  begin(kind: string): Run;
  /** Start a run only when none is live; null = a run already holds the session. Synchronous. */
  claim(kind: string): Run | null;
  /** Abort the live run, if any; false = none was live. */
  cancel(): boolean;
  /** The live run, or null. */
  active(): Run | null;
}

type Held = Run & { controller: AbortController };

export function createRunSession(): RunSession {
  let epoch = 0;
  let current: Held | null = null;

  function start(kind: string): Run {
    if (current) current.controller.abort();
    const controller = new AbortController();
    const run: Held = {
      epoch: ++epoch,
      kind,
      signal: controller.signal,
      controller,
      isLive: () => current === run && !controller.signal.aborted,
      end: () => { if (current === run) current = null; },
    };
    current = run;
    return run;
  }

  return {
    begin: start,
    claim: (kind) => (current && current.isLive() ? null : start(kind)),
    cancel() {
      if (!current) return false;
      current.controller.abort();
      current = null;
      epoch++;
      return true;
    },
    active: () => (current && current.isLive() ? current : null),
  };
}
