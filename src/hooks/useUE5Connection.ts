/**
 * React hook for UE5 Remote Control connection state.
 *
 * Subscribes to the SSE status endpoint and exposes connection status,
 * version info, error state, and connect/disconnect actions.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UE5ConnectionState, UE5ConnectionStatus, UE5RemoteControlInfo } from '@/types/ue5-bridge';
import { apiFetch } from '@/lib/api-utils';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';

interface UseUE5ConnectionResult {
  status: UE5ConnectionStatus;
  info: UE5RemoteControlInfo | null;
  error: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useUE5Connection(): UseUE5ConnectionResult {
  const { host, httpPort, autoConnect } = useUE5BridgeStore();

  const [connectionState, setConnectionState] = useState<UE5ConnectionState>({
    status: 'disconnected',
    info: null,
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // ── SSE subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    const es = new EventSource('/api/ue5-bridge/status');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data) as UE5ConnectionState;
        setConnectionState(state);
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      // EventSource will auto-reconnect; we just note the state
      setConnectionState((prev) => ({
        ...prev,
        status: prev.status === 'connected' ? 'reconnecting' : prev.status,
      }));
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  // ── Auto-connect on mount ─────────────────────────────────────────────────

  const hasAutoConnected = useRef(false);

  useEffect(() => {
    if (autoConnect && !hasAutoConnected.current && connectionState.status === 'disconnected') {
      hasAutoConnected.current = true;
      apiFetch('/api/ue5-bridge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', host, httpPort }),
      }).catch(() => {
        // Connection failure is handled by the SSE stream
      });
    }
  }, [autoConnect, host, httpPort, connectionState.status]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    await apiFetch('/api/ue5-bridge/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', host, httpPort }),
    });
  }, [host, httpPort]);

  const disconnect = useCallback(async () => {
    await apiFetch('/api/ue5-bridge/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' }),
    });
  }, []);

  return {
    status: connectionState.status,
    info: connectionState.info,
    error: connectionState.error,
    isConnected: connectionState.status === 'connected',
    connect,
    disconnect,
  };
}
