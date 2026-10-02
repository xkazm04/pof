/**
 * The outcome contract of a confirmed operation (see `ConfirmDialog`).
 *
 * A confirm dialog is idle until the user confirms, pending while the operation
 * runs, and then either closes (success) or stays open naming why it failed so
 * the SAME operation can be retried in place:
 *
 *   idle -> pending -> closed
 *                   -> failed(reason) -> pending -> ...
 *
 * What counts as failure: a thrown/rejected error, or a resolved
 * `Result` err (`{ ok: false, error }` from `@/types/result`). Anything else —
 * `undefined`, a value, `null` — is success: the dialog never reports a success
 * it did not get, and never invents a failure out of a value it cannot read.
 */

export type ConfirmPhase =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'failed'; reason: string };

export type ConfirmSettlement = { ok: true } | { ok: false; reason: string };

export const CONFIRM_IDLE: ConfirmPhase = { kind: 'idle' };
export const CONFIRM_PENDING: ConfirmPhase = { kind: 'pending' };

/** Shown when a failure carries no readable reason. */
export const UNKNOWN_FAILURE = 'The action failed without a reason.';

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
  );
}

/** A readable reason from whatever was thrown, rejected, or carried by a Result err. */
export function failureReason(cause: unknown): string {
  if (cause instanceof Error) return cause.message || UNKNOWN_FAILURE;
  if (typeof cause === 'string') return cause || UNKNOWN_FAILURE;
  if (cause == null) return UNKNOWN_FAILURE;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

function isResultErr(value: unknown): value is { ok: false; error: unknown } {
  return typeof value === 'object' && value !== null && 'ok' in value && (value as { ok: unknown }).ok === false;
}

/** Settle the value an operation returned or resolved with. */
export function settleValue(value: unknown): ConfirmSettlement {
  return isResultErr(value) ? { ok: false, reason: failureReason(value.error) } : { ok: true };
}

/** Settle an error an operation threw or rejected with. */
export function settleError(cause: unknown): ConfirmSettlement {
  return { ok: false, reason: failureReason(cause) };
}

/** The phase a settlement leaves the dialog in (success resets to idle as it closes). */
export function phaseAfter(settlement: ConfirmSettlement): ConfirmPhase {
  return settlement.ok ? CONFIRM_IDLE : { kind: 'failed', reason: settlement.reason };
}
