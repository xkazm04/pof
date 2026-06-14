/**
 * Connection lifecycle helper — the transport-AGNOSTIC half of a bridge
 * connection manager.
 *
 * `pof-bridge/connection-manager.ts` and `ue5-bridge/connection-manager.ts`
 * each hand-rolled the SAME lifecycle machinery: a periodic health-check loop
 * with a 3-consecutive-failure threshold, an exponential-backoff reconnect
 * state machine (`delay = min(base * 2^attempt, max)`), and timer cleanup.
 * They differ only in transport (PoF `client.getStatus()` fetch vs UE5
 * `client.ping()` — and which run client- vs server-side), event names, and
 * the shape of the "info" payload they carry.
 *
 * This module owns the lifecycle; each manager provides transport-specific
 * callbacks (probe / onConnected / onHealthInfo / …). The state container
 * (`createStateEmitter`) stays in the manager — this helper never touches the
 * emitter directly, only the callbacks the manager hands in. That keeps the
 * "is it connected" mental model identical to before; only the duplicated
 * scheduling/backoff code is centralized.
 *
 * Behavior is preserved EXACTLY, including the per-manager difference in
 * whether the health-check failure path reseeds `reconnectAttempts` to 0
 * (UE5 does — a prior fix; PoF historically does not). That divergence is a
 * caller-supplied flag, NOT a behavior change.
 */

import { logger } from '@/lib/logger';

/** Outcome of a single transport probe — mirrors the client `Result<T>` shape. */
export type ProbeResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ConnectionLifecycleOptions<T> {
  /** Log prefix, e.g. `'[PoF-CM]'`. */
  label: string;
  /** Health-check interval (ms). */
  healthCheckMs: number;
  /** Base reconnect delay (ms) — the `min(base * 2^attempt, max)` base. */
  backoffBase: number;
  /** Maximum reconnect delay (ms). */
  backoffMax: number;
  /**
   * Whether the health-check failure path reseeds the reconnect attempt counter
   * to 0 for the fresh disconnect episode. UE5 = true (prior fix); PoF = false.
   */
  resetAttemptsOnHealthFailure: boolean;

  /** Transport probe — `client.getStatus()` (PoF) or `client.ping()` (UE5). */
  probe: () => Promise<ProbeResult<T>>;
  /** True while a client exists; false after `disconnect()` clears it. */
  hasClient: () => boolean;
  /** Read the manager's live `status` (so the interval can early-return when not connected). */
  getStatus: () => string;
  /** Read the manager's live `reconnectAttempts` for the backoff exponent. */
  getReconnectAttempts: () => number;

  /** A health-check probe succeeded — let the manager update its carried info if it changed. */
  onHealthInfo: (data: T) => void;
  /** A (re)connect probe succeeded — let the manager flip to `connected` + emit. */
  onConnected: (data: T) => void;
  /**
   * 3 consecutive health checks failed — the manager should flip to
   * `disconnected` (+ emit). `resetAttempts` reflects
   * `resetAttemptsOnHealthFailure` so the manager can include
   * `reconnectAttempts: 0` when set.
   */
  onDisconnectedForReconnect: (resetAttempts: boolean) => void;
  /** About to schedule a reconnect — flip to `reconnecting` with the next attempt index. */
  onReconnecting: (nextAttempt: number) => void;
}

export interface ConnectionLifecycle {
  /** Begin the periodic health-check loop (call after a successful connect). */
  startHealthCheck(): void;
  /** Schedule the next reconnect attempt using exponential backoff. */
  scheduleReconnect(): void;
  /** Clear any pending health-check interval and reconnect timer. */
  clearTimers(): void;
  /** Reset the consecutive-failure counter (e.g. at the start of `connect`/`disconnect`). */
  resetFailures(): void;
}

/** Number of consecutive failed health checks before reconnecting. */
const HEALTH_FAILURE_THRESHOLD = 3;

export function createConnectionLifecycle<T>(
  options: ConnectionLifecycleOptions<T>,
): ConnectionLifecycle {
  const {
    label,
    healthCheckMs,
    backoffBase,
    backoffMax,
    resetAttemptsOnHealthFailure,
    probe,
    hasClient,
    getStatus,
    getReconnectAttempts,
    onHealthInfo,
    onConnected,
    onDisconnectedForReconnect,
    onReconnecting,
  } = options;

  let healthInterval: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;

  function clearTimers(): void {
    if (healthInterval) {
      clearInterval(healthInterval);
      healthInterval = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function resetFailures(): void {
    consecutiveFailures = 0;
  }

  function startHealthCheck(): void {
    healthInterval = setInterval(async () => {
      if (!hasClient() || getStatus() !== 'connected') return;

      const result = await probe();

      if (result.ok) {
        consecutiveFailures = 0;
        onHealthInfo(result.data);
        return;
      }

      consecutiveFailures++;
      logger.warn(
        `${label} Health check failed`,
        `(${consecutiveFailures}/${HEALTH_FAILURE_THRESHOLD}):`,
        result.error,
      );

      if (consecutiveFailures >= HEALTH_FAILURE_THRESHOLD) {
        logger.warn(
          `${label} ${HEALTH_FAILURE_THRESHOLD} consecutive health check failures, starting reconnect`,
        );
        clearTimers();
        onDisconnectedForReconnect(resetAttemptsOnHealthFailure);
        scheduleReconnect();
      }
    }, healthCheckMs);
  }

  function scheduleReconnect(): void {
    if (!hasClient()) return;

    const attempt = getReconnectAttempts();
    const delay = Math.min(backoffBase * Math.pow(2, attempt), backoffMax);

    onReconnecting(attempt + 1);
    logger.info(`${label} Reconnect attempt`, attempt + 1, `in ${delay}ms`);

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;

      if (!hasClient()) return;

      const result = await probe();

      if (result.ok) {
        consecutiveFailures = 0;
        onConnected(result.data);
        startHealthCheck();
      } else {
        scheduleReconnect();
      }
    }, delay);
  }

  return { startHealthCheck, scheduleReconnect, clearTimers, resetFailures };
}
