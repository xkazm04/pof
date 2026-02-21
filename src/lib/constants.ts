/**
 * Shared constants — single source of truth for values duplicated across the codebase.
 *
 * Re-exports MODULE_COLORS from chart-colors.ts for accent color access.
 */

export { MODULE_COLORS } from './chart-colors';

/** Safe window.location.origin accessor for SSR / client contexts. */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  // Server-side: derive from env or default to localhost on the configured port
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Derive the app origin from an incoming request's Host header.
 * Use this in API route handlers where the request is available.
 */
export function getOriginFromRequest(request: { headers: { get(name: string): string | null } }): string {
  const host = request.headers.get('host');
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    return `${proto}://${host}`;
  }
  return getAppOrigin();
}

/** Standardized UI timing constants (ms). */
export const UI_TIMEOUTS = {
  /** Duration to show "Copied!" feedback before resetting. */
  copyFeedback: 1500,
  /** Toast / snackbar auto-dismiss duration. */
  toast: 3000,
  /** Microtask buffer to let synchronous store writes settle. */
  raceConditionBuffer: 50,
  /** Delay for terminal component to mount before dispatching events. */
  mountDelay: 100,
  /** Flash duration after a checklist item completes. */
  completionFlash: 2000,
  /** Delay between batch-queued checklist items. */
  batchItemDelay: 800,
  /** Watchdog interval: recover stuck batch state. */
  batchWatchdog: 3000,
  /** Polling interval for CLI-driven checklist completions. */
  pollInterval: 3000,
  /** Short settle time for DB writes before UI refresh. */
  dbSettle: 300,
  /** Heartbeat interval for long-running tasks. */
  heartbeatInterval: 2 * 60 * 1000,
  /** Interval to check for stuck/stale tasks. */
  stuckCheckInterval: 30 * 1000,
  /** Delay before starting the next queued task. */
  nextTaskDelay: 3000,
  /** Auto-submit delay after programmatic input fill. */
  autoSubmitDelay: 50,
  /** UE5 Remote Control health check interval. */
  ue5HealthCheck: 30_000,
  /** Base delay for UE5 reconnection attempts. */
  ue5ReconnectBase: 2_000,
  /** Maximum delay between reconnection attempts. */
  ue5ReconnectMax: 30_000,
  /** Timeout for individual UE5 HTTP requests. */
  ue5HttpTimeout: 10_000,
  /** Poll interval while a build is active. */
  buildPollInterval: 3_000,
  /** Maximum time for a headless build process (10 min). */
  buildProcessTimeout: 600_000,
} as const;
