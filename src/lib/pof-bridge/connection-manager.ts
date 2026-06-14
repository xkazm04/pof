/**
 * PoF Bridge Connection Manager (singleton)
 *
 * Manages the lifecycle of the PoF Bridge plugin connection:
 *   - connect / disconnect
 *   - periodic health checks with automatic reconnection
 *   - subscriber-based state change notifications
 *   - eventBus integration for cross-module awareness
 *
 * The transport-agnostic lifecycle (health-check loop, exponential-backoff
 * reconnect, timer cleanup) lives in `@/lib/connection-lifecycle`; this manager
 * supplies the PoF-specific transport (`client.getStatus()`) and event wiring.
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { createStateEmitter } from '@/lib/state-emitter';
import { createConnectionLifecycle } from '@/lib/connection-lifecycle';
import { PofBridgeClient } from './client';
import type { PofBridgeStatus, PofConnectionState, PofConnectionStatus } from '@/types/pof-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

type StateChangeHandler = (state: PofConnectionState) => void;

// ── Connection Manager ──────────────────────────────────────────────────────

class PofBridgeConnectionManager {
  private client: PofBridgeClient | null = null;

  private emitter = createStateEmitter<PofConnectionState>({
    label: '[PoF-CM]',
    initial: {
      status: 'disconnected',
      pluginInfo: null,
      error: null,
      lastConnected: null,
      reconnectAttempts: 0,
    },
  });

  private lifecycle = createConnectionLifecycle<PofBridgeStatus>({
    label: '[PoF-CM]',
    healthCheckMs: UI_TIMEOUTS.pofHealthCheck,
    backoffBase: UI_TIMEOUTS.pofReconnectBase,
    backoffMax: UI_TIMEOUTS.pofReconnectMax,
    // PoF historically does not reseed reconnectAttempts on health-check failure.
    resetAttemptsOnHealthFailure: false,
    probe: () => this.client!.getStatus(),
    hasClient: () => this.client !== null,
    getStatus: () => this.state.status,
    getReconnectAttempts: () => this.state.reconnectAttempts,
    onHealthInfo: (data) => {
      // Update pluginInfo in case it changed (e.g. editor state transition)
      if (
        data.pluginVersion !== this.state.pluginInfo?.pluginVersion ||
        data.editorState !== this.state.pluginInfo?.editorState ||
        data.manifestAssetCount !== this.state.pluginInfo?.manifestAssetCount
      ) {
        this.setState({ pluginInfo: data });
      }
    },
    onConnected: (data) => {
      this.setStatus('connected', {
        pluginInfo: data,
        error: null,
        lastConnected: new Date().toISOString(),
        reconnectAttempts: 0,
      });
      eventBus.emit(
        'pof.connected',
        {
          pluginVersion: data.pluginVersion,
          engineVersion: data.engineVersion,
          projectName: data.projectName,
        },
        'pof-connection',
      );
      logger.info('[PoF-CM] Reconnected to PoF Bridge', data.pluginVersion);
    },
    onDisconnectedForReconnect: () => {
      this.setStatus('disconnected', { error: 'Health check failed' });
      eventBus.emit('pof.disconnected', { reason: 'health-check-timeout' }, 'pof-connection');
    },
    onReconnecting: (nextAttempt) => {
      this.setStatus('reconnecting', { reconnectAttempts: nextAttempt });
    },
  });

  /** Live, read-only view of state for the manager's own internal checks. */
  private get state(): PofConnectionState {
    return this.emitter.peek();
  }

  // ── State management ────────────────────────────────────────────────────

  getState(): PofConnectionState {
    return this.emitter.getState();
  }

  getClient(): PofBridgeClient | null {
    return this.client;
  }

  private setState(partial: Partial<PofConnectionState>) {
    this.emitter.setState(partial);
  }

  private setStatus(status: PofConnectionStatus, extras?: Partial<PofConnectionState>) {
    this.setState({ status, ...extras });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onStateChange(handler: StateChangeHandler): () => void {
    return this.emitter.subscribe(handler);
  }

  /** Connect to the PoF Bridge plugin at the given host and port. */
  async connect(host: string, port: number, authToken?: string): Promise<void> {
    // Clean up any existing connection
    this.lifecycle.clearTimers();
    this.lifecycle.resetFailures();

    this.client = new PofBridgeClient(host, port, authToken);
    this.setStatus('connecting', { error: null, reconnectAttempts: 0 });

    logger.info('[PoF-CM] Connecting to', `${host}:${port}`);

    const result = await this.client.getStatus();

    if (!result.ok) {
      this.setStatus('error', { error: result.error });
      eventBus.emit('pof.error', { message: result.error }, 'pof-connection');
      logger.warn('[PoF-CM] Initial connection failed:', result.error);
      this.lifecycle.scheduleReconnect();
      return;
    }

    this.setStatus('connected', {
      pluginInfo: result.data,
      error: null,
      lastConnected: new Date().toISOString(),
      reconnectAttempts: 0,
    });

    eventBus.emit(
      'pof.connected',
      {
        pluginVersion: result.data.pluginVersion,
        engineVersion: result.data.engineVersion,
        projectName: result.data.projectName,
      },
      'pof-connection',
    );
    logger.info(
      '[PoF-CM] Connected to PoF Bridge',
      result.data.pluginVersion,
      `(${result.data.projectName})`,
    );

    this.lifecycle.startHealthCheck();
  }

  /** Disconnect from the PoF Bridge plugin. */
  disconnect(reason?: string): void {
    this.lifecycle.clearTimers();
    this.client = null;
    this.lifecycle.resetFailures();

    this.setStatus('disconnected', {
      pluginInfo: null,
      error: null,
      reconnectAttempts: 0,
    });

    eventBus.emit('pof.disconnected', { reason }, 'pof-connection');
    logger.info('[PoF-CM] Disconnected', reason ? `(${reason})` : '');
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const pofBridgeConnection = new PofBridgeConnectionManager();
