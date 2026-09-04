import { apiError } from '@/lib/api-utils';

/** Minimal shape this guard needs — satisfied by both NextRequest and the Web `Request`. */
type HeaderBearing = { headers: { get(name: string): string | null } };

/**
 * Guard for the privileged catalog→UE control plane: artifact writes and purges
 * (`/api/pipeline-artifacts`), drains (`/api/pipeline-artifacts/drain[/worker]`),
 * and lifecycle transitions (`/api/catalog`). These handlers write the
 * source-of-record SQLite and can spawn headless editors / drive a live UE
 * instance, so they must not be reachable by a drive-by cross-site request or an
 * exposed (non-loopback) deployment.
 *
 * Two layers, in order:
 *  1. Explicit operator token — if `POF_OPERATOR_TOKEN` is set, every call MUST
 *     present it as `Authorization: Bearer <token>` or `x-operator-token: <token>`.
 *     This is the required defence for any deployment reachable off-loopback.
 *  2. CSRF / same-origin — when no token is configured (the local-dev default),
 *     reject any request whose `Origin` is cross-site (the classic browser CSRF
 *     vector). Same-origin browser calls and server-to-server callbacks (which
 *     carry no `Origin` header, e.g. the @@CALLBACK POST from cli-task) are
 *     allowed, so the app and the generation flow keep working untouched.
 *
 * WHY LAYER 2 IS NOT ENOUGH ON ITS OWN, and why layer 1 is the real defence:
 * the same-origin check compares `Origin` against the `Host` header, which is
 * honest only because a *browser* sets both. A non-browser client sets whatever
 * it likes, and a header-less request is deliberately allowed through. Layer 2
 * therefore stops the cross-site-browser vector and nothing else; anything
 * reachable beyond loopback needs `POF_OPERATOR_TOKEN`.
 *
 * Read handlers (`GET`) are intentionally NOT guarded — they neither mutate the
 * database nor start a process.
 *
 * Usage:
 *   const denied = requireOperator(req);
 *   if (denied) return denied;
 */
export function requireOperator(req: HeaderBearing): ReturnType<typeof apiError> | null {
  const token = process.env.POF_OPERATOR_TOKEN;
  if (token) {
    const presented = readBearer(req) ?? req.headers.get('x-operator-token');
    if (presented !== token) {
      return apiError('Unauthorized: a valid operator token is required for this endpoint', 401);
    }
    return null;
  }

  // No token configured → local-dev mode. Block only cross-site browser requests;
  // allow same-origin and header-less server-to-server calls.
  const origin = req.headers.get('origin');
  if (origin && !isSameOrigin(origin, req)) {
    return apiError('Forbidden: cross-origin request to a privileged endpoint', 403);
  }
  return null;
}

function readBearer(req: HeaderBearing): string | null {
  const h = req.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

function isSameOrigin(origin: string, req: HeaderBearing): boolean {
  const host = req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
