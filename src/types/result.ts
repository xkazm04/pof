/**
 * Result<T, E> — discriminated union for explicit success/failure contracts.
 *
 * Replaces the scattered error-state patterns across the codebase:
 *   - string error fields (scanError, error: string | null)
 *   - boolean success flags (lastTaskSuccess)
 *   - empty-array swallowing (catch { return []; })
 *   - graceful degradation chains (try/fallback/fallback)
 *
 * Usage:
 *   const result = await tryApiFetch<Data>(url);
 *   if (result.ok) {
 *     // result.data is Data
 *   } else {
 *     // result.error is string (or E)
 *   }
 */

// ─── Core type ───────────────────────────────────────────────────────────────

export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// ─── Constructors ────────────────────────────────────────────────────────────

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Transform the success value, leaving errors untouched. */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
  return result.ok ? ok(fn(result.data)) : result;
}

/** Provide a fallback value when the result is an error. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.data : fallback;
}

/** Unwrap the result, throwing if it's an error. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.data;
  throw new Error(typeof result.error === 'string' ? result.error : String(result.error));
}
