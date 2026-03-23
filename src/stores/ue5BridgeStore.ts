/**
 * UE5 Bridge Store
 *
 * Persisted settings for the UE5 Remote Control connection (host, port, auto-connect).
 * Non-persisted runtime state for the current connection status.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  UE5ConnectionState,
  UE5ConnectionStatus,
  UE5EditorSnapshot,
  PropertyWatchUpdate,
  LiveEditorState,
} from '@/types/ue5-bridge';

interface UE5BridgeState {
  // ── Persisted settings ──
  /** UE5 host address (default: 127.0.0.1). */
  host: string;
  /** UE5 Web Remote Control HTTP port (default: 30010). */
  httpPort: number;
  /** UE5 WebSocket live-state port (default: 30041). */
  wsPort: number;
  /** Whether to auto-connect on app load. */
  autoConnect: boolean;
  /** Whether to auto-sync live state on connect. */
  autoSyncLiveState: boolean;

  // ── Non-persisted runtime state ──
  /** Current HTTP connection state (not persisted). */
  connectionState: UE5ConnectionState;
  /** WebSocket connection status. */
  wsStatus: UE5ConnectionStatus;
  /** Latest editor snapshot from live state sync. */
  liveSnapshot: UE5EditorSnapshot | null;
  /** Active property watch values keyed by watchId. */
  propertyWatches: Record<string, PropertyWatchUpdate>;
  /** WebSocket messages per second. */
  wsFrameRate: number;

  // ── Actions ──
  setHost: (host: string) => void;
  setHttpPort: (port: number) => void;
  setWsPort: (port: number) => void;
  setAutoConnect: (auto: boolean) => void;
  setAutoSyncLiveState: (auto: boolean) => void;
  setConnectionState: (state: UE5ConnectionState) => void;
  /** Bridge live state from the WebSocket singleton into the store. */
  setLiveState: (state: LiveEditorState) => void;
}

const DEFAULT_CONNECTION_STATE: UE5ConnectionState = {
  status: 'disconnected',
  info: null,
  error: null,
  lastConnected: null,
  reconnectAttempts: 0,
};

export const useUE5BridgeStore = create<UE5BridgeState>()(
  persist(
    (set) => ({
      // Persisted defaults
      host: '127.0.0.1',
      httpPort: 30010,
      wsPort: 30041,
      autoConnect: false,
      autoSyncLiveState: false,

      // Non-persisted runtime (reset on every session)
      connectionState: { ...DEFAULT_CONNECTION_STATE },
      wsStatus: 'disconnected' as UE5ConnectionStatus,
      liveSnapshot: null,
      propertyWatches: {} as Record<string, PropertyWatchUpdate>,
      wsFrameRate: 0,

      // Actions
      setHost: (host) => set({ host }),
      setHttpPort: (httpPort) => set({ httpPort }),
      setWsPort: (wsPort) => set({ wsPort }),
      setAutoConnect: (autoConnect) => set({ autoConnect }),
      setAutoSyncLiveState: (autoSyncLiveState) => set({ autoSyncLiveState }),
      setConnectionState: (connectionState) => set({ connectionState }),
      setLiveState: (liveState: LiveEditorState) => set({
        wsStatus: liveState.wsStatus,
        liveSnapshot: liveState.snapshot,
        propertyWatches: Object.fromEntries(liveState.propertyWatches),
        wsFrameRate: liveState.frameRate,
      }),
    }),
    {
      name: 'pof-ue5-bridge',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        host: state.host,
        httpPort: state.httpPort,
        wsPort: state.wsPort,
        autoConnect: state.autoConnect,
        autoSyncLiveState: state.autoSyncLiveState,
      }),
    },
  ),
);
