'use client';

/**
 * React hook for PoF Bridge connection state.
 *
 * Subscribes to the pofBridgeConnection singleton for real-time state changes
 * and syncs them into pofBridgeStore. Callers that need the rest of the connection
 * state (status, plugin info, error) read pofBridgeStore; this hook returns only
 * `isConnected`, the one field a caller reads. Connection management talks directly
 * to the plugin, not through API proxy routes — it is client-side.
 */

import { useState, useEffect } from 'react';
import { pofBridgeConnection } from '@/lib/pof-bridge/connection-manager';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { PofConnectionState } from '@/types/pof-bridge';

interface UsePofBridgeResult {
  isConnected: boolean;
}

/** Target (host|port|token) the shared connection was last pointed at; dedupes retargets across mounts. */
let lastTargetKey: string | null = null;

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

  // ── Subscribe to connection state changes ──────────────────────────────────

  useEffect(() => {
    // Ordering guard: if a live state change lands before the deferred
    // initial-state sync fires, the deferred snapshot is stale and must not
    // clobber the fresher "connected" state.
    let sawLiveUpdate = false;

    const unsubscribe = pofBridgeConnection.onStateChange((newState) => {
      sawLiveUpdate = true;
      setState(newState);

      // Sync to store so other parts of the app can read connection state
      setConnectionStatus(newState.status);
      setPluginInfo(newState.pluginInfo);
      setError(newState.error);
    });

    // Sync initial state after current render cycle — but only if no live
    // update has already arrived (which would be newer than this snapshot).
    const raf = requestAnimationFrame(() => {
      if (sawLiveUpdate) return;
      // Re-read fresh state at apply time rather than a pre-rAF capture, so a
      // connection that resolved during the frame is reflected, not overwritten.
      const initial = pofBridgeConnection.getState();
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
    const key = `${host}|${pofPort}|${pofAuthToken}`;
    if (current.status === 'disconnected') {
      lastTargetKey = key;
      pofBridgeConnection.connect(host, pofPort, pofAuthToken || undefined);
    } else if (
      (current.status === 'connected' || current.status === 'error' || current.status === 'reconnecting') &&
      lastTargetKey !== null &&
      lastTargetKey !== key
    ) {
      // A settings edit while connected or retrying: retarget once. The module-level key makes the
      // first mounted instance win, so N mounts never fire N connects.
      lastTargetKey = key;
      pofBridgeConnection.connect(host, pofPort, pofAuthToken || undefined);
    } else if (lastTargetKey === null) {
      lastTargetKey = key;
    }
  }, [autoDetect, host, pofPort, pofAuthToken]);

  return { isConnected: state.status === 'connected' };
}
