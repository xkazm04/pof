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

  getClient(): RemoteControlClient | null {
    return this.client;
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
