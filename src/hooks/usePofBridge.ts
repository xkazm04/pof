'use client';

/**
 * React hook for PoF Bridge connection state.
 *
 * Subscribes to the pofBridgeConnection singleton for real-time state changes
 * and syncs them into pofBridgeStore. Provides connect/disconnect actions that
 * use the connection manager (which talks directly to the plugin, not through
 * API proxy routes — connection management is client-side).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pofBridgeConnection } from '@/lib/pof-bridge/connection-manager';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { PofConnectionStatus, PofBridgeStatus, PofConnectionState } from '@/types/pof-bridge';

interface UsePofBridgeResult {
  status: PofConnectionStatus;
  isConnected: boolean;
  pluginInfo: PofBridgeStatus | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function usePofBridge(): UsePofBridgeResult {
  const host = useUE5BridgeStore((s) => s.host);
  const pofPort = usePofBridgeStore((s) => s.pofPort);
  const pofAuthToken = usePofBridgeStore((s) => s.pofAuthToken);
  const autoDetect = usePofBridgeStore((s) => s.autoDetect);
  const setConnectionStatus = usePofBridgeStore((s) => s.setConnectionStatus);
  const setPluginInfo = usePofBridgeStore((s) => s.setPluginInfo);
  const setError = usePofBridgeStore((s) => s.setError);

  const [state, setState] = useState<PofConnectionState>(
    pofBridgeConnection.getState(),
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Subscribe to connection state changes ──────────────────────────────────

  useEffect(() => {
    const unsubscribe = pofBridgeConnection.onStateChange((newState) => {
      if (!mountedRef.current) return;

      setState(newState);

      // Sync to store so other parts of the app can read connection state
      setConnectionStatus(newState.status);
      setPluginInfo(newState.pluginInfo);
      setError(newState.error);
    });

    // Sync initial state after current render cycle
    const initial = pofBridgeConnection.getState();
    const raf = requestAnimationFrame(() => {
      setState(initial);
      setConnectionStatus(initial.status);
      setPluginInfo(initial.pluginInfo);
      setError(initial.error);
    });

    return () => { cancelAnimationFrame(raf); unsubscribe(); };
  }, [setConnectionStatus, setPluginInfo, setError]);

  // ── Auto-connect when autoDetect is enabled ────────────────────────────────

  useEffect(() => {
    if (!autoDetect) return;
    const current = pofBridgeConnection.getState();
    if (current.status === 'disconnected') {
      pofBridgeConnection.connect(host, pofPort, pofAuthToken || undefined);
    }
  }, [autoDetect, host, pofPort, pofAuthToken]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    await pofBridgeConnection.connect(
      host,
      pofPort,
      pofAuthToken || undefined,
    );
  }, [host, pofPort, pofAuthToken]);

  const disconnect = useCallback(() => {
    pofBridgeConnection.disconnect('user-requested');
  }, []);

  return {
    status: state.status,
    isConnected: state.status === 'connected',
    pluginInfo: state.pluginInfo,
    connect,
    disconnect,
  };
}
