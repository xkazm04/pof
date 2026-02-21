/**
 * UE5 Remote Control Connection Manager (singleton)
 *
 * Manages the lifecycle of the UE5 connection:
 *   - connect / disconnect
 *   - periodic health checks with automatic reconnection
 *   - subscriber-based state change notifications
 *   - eventBus integration for cross-module awareness
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { RemoteControlClient } from './remote-control-client';
import type { UE5ConnectionState, UE5ConnectionStatus } from '@/types/ue5-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

type StateChangeHandler = (state: UE5ConnectionState) => void;

// ── Connection Manager ──────────────────────────────────────────────────────

class UE5ConnectionManager {
  private client: RemoteControlClient | null = null;
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private subscribers = new Set<StateChangeHandler>();

  private state: UE5ConnectionState = {
    status: 'disconnected',
    info: null,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  };

  // ── State management ────────────────────────────────────────────────────

  getState(): UE5ConnectionState {
    return { ...this.state };
  }

  getClient(): RemoteControlClient | null {
    return this.client;
  }

  private setState(partial: Partial<UE5ConnectionState>) {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  private setStatus(status: UE5ConnectionStatus, extras?: Partial<UE5ConnectionState>) {
    this.setState({ status, ...extras });
  }

  private notifySubscribers() {
    const snapshot = this.getState();
    for (const handler of this.subscribers) {
      try {
        handler(snapshot);
      } catch (e) {
        logger.warn('[UE5-CM] Subscriber error:', e);
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

  /** Connect to UE5 Remote Control at the given host and port. */
  async connect(host: string, httpPort: number): Promise<void> {
    // Clean up any existing connection
    this.clearTimers();
    this.consecutiveFailures = 0;

    this.client = new RemoteControlClient(host, httpPort);
    this.setStatus('connecting', { error: null, reconnectAttempts: 0 });

    logger.info('[UE5-CM] Connecting to', `${host}:${httpPort}`);

    const result = await this.client.ping();

    if (!result.ok) {
      this.setStatus('error', { error: result.error });
      eventBus.emit('ue5.error', { message: result.error }, 'ue5-connection');
      logger.warn('[UE5-CM] Initial connection failed:', result.error);
      this.scheduleReconnect();
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

    this.startHealthCheck();
  }

  /** Disconnect from UE5 Remote Control. */
  disconnect(reason?: string): void {
    this.clearTimers();
    this.client = null;
    this.consecutiveFailures = 0;

    this.setStatus('disconnected', {
      info: null,
      error: null,
      reconnectAttempts: 0,
    });

    eventBus.emit('ue5.disconnected', { reason }, 'ue5-connection');
    logger.info('[UE5-CM] Disconnected', reason ? `(${reason})` : '');
  }

  // ── Health check ──────────────────────────────────────────────────────────

  private startHealthCheck() {
    this.healthInterval = setInterval(async () => {
      if (!this.client || this.state.status !== 'connected') return;

      const result = await this.client.ping();

      if (result.ok) {
        this.consecutiveFailures = 0;
        // Update info in case it changed (e.g. level change updates serverName)
        if (
          result.data.version !== this.state.info?.version ||
          result.data.serverName !== this.state.info?.serverName
        ) {
          this.setState({ info: result.data });
        }
        return;
      }

      this.consecutiveFailures++;
      logger.warn(
        '[UE5-CM] Health check failed',
        `(${this.consecutiveFailures}/3):`,
        result.error,
      );

      if (this.consecutiveFailures >= 3) {
        logger.warn('[UE5-CM] 3 consecutive health check failures, starting reconnect');
        this.clearTimers();
        this.setStatus('disconnected', { error: 'Health check failed' });
        eventBus.emit('ue5.disconnected', { reason: 'health-check-timeout' }, 'ue5-connection');
        this.scheduleReconnect();
      }
    }, UI_TIMEOUTS.ue5HealthCheck);
  }

  // ── Reconnection ──────────────────────────────────────────────────────────

  private scheduleReconnect() {
    if (!this.client) return;

    const attempt = this.state.reconnectAttempts;
    const delay = Math.min(
      UI_TIMEOUTS.ue5ReconnectBase * Math.pow(2, attempt),
      UI_TIMEOUTS.ue5ReconnectMax,
    );

    this.setStatus('reconnecting', { reconnectAttempts: attempt + 1 });
    logger.info('[UE5-CM] Reconnect attempt', attempt + 1, `in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      if (!this.client) return;

      const result = await this.client.ping();

      if (result.ok) {
        this.consecutiveFailures = 0;
        this.setStatus('connected', {
          info: result.data,
          error: null,
          lastConnected: new Date().toISOString(),
          reconnectAttempts: 0,
        });
        eventBus.emit('ue5.connected', { version: result.data.version }, 'ue5-connection');
        logger.info('[UE5-CM] Reconnected to UE5', result.data.version);
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

export const ue5Connection = new UE5ConnectionManager();
