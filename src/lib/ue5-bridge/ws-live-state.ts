/**
 * UE5 WebSocket Live State Client (singleton)
 *
 * Maintains a persistent WebSocket connection to the UE5 editor plugin
 * for bidirectional real-time state synchronization:
 *   - Receives: editor snapshots, delta updates, property watches, PIE/selection events
 *   - Sends: property watch subscriptions, property writes, snapshot requests, pings
 *
 * Designed to work alongside the existing HTTP connection-manager.
 */

import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import type {
  WSConnectionStatus,
  WSInboundMessage,
  WSOutboundMessage,
  UE5EditorSnapshot,
  UE5StateDelta,
  PropertyWatchRequest,
  PropertyWatchUpdate,
  LiveEditorState,
} from '@/types/ue5-bridge';

// ── Types ───────────────────────────────────────────────────────────────────

type LiveStateHandler = (state: LiveEditorState) => void;

// ── Live State Client ───────────────────────────────────────────────────────

class UE5LiveStateClient {
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private subscribers = new Set<LiveStateHandler>();
  private intentionalClose = false;

  /** Active property watches keyed by watchId. */
  private watches = new Map<string, PropertyWatchRequest>();

  /** Latest property values keyed by watchId. */
  private watchValues = new Map<string, PropertyWatchUpdate>();

  /** Frame rate tracker: count messages per second. */
  private messageCount = 0;
  private frameRate = 0;
  private fpsInterval: ReturnType<typeof setInterval> | null = null;

  private state: LiveEditorState = {
    wsStatus: 'disconnected',
    snapshot: null,
    propertyWatches: new Map(),
    lastSnapshotTime: null,
    frameRate: 0,
  };

  // ── State management ────────────────────────────────────────────────────

  getState(): LiveEditorState {
    return {
      ...this.state,
      propertyWatches: new Map(this.state.propertyWatches),
    };
  }

  private setState(partial: Partial<LiveEditorState>) {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  private notifySubscribers() {
    const snapshot = this.getState();
    for (const handler of this.subscribers) {
      try {
        handler(snapshot);
      } catch (e) {
        logger.warn('[UE5-WS] Subscriber error:', e);
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Subscribe to live state changes. Returns unsubscribe function. */
  onStateChange(handler: LiveStateHandler): () => void {
    this.subscribers.add(handler);
    return () => { this.subscribers.delete(handler); };
  }

  /** Connect WebSocket to UE5 editor. */
  connect(host: string, wsPort: number): void {
    this.intentionalClose = false;
    this.cleanup();
    this.reconnectAttempts = 0;

    this.setState({ wsStatus: 'connecting' });
    logger.info('[UE5-WS] Connecting to', `ws://${host}:${wsPort}/pof/live`);

    this.openSocket(host, wsPort);
  }

  /** Disconnect and stop reconnecting. */
  disconnect(reason?: string): void {
    this.intentionalClose = true;
    this.cleanup();
    this.watches.clear();
    this.watchValues.clear();

    this.setState({
      wsStatus: 'disconnected',
      snapshot: null,
      propertyWatches: new Map(),
      lastSnapshotTime: null,
      frameRate: 0,
    });

    eventBus.emit('ue5.ws.disconnected', { reason }, 'ue5-ws');
    logger.info('[UE5-WS] Disconnected', reason ? `(${reason})` : '');
  }

  /** Subscribe to a UObject property for live value streaming. */
  watchProperty(request: PropertyWatchRequest): void {
    this.watches.set(request.watchId, request);
    this.send({ type: 'subscribe.property', payload: request });
  }

  /** Unsubscribe from a property watch. */
  unwatchProperty(watchId: string): void {
    this.watches.delete(watchId);
    this.watchValues.delete(watchId);
    this.send({ type: 'unsubscribe.property', payload: { watchId } });

    // Update state immediately
    const next = new Map(this.state.propertyWatches);
    next.delete(watchId);
    this.setState({ propertyWatches: next });
  }

  /** Write a property value via the WebSocket channel. */
  setProperty(objectPath: string, propertyName: string, value: unknown): void {
    this.send({ type: 'set.property', payload: { objectPath, propertyName, value } });
  }

  /** Request a fresh full snapshot from UE5. */
  requestSnapshot(): void {
    this.send({ type: 'request.snapshot' });
  }

  /** Whether the WebSocket is currently connected. */
  get isConnected(): boolean {
    return this.state.wsStatus === 'connected';
  }

  // ── WebSocket lifecycle ─────────────────────────────────────────────────

  private openSocket(host: string, wsPort: number) {
    try {
      this.ws = new WebSocket(`ws://${host}:${wsPort}/pof/live`);
    } catch (e) {
      logger.warn('[UE5-WS] Failed to create WebSocket:', e);
      this.scheduleReconnect(host, wsPort);
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState({ wsStatus: 'connected' });
      eventBus.emit('ue5.ws.connected', {}, 'ue5-ws');
      logger.info('[UE5-WS] Connected');

      // Start ping keepalive
      this.startPing();

      // Start FPS counter
      this.startFpsCounter();

      // Re-subscribe any active watches
      for (const watch of this.watches.values()) {
        this.send({ type: 'subscribe.property', payload: watch });
      }

      // Request initial snapshot
      this.send({ type: 'request.snapshot' });
    };

    this.ws.onmessage = (event) => {
      this.messageCount++;
      try {
        const msg = JSON.parse(event.data as string) as WSInboundMessage;
        this.handleMessage(msg);
      } catch (e) {
        logger.warn('[UE5-WS] Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.stopFpsCounter();

      if (!this.intentionalClose) {
        logger.warn('[UE5-WS] Connection closed unexpectedly, reconnecting...');
        this.setState({ wsStatus: 'reconnecting' });
        this.scheduleReconnect(host, wsPort);
      }
    };

    this.ws.onerror = (e) => {
      logger.warn('[UE5-WS] WebSocket error:', e);
    };
  }

  // ── Message handling ────────────────────────────────────────────────────

  private handleMessage(msg: WSInboundMessage) {
    switch (msg.type) {
      case 'state.snapshot':
        this.handleSnapshot(msg.payload);
        break;

      case 'state.delta':
        this.handleDelta(msg.payload);
        break;

      case 'property.update':
        this.handlePropertyUpdate(msg.payload);
        break;

      case 'event.pie':
        eventBus.emit('ue5.ws.pie', {
          action: msg.payload.action,
          sessionId: msg.payload.sessionId,
        }, 'ue5-ws');
        // Also update snapshot PIE state
        if (this.state.snapshot) {
          const updated = { ...this.state.snapshot };
          if (msg.payload.action === 'started') {
            updated.editorState = 'PIE';
            updated.pieState = {
              isRunning: true,
              isPaused: false,
              sessionId: msg.payload.sessionId,
              playerCount: 1,
              elapsedSeconds: 0,
            };
          } else if (msg.payload.action === 'stopped') {
            updated.editorState = 'Editing';
            updated.pieState = null;
          } else if (msg.payload.action === 'paused') {
            updated.editorState = 'Paused';
            if (updated.pieState) updated.pieState.isPaused = true;
          } else if (msg.payload.action === 'resumed') {
            updated.editorState = 'PIE';
            if (updated.pieState) updated.pieState.isPaused = false;
          }
          this.setState({ snapshot: updated });
        }
        break;

      case 'event.selection':
        eventBus.emit('ue5.ws.selection', {
          actorCount: msg.payload.actors.length,
        }, 'ue5-ws');
        if (this.state.snapshot) {
          this.setState({
            snapshot: { ...this.state.snapshot, selectedActors: msg.payload.actors },
          });
        }
        break;

      case 'pong':
        // Keepalive acknowledged
        break;
    }
  }

  private handleSnapshot(snapshot: UE5EditorSnapshot) {
    this.setState({
      snapshot,
      lastSnapshotTime: snapshot.timestamp,
    });
    eventBus.emit('ue5.ws.snapshot', {
      timestamp: snapshot.timestamp,
      editorState: snapshot.editorState,
    }, 'ue5-ws');
  }

  private handleDelta(delta: UE5StateDelta) {
    if (!this.state.snapshot) {
      // No base snapshot yet — request one
      this.send({ type: 'request.snapshot' });
      return;
    }

    const updated: UE5EditorSnapshot = { ...this.state.snapshot };

    if (delta.editorState !== undefined) updated.editorState = delta.editorState;
    if (delta.viewport !== undefined) updated.viewport = { ...updated.viewport, ...delta.viewport };
    if (delta.selectedActors !== undefined) updated.selectedActors = delta.selectedActors;
    if (delta.pieState !== undefined) updated.pieState = delta.pieState;
    if (delta.openLevel !== undefined) updated.openLevel = delta.openLevel;
    if (delta.dirtyPackages !== undefined) updated.dirtyPackages = delta.dirtyPackages;
    updated.timestamp = delta.timestamp;

    this.setState({
      snapshot: updated,
      lastSnapshotTime: delta.timestamp,
    });
  }

  private handlePropertyUpdate(update: PropertyWatchUpdate) {
    this.watchValues.set(update.watchId, update);
    const next = new Map(this.state.propertyWatches);
    next.set(update.watchId, update);
    this.setState({ propertyWatches: next });

    eventBus.emit('ue5.ws.property', {
      watchId: update.watchId,
      propertyName: update.propertyName,
    }, 'ue5-ws');
  }

  // ── Send ────────────────────────────────────────────────────────────────

  private send(msg: WSOutboundMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Ping / Keepalive ────────────────────────────────────────────────────

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, UI_TIMEOUTS.ue5WsPingInterval);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ── FPS counter ─────────────────────────────────────────────────────────

  private startFpsCounter() {
    this.messageCount = 0;
    this.frameRate = 0;
    this.fpsInterval = setInterval(() => {
      this.frameRate = this.messageCount;
      this.messageCount = 0;
      this.setState({ frameRate: this.frameRate });
    }, 1000);
  }

  private stopFpsCounter() {
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
    this.frameRate = 0;
  }

  // ── Reconnect ───────────────────────────────────────────────────────────

  private scheduleReconnect(host: string, wsPort: number) {
    const delay = Math.min(
      UI_TIMEOUTS.ue5WsReconnectBase * Math.pow(2, this.reconnectAttempts),
      UI_TIMEOUTS.ue5WsReconnectMax,
    );

    this.reconnectAttempts++;
    logger.info('[UE5-WS] Reconnect attempt', this.reconnectAttempts, `in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) {
        this.openSocket(host, wsPort);
      }
    }, delay);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  private cleanup() {
    this.stopPing();
    this.stopFpsCounter();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Prevent onclose from triggering reconnect
      const sock = this.ws;
      this.ws = null;
      sock.onclose = null;
      sock.onerror = null;
      sock.onmessage = null;
      sock.onopen = null;
      if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
        sock.close();
      }
    }
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const ue5LiveState = new UE5LiveStateClient();
