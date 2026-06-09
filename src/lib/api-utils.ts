import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/types/api';
import { ok, err, type Result } from '@/types/result';
import { logger } from '@/lib/logger';

// ---- Server-side helpers (used in route handlers) ----

/** Return a success envelope with the given data and optional status code. */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data } satisfies ApiResponse<T>, { status });
}

/** Return an error envelope with the given message, status code, and optional details. */
export function apiError(message: string, status = 500, details?: unknown) {
  const body: { success: false; error: string; details?: unknown } = { success: false, error: message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body satisfies ApiResponse<never>, { status });
}

/**
 * Convert a {@link Result} into the standard HTTP envelope: a success becomes
 * `apiSuccess(data, okStatus)`, a failure becomes `apiError(error, errorStatus)`.
 *
 * Centralizes the upstream-error status code (default `502`) that handlers
 * delegating to a service would otherwise copy-paste, so changing it is a
 * one-line edit. When a route shapes the success payload, transform the result
 * first with {@link mapResult} from `@/types/result`
 * (e.g. `respondFromResult(mapResult(result, (assets) => ({ assets })))`).
 *
 * @example
 *   const result = await getService().getSceneInfo();
 *   return respondFromResult(result);             // 200 ok / 502 err
 *   return respondFromResult(result, 201);        // 201 ok / 502 err
 */
export function respondFromResult<T>(
  result: Result<T, string>,
  okStatus = 200,
  errorStatus = 502,
) {
  return result.ok ? apiSuccess(result.data, okStatus) : apiError(result.error, errorStatus);
}

/**
 * Wrap a route handler so any thrown error becomes a logged `500` envelope.
 *
 * Standardizes the try/catch boilerplate every handler repeats: it runs the
 * handler, and on a throw logs via {@link logger} and returns
 * `apiError(error.message ?? fallbackMessage, 500)`. Handlers stay focused on
 * the happy path plus their own validation (`apiError(..., 400)` short-circuits
 * are returned, not thrown, so they pass straight through).
 *
 * @example
 *   export const GET = withRoute(async (request: NextRequest) => {
 *     // ...happy path...
 *     return apiSuccess(data);
 *   }, 'Failed to read features');
 */
export function withRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
  fallbackMessage: string,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error(`${fallbackMessage}:`, error);
      return apiError(error instanceof Error ? error.message : fallbackMessage, 500);
    }
  };
}

// ---- Client-side helper (used in hooks/components) ----

/** Fetch an API route and unwrap the standardized envelope. Throws on error responses. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** Non-throwing variant of apiFetch. Returns Result<T, string> instead of throwing. */
export async function tryApiFetch<T>(url: string, init?: RequestInit): Promise<Result<T, string>> {
  try {
    const res = await fetch(url, init);
    const json: ApiResponse<T> = await res.json();
    if (!json.success) return err(json.error);
    return ok(json.data);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Network error');
  }
}
