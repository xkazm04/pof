/**
 * UE5 Remote Control Connection Manager (singleton)
 *
 * Manages the lifecycle of the UE5 connection:
 *   - connect / disconnect
 *   - periodic health checks with automatic reconnection
 *   - subscriber-based state change notifications
 *   - eventBus integration for cross-module awareness
 *
 * The transport-agnostic lifecycle (health-check loop, exponential-backoff
 * reconnect, timer cleanup) lives in `@/lib/connection-lifecycle`; this manager
 * supplies the UE5-specific transport (`client.ping()`) and event wiring.
 *
 * ── OWNERSHIP: this singleton is SERVER-OWNED, deliberately ────────────────
 *
 * The Remote Control socket lives in the Node server process, NOT the browser,
 * because server-only routes call the plugin directly with no user present:
 * `/api/ue5-inject-item` (inject a crafted item into PIE) and
 * `/api/ue5-bridge/query` (property/function/asset access).
 *
 * A `import { ue5Connection }` from client code does NOT reach that object —
 * Next.js gives the browser bundle its OWN module instance, whose `client` is
 * null forever and whose state is a frozen `disconnected`. That split is real
 * and is the reason the console used to claim "UE5 not connected" no matter
 * what the server was doing. Browser code must therefore go over the wire:
 *
 *   state  ← GET  /api/ue5-bridge/status   (SSE — every state change)
 *   verbs  → POST /api/ue5-bridge/query    (connect / disconnect / …)
 *
 * `useUE5Connection` is the single client-side consumer of both. `getClient()`
 * warns loudly (once) if it is ever called from a browser bundle rather than
 * quietly handing back the null of a phantom instance.
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { createStateEmitter } from '@/lib/state-emitter';
import { createConnectionLifecycle } from '@/lib/connection-lifecycle';
import { RemoteControlClient } from './remote-control-client';
import type {
  UE5ConnectionState,
  UE5ConnectionStatus,
  UE5RemoteControlInfo,
} from '@/types/ue5-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

type StateChangeHandler = (state: UE5ConnectionState) => void;

// ── Connection Manager ──────────────────────────────────────────────────────

class UE5ConnectionManager {
  private client: RemoteControlClient | null = null;

  private emitter = createStateEmitter<UE5ConnectionState>({
    label: '[UE5-CM]',
    initial: {
      status: 'disconnected',
      info: null,
      error: null,
      lastConnected: null,
      reconnectAttempts: 0,
    },
  });

  private lifecycle = createConnectionLifecycle<UE5RemoteControlInfo>({
    label: '[UE5-CM]',
    healthCheckMs: UI_TIMEOUTS.ue5HealthCheck,
    backoffBase: UI_TIMEOUTS.ue5ReconnectBase,
    backoffMax: UI_TIMEOUTS.ue5ReconnectMax,
    // Reset the backoff counter for this fresh disconnect episode: a connection
    // that was healthy (possibly for a long time) may still carry a stale,
    // non-zero reconnectAttempts from a prior reconnect storm. Seeding it to 0
    // ensures the first reconnect uses the initial backoff; scheduleReconnect
    // still escalates the delay across consecutive failed reconnect attempts.
    resetAttemptsOnHealthFailure: true,
    probe: () => this.client!.ping(),
    hasClient: () => this.client !== null,
    getStatus: () => this.state.status,
    getReconnectAttempts: () => this.state.reconnectAttempts,
    onHealthInfo: (data) => {
      // Update info in case it changed (e.g. level change updates serverName)
      if (
        data.version !== this.state.info?.version ||
        data.serverName !== this.state.info?.serverName
      ) {
        this.setState({ info: data });
      }
    },
    onConnected: (data) => {
      this.setStatus('connected', {
        info: data,
        error: null,
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
      });
      eventBus.emit('ue5.connected', { version: data.version }, 'ue5-connection');
      logger.info('[UE5-CM] Reconnected to UE5', data.version);
    },
    onDisconnectedForReconnect: () => {
      this.setStatus('disconnected', { error: 'Health check failed', reconnectAttempts: 0 });
      eventBus.emit('ue5.disconnected', { reason: 'health-check-timeout' }, 'ue5-connection');
    },
    onReconnecting: (nextAttempt) => {
      this.setStatus('reconnecting', { reconnectAttempts: nextAttempt });
    },
  });

  /** Live, read-only view of state for the manager's own internal checks. */
  private get state(): UE5ConnectionState {
    return this.emitter.peek();
  }

  // ── State management ────────────────────────────────────────────────────

  getState(): UE5ConnectionState {
    return this.emitter.getState();
  }

  /**
   * The live Remote Control client, or null when not connected.
   *
   * SERVER-ONLY (see the ownership note at the top of this file). Called from a
   * browser bundle this is a phantom instance that can never hold a client, so
   * we say so once instead of returning a null that reads as "UE5 is down".
   */
  getClient(): RemoteControlClient | null {
    if (!this.assertServerOwned('getClient')) return null;
    return this.client;
  }

  /** One-shot latch so a render loop can't spam the browser-misuse warning. */
  private warnedBrowserUse = false;

  /**
   * Returns true on the server-owned instance. On a browser instance it warns
   * once and returns false — the deliberate client/server split, made loud.
   */
  private assertServerOwned(caller: string): boolean {
    if (typeof window === 'undefined') return true;
    if (!this.warnedBrowserUse) {
      this.warnedBrowserUse = true;
      logger.warn(
        '[UE5-CM]',
        `${caller}() was called from the browser bundle. This is a separate,`,
        'never-connected instance — the real UE5 Remote Control connection lives in the',
        'Node server. Use useUE5Connection() / the /api/ue5-bridge routes instead.',
      );
    }
    return false;
  }

  private setState(partial: Partial<UE5ConnectionState>) {
    this.emitter.setState(partial);
  }

  private setStatus(status: UE5ConnectionStatus, extras?: Partial<UE5ConnectionState>) {
    this.setState({ status, ...extras });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onStateChange(handler: StateChangeHandler): () => void {
    return this.emitter.subscribe(handler);
  }

  /** Connect to UE5 Remote Control at the given host and port. */
  async connect(host: string, httpPort: number): Promise<void> {
    // Clean up any existing connection
    this.lifecycle.clearTimers();
    this.lifecycle.resetFailures();

    this.client = new RemoteControlClient(host, httpPort);
    this.setStatus('connecting', { error: null, reconnectAttempts: 0 });

    logger.info('[UE5-CM] Connecting to', `${host}:${httpPort}`);

    const result = await this.client.ping();

    if (!result.ok) {
      this.setStatus('error', { error: result.error });
      eventBus.emit('ue5.error', { message: result.error }, 'ue5-connection');
      logger.warn('[UE5-CM] Initial connection failed:', result.error);
      this.lifecycle.scheduleReconnect();
      return;
    }

    this.setStatus('connected', {
      info: result.data,
      error: null,
      lastConnected: new Date().toISOString(),
      reconnectAttempts: 0,
    });

    eventBus.emit('ue5.connected', { version: result.data.version }, 'ue5-connection');
    logger.info('[UE5-CM] Connected to UE5', result.data.version, `(${result.data.serverName})`);

    this.lifecycle.startHealthCheck();
  }

  /** Disconnect from UE5 Remote Control. */
  disconnect(reason?: string): void {
    this.lifecycle.clearTimers();
    this.client = null;
    this.lifecycle.resetFailures();

    this.setStatus('disconnected', {
      info: null,
      error: null,
      reconnectAttempts: 0,
    });

    eventBus.emit('ue5.disconnected', { reason }, 'ue5-connection');
    logger.info('[UE5-CM] Disconnected', reason ? `(${reason})` : '');
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const ue5Connection = new UE5ConnectionManager();
