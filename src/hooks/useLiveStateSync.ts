'use client';

/**
 * React hook for UE5 live state synchronization over WebSocket.
 *
 * Subscribes to the singleton ws-live-state client, bridges state changes
 * into the ue5BridgeStore, and exposes connect/disconnect/watch actions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { ue5LiveState } from '@/lib/ue5-bridge/ws-live-state';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type {
  UE5ConnectionStatus,
  UE5EditorSnapshot,
  PropertyWatchRequest,
  PropertyWatchUpdate,
} from '@/types/ue5-bridge';

interface UseLiveStateSyncResult {
  /** WebSocket connection status. */
  wsStatus: UE5ConnectionStatus;
  /** Latest editor snapshot from live sync. */
  snapshot: UE5EditorSnapshot | null;
  /** Active property watch values keyed by watchId. */
  propertyWatches: Record<string, PropertyWatchUpdate>;
  /** Messages per second from the WebSocket. */
  frameRate: number;
  /** Whether the WebSocket is currently connected. */
  isLive: boolean;
  /** Connect the WebSocket channel. */
  connectWs: () => void;
  /** Disconnect the WebSocket channel. */
  disconnectWs: () => void;
  /** Subscribe to a property for live value updates. */
  watchProperty: (req: PropertyWatchRequest) => void;
  /** Unsubscribe from a property watch. */
  unwatchProperty: (watchId: string) => void;
  /** Write a property value via WebSocket. */
  setProperty: (objectPath: string, propertyName: string, value: unknown) => void;
  /** Request a fresh full snapshot. */
  requestSnapshot: () => void;
}

export function useLiveStateSync(): UseLiveStateSyncResult {
  const host = useUE5BridgeStore((s) => s.host);
  const wsPort = useUE5BridgeStore((s) => s.wsPort);
  const wsStatus = useUE5BridgeStore((s) => s.wsStatus);
  const liveSnapshot = useUE5BridgeStore((s) => s.liveSnapshot);
  const propertyWatches = useUE5BridgeStore((s) => s.propertyWatches);
  const wsFrameRate = useUE5BridgeStore((s) => s.wsFrameRate);
  const setLiveState = useUE5BridgeStore((s) => s.setLiveState);

  const setLiveStateRef = useRef(setLiveState);
  useEffect(() => { setLiveStateRef.current = setLiveState; }, [setLiveState]);

  // Subscribe to the singleton client and bridge into store
  useEffect(() => {
    const unsub = ue5LiveState.onStateChange((state) => {
      setLiveStateRef.current(state);
    });
    return unsub;
  }, []);

  const connectWs = useCallback(() => {
    ue5LiveState.connect(host, wsPort);
  }, [host, wsPort]);

  const disconnectWs = useCallback(() => {
    ue5LiveState.disconnect('User disconnected');
  }, []);

  const watchProperty = useCallback((req: PropertyWatchRequest) => {
    ue5LiveState.watchProperty(req);
  }, []);

  const unwatchProperty = useCallback((watchId: string) => {
    ue5LiveState.unwatchProperty(watchId);
  }, []);

  const setProperty = useCallback((objectPath: string, propertyName: string, value: unknown) => {
    ue5LiveState.setProperty(objectPath, propertyName, value);
  }, []);

  const requestSnapshot = useCallback(() => {
    ue5LiveState.requestSnapshot();
  }, []);

  return {
    wsStatus,
    snapshot: liveSnapshot,
    propertyWatches,
    frameRate: wsFrameRate,
    isLive: wsStatus === 'connected',
    connectWs,
    disconnectWs,
    watchProperty,
    unwatchProperty,
    setProperty,
    requestSnapshot,
  };
}
