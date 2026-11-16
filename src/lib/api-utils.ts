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
 * Read a request body that must be a JSON object. The single authority for the house shape:
 * malformed JSON and a non-object value (`null`, an array, a scalar) are both the caller's
 * fault - 400, never a TypeError 500 thrown out of destructuring.
 *
 * @example
 *   const body = await readJsonObject(req);
 *   if (!body.ok) return body.error;
 *   const { name } = body.data;
 */
export async function readJsonObject(
  req: Request,
): Promise<Result<Record<string, unknown>, ReturnType<typeof apiError>>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return err(apiError('Invalid JSON body', 400));
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return err(apiError('Body must be a JSON object', 400));
  }
  return ok(parsed as Record<string, unknown>);
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

/**
 * Read a response as the envelope, or as a failure naming its HTTP status: an HTML
 * error page must not surface as a JSON parser message, and a body with no `error`
 * must not become an empty one.
 */
async function readEnvelope<T>(res: Response): Promise<Result<T, string>> {
  const unreadable = `Request failed (HTTP ${res.status})`;
  let json: ApiResponse<T> | null;
  try {
    json = await res.json();
  } catch {
    return err(unreadable);
  }
  if (json?.success) return ok(json.data);
  return err(json?.error || unreadable);
}

/** Fetch an API route and unwrap the standardized envelope. Throws on error responses. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const result = await readEnvelope<T>(await fetch(url, init));
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Non-throwing variant of apiFetch. Returns Result<T, string> instead of throwing. */
export async function tryApiFetch<T>(url: string, init?: RequestInit): Promise<Result<T, string>> {
  try {
    return await readEnvelope<T>(await fetch(url, init));
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Network error');
  }
}
