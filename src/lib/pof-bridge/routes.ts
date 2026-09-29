/**
 * The PoF Bridge plugin's HTTP/WS routes — declared ONCE.
 *
 * Every consumer of the plugin (PofBridgeClient, the `/api/pof-bridge/*` proxy
 * handlers, run-python.ts, the Bridge Endpoints monitor) addresses a route that
 * must appear here; `src/__tests__/lib/pof-bridge/routes.test.ts` is the drift
 * guard that fails when a new route lands in one copy only.
 *
 * Each route declares its `effect`, and {@link planRouteProbe} derives from it —
 * purely — whether a health check may touch the route at all. A probe must be
 * side-effect-free by construction: a route that mutates the editor (Live
 * Coding, HighResShot capture, automation runs, Python dispatch) is never
 * "pinged", because a POST of `{}` to it IS the real request.
 */

export type PofRouteMethod = 'GET' | 'POST' | 'WS';

/** What calling the route does to the editor. */
export type PofRouteEffect = 'read' | 'mutates' | 'ws';

export type PofSubsystemId =
  | 'status' | 'manifest' | 'testing' | 'snapshots' | 'compile' | 'python' | 'live-state';

export interface PofRoute {
  subsystem: PofSubsystemId;
  method: PofRouteMethod;
  /** Plugin path, without query string or per-call segments (e.g. `/{testId}`). */
  path: string;
  effect: PofRouteEffect;
  description: string;
  /** Cheaper read-only form a health probe should use instead of `path`. */
  probePath?: string;
  /** Query argument the route cannot answer without (so it cannot be probed blind). */
  requiresArgument?: string;
}

export const POF_ROUTES: readonly PofRoute[] = [
  { subsystem: 'status', method: 'GET', path: '/pof/status', effect: 'read', description: 'Plugin version, engine info, editor state' },

  { subsystem: 'manifest', method: 'GET', path: '/pof/manifest', effect: 'read', description: 'Full asset manifest (or ?checksum-only=true)', probePath: '/pof/manifest?checksum-only=true' },
  { subsystem: 'manifest', method: 'GET', path: '/pof/manifest/blueprint', effect: 'read', description: 'Single blueprint by ?path=', requiresArgument: 'path' },

  { subsystem: 'testing', method: 'POST', path: '/pof/test/run', effect: 'mutates', description: 'Submit test spec for execution' },
  { subsystem: 'testing', method: 'GET', path: '/pof/test/results', effect: 'read', description: 'All test results (or /{testId})' },
  { subsystem: 'testing', method: 'POST', path: '/pof/test/run-automation', effect: 'mutates', description: 'Run UE5 automation tests' },

  { subsystem: 'snapshots', method: 'POST', path: '/pof/snapshot/capture', effect: 'mutates', description: 'Capture snapshot presets (HighResShot)' },
  { subsystem: 'snapshots', method: 'POST', path: '/pof/snapshot/baseline', effect: 'mutates', description: 'Save baseline snapshots' },
  { subsystem: 'snapshots', method: 'GET', path: '/pof/snapshot/diff', effect: 'read', description: 'Get snapshot diff report' },

  { subsystem: 'compile', method: 'POST', path: '/pof/compile/live', effect: 'mutates', description: 'Trigger live coding hot-reload' },
  { subsystem: 'compile', method: 'GET', path: '/pof/compile/status', effect: 'read', description: 'Poll current compile status' },
  { subsystem: 'compile', method: 'POST', path: '/pof/compile/hot-patch', effect: 'mutates', description: 'Write + compile + verify + auto-revert' },
  { subsystem: 'compile', method: 'GET', path: '/pof/compile/hot-patch/status', effect: 'read', description: 'Poll hot-patch pipeline status' },

  { subsystem: 'python', method: 'POST', path: '/pof/python/run', effect: 'mutates', description: 'Dispatch module.function(args) on the editor thread' },

  { subsystem: 'live-state', method: 'WS', path: '/pof/live', effect: 'ws', description: 'WebSocket endpoint for bidirectional live state sync (wsPort)' },
];

export type NotProbedReason = 'mutates' | 'needs-argument';

export type RouteProbePlan =
  | { kind: 'http-get'; path: string }
  | { kind: 'ws' }
  | { kind: 'not-probed'; reason: NotProbedReason };

/** How a side-effect-free health check may touch `route` (pure). */
export function planRouteProbe(route: PofRoute): RouteProbePlan {
  if (route.effect === 'mutates') return { kind: 'not-probed', reason: 'mutates' };
  if (route.effect === 'ws') return { kind: 'ws' };
  if (route.requiresArgument) return { kind: 'not-probed', reason: 'needs-argument' };
  return { kind: 'http-get', path: route.probePath ?? route.path };
}
