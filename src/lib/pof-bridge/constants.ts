/**
 * Shared connection constants for the PoF Bridge UE5 companion plugin.
 *
 * Single source of truth for the bridge host + default port. Consumed by the
 * `/api/pof-bridge/*` proxy routes (via {@link proxyToPofBridge}) and the
 * client store's initial port. Change the host/port here, not in each route.
 */
export const POF_BRIDGE = {
  /** Loopback host the bridge HTTP server binds to. */
  HOST: '127.0.0.1',
  /** Default HTTP port the PillarsOfFortuneBridge plugin listens on. */
  DEFAULT_PORT: 30040,
} as const;

/** Resolve the `?port=` override from a request's search params, falling back to the default. */
export function resolvePofPort(searchParams: URLSearchParams): number {
  return parseInt(searchParams.get('port') || String(POF_BRIDGE.DEFAULT_PORT), 10);
}
