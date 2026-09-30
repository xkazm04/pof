/**
 * Server-side settlement of a terminal run's declared `@@CALLBACK`s.
 *
 * The terminal declares the run's callback descriptors with the query POST (it holds
 * the registry that built the prompt); the execution that owns the run settles them
 * here when the run ends — once per callback id, whether or not any tab is still
 * watching. The browser only reads the verdict (`callbacks` SSE frame / GET status).
 *
 * The server is never a relay for client-supplied URLs: a descriptor is POSTed only
 * to its `/api/…` path resolved against the app's OWN origin. A descriptor naming
 * another host, or a path outside `/api/`, is `failed` and never fetched.
 *
 * Server-only. The client registry (`cli-task.ts`) keeps each entry, so a failed
 * payload stays re-POSTable by the host's Resubmit.
 */

import {
  parseAllCallbackMarkers,
  mergeCallbackBody,
  postCallbackBody,
  type TaskCallback,
  type CallbackStatus,
  type CallbackPostResult,
} from '@/lib/cli-task';
import { UI_TIMEOUTS } from '@/lib/constants';

/** One outbound callback request (already merged and own-origin resolved). */
export type CallbackPost = (req: {
  url: string;
  method: TaskCallback['method'];
  body: Record<string, unknown>;
}) => Promise<CallbackPostResult>;

/** A declared marker whose POST did not land — re-POSTable by the host. */
export interface FailedCallback {
  callbackId: string;
  payload: string;
  error: string;
}

export interface RunCallbackSettlement {
  /** `null` when the run declared no callbacks (interactive / one-shot / batch runs). */
  status: CallbackStatus | null;
  failed: FailedCallback[];
}

/** Upper bound on descriptors one run may declare (a prompt carries one or a few). */
const MAX_DECLARED_CALLBACKS = 32;

/**
 * Resolve a descriptor url to `<appOrigin><path><query>` when it is an `/api/` path
 * on the app's own origin (absolute with the same origin, or relative); else null.
 * Dot segments are normalised by the URL parser first, so `/api/../x` is rejected.
 */
export function resolveOwnApiUrl(url: string, appOrigin: string): string | null {
  let origin: URL;
  let target: URL;
  try {
    origin = new URL(appOrigin);
    target = new URL(url, origin);
  } catch {
    return null;
  }
  if (target.origin !== origin.origin) return null;
  if (!target.pathname.startsWith('/api/')) return null;
  return `${origin.origin}${target.pathname}${target.search}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Keep only well-formed descriptors from an untrusted request body (never throws). */
export function sanitizeCallbackDescriptors(raw: unknown): TaskCallback[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskCallback[] = [];
  for (const c of raw.slice(0, MAX_DECLARED_CALLBACKS)) {
    if (!isPlainObject(c)) continue;
    const { id, url, method, staticFields, schemaHint } = c;
    if (typeof id !== 'string' || !id || typeof url !== 'string' || !url) continue;
    if (method !== 'POST' && method !== 'PATCH') continue;
    if (!isPlainObject(staticFields)) continue;
    out.push({ id, url, method, staticFields, schemaHint: typeof schemaHint === 'string' ? schemaHint : '' });
  }
  return out;
}

/** Default transport: one fetch, bounded so a hung endpoint cannot hold the settlement. */
const defaultPost: CallbackPost = (req) =>
  postCallbackBody(req, AbortSignal.timeout(UI_TIMEOUTS.callbackSettleMax));

/**
 * Settle every declared callback marker in a run's text exactly once.
 * - no callbacks declared → `{ status: null }`, nothing POSTed;
 * - declared but no declared marker emitted → `missing`;
 * - every emitted declared marker POSTed with success → `confirmed`, else `failed`.
 * Markers whose id was not declared are ignored; a repeated id POSTs once.
 */
export async function settleRunCallbacks(input: {
  text: string;
  callbacks: TaskCallback[];
  appOrigin: string;
  post?: CallbackPost;
}): Promise<RunCallbackSettlement> {
  const { text, callbacks, appOrigin, post = defaultPost } = input;
  if (callbacks.length === 0) return { status: null, failed: [] };

  const declared = new Map(callbacks.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const markers = parseAllCallbackMarkers(text).filter((m) => {
    if (!declared.has(m.callbackId) || seen.has(m.callbackId)) return false;
    seen.add(m.callbackId);
    return true;
  });
  if (markers.length === 0) return { status: 'missing', failed: [] };

  const outcomes = await Promise.all(markers.map(async (m): Promise<FailedCallback | null> => {
    const cb = declared.get(m.callbackId)!;
    const fail = (error: string): FailedCallback => ({ callbackId: m.callbackId, payload: m.payload, error });
    const url = resolveOwnApiUrl(cb.url, appOrigin);
    if (!url) return fail(`callback url is not an /api/ path on this app's origin: ${cb.url}`);
    const merged = mergeCallbackBody(cb.staticFields, m.payload);
    if (!merged.ok) return fail(merged.error);
    try {
      const res = await post({ url, method: cb.method, body: merged.body });
      return res.success ? null : fail(res.error ?? 'API returned failure');
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Network error');
    }
  }));

  const failed = outcomes.filter((f): f is FailedCallback => f !== null);
  return { status: failed.length > 0 ? 'failed' : 'confirmed', failed };
}
