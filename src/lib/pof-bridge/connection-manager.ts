/**
 * PoF Bridge Connection Manager (singleton)
 *
 * Manages the lifecycle of the PoF Bridge plugin connection:
 *   - connect / disconnect
 *   - periodic health checks with automatic reconnection
 *   - subscriber-based state change notifications
 *   - eventBus integration for cross-module awareness
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { PofBridgeClient } from './client';
import type { PofConnectionState, PofConnectionStatus } from '@/types/pof-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

type StateChangeHandler = (state: PofConnectionState) => void;

// ── Connection Manager ──────────────────────────────────────────────────────

class PofBridgeConnectionManager {
  private client: PofBridgeClient | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private subscribers = new Set<StateChangeHandler>();

  private state: PofConnectionState = {
    status: 'disconnected',
    pluginInfo: null,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  };

  // ── State management ────────────────────────────────────────────────────

  getState(): PofConnectionState {
    return { ...this.state };
  }

  getClient(): PofBridgeClient | null {
    return this.client;
  }

  private setState(partial: Partial<PofConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  private setStatus(status: PofConnectionStatus, extras?: Partial<PofConnectionState>) {
    this.setState({ status, ...extras });
  }

  private notifySubscribers() {
    const snapshot = this.getState();
    for (const handler of this.subscribers) {
      try {
        handler(snapshot);
      } catch (e) {
        logger.warn('[PoF-CM] Subscriber error:', e);
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onStateChange(handler: StateChangeHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /** Connect to the PoF Bridge plugin at the given host and port. */
  async connect(host: string, port: number, authToken?: string): Promise<void> {
    // Clean up any existing connection
    this.clearTimers();
    this.consecutiveFailures = 0;

    this.client = new PofBridgeClient(host, port, authToken);
    this.setStatus('connecting', { error: null, reconnectAttempts: 0 });

    logger.info('[PoF-CM] Connecting to', `${host}:${port}`);

    const result = await this.client.getStatus();

    if (!result.ok) {
      this.setStatus('error', { error: result.error });
      eventBus.emit('pof.error', { message: result.error }, 'pof-connection');
      logger.warn('[PoF-CM] Initial connection failed:', result.error);
      this.scheduleReconnect();
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

    this.startHealthCheck();
  }

  /** Disconnect from the PoF Bridge plugin. */
  disconnect(reason?: string): void {
    this.clearTimers();
    this.client = null;
    this.consecutiveFailures = 0;

    this.setStatus('disconnected', {
      pluginInfo: null,
      error: null,
      reconnectAttempts: 0,
    });

    eventBus.emit('pof.disconnected', { reason }, 'pof-connection');
    logger.info('[PoF-CM] Disconnected', reason ? `(${reason})` : '');
  }

  // ── Health check ──────────────────────────────────────────────────────────

  private startHealthCheck() {
    this.healthInterval = setInterval(async () => {
      if (!this.client || this.state.status !== 'connected') return;

      const result = await this.client.getStatus();

      if (result.ok) {
        this.consecutiveFailures = 0;
        // Update pluginInfo in case it changed (e.g. editor state transition)
        if (
          result.data.pluginVersion !== this.state.pluginInfo?.pluginVersion ||
          result.data.editorState !== this.state.pluginInfo?.editorState ||
          result.data.manifestAssetCount !== this.state.pluginInfo?.manifestAssetCount
        ) {
          this.setState({ pluginInfo: result.data });
        }
        return;
      }

      this.consecutiveFailures++;
      logger.warn(
        '[PoF-CM] Health check failed',
        `(${this.consecutiveFailures}/3):`,
        result.error,
      );

      if (this.consecutiveFailures >= 3) {
        logger.warn('[PoF-CM] 3 consecutive health check failures, starting reconnect');
        this.clearTimers();
        this.setStatus('disconnected', { error: 'Health check failed' });
        eventBus.emit('pof.disconnected', { reason: 'health-check-timeout' }, 'pof-connection');
        this.scheduleReconnect();
      }
    }, UI_TIMEOUTS.pofHealthCheck);
  }

  // ── Reconnection ──────────────────────────────────────────────────────────

  private scheduleReconnect() {
    if (!this.client) return;

    const attempt = this.state.reconnectAttempts;
    const delay = Math.min(
      UI_TIMEOUTS.pofReconnectBase * Math.pow(2, attempt),
      UI_TIMEOUTS.pofReconnectMax,
    );

    this.setStatus('reconnecting', { reconnectAttempts: attempt + 1 });
    logger.info('[PoF-CM] Reconnect attempt', attempt + 1, `in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      if (!this.client) return;

      const result = await this.client.getStatus();

      if (result.ok) {
        this.consecutiveFailures = 0;
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
        logger.info('[PoF-CM] Reconnected to PoF Bridge', result.data.pluginVersion);
        this.startHealthCheck();
      } else {
        this.scheduleReconnect();
      }
    }, delay);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private clearTimers() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const pofBridgeConnection = new PofBridgeConnectionManager();
