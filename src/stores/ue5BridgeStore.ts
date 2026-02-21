/**
 * UE5 Bridge Store
 *
 * Persisted settings for the UE5 Remote Control connection (host, port, auto-connect).
 * Non-persisted runtime state for the current connection status.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UE5ConnectionState } from '@/types/ue5-bridge';

interface UE5BridgeState {
  // ── Persisted settings ──
  /** UE5 host address (default: 127.0.0.1). */
  host: string;
  /** UE5 Web Remote Control HTTP port (default: 30010). */
  httpPort: number;
  /** Whether to auto-connect on app load. */
  autoConnect: boolean;

  // ── Non-persisted runtime state ──
  /** Current connection state (not persisted — always starts disconnected). */
  connectionState: UE5ConnectionState;

  // ── Actions ──
  setHost: (host: string) => void;
  setHttpPort: (port: number) => void;
  setAutoConnect: (auto: boolean) => void;
  setConnectionState: (state: UE5ConnectionState) => void;
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
      autoConnect: false,

      // Non-persisted runtime (reset on every session)
      connectionState: { ...DEFAULT_CONNECTION_STATE },

      // Actions
      setHost: (host) => set({ host }),
      setHttpPort: (httpPort) => set({ httpPort }),
      setAutoConnect: (autoConnect) => set({ autoConnect }),
      setConnectionState: (connectionState) => set({ connectionState }),
    }),
    {
      name: 'pof-ue5-bridge',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        host: state.host,
        httpPort: state.httpPort,
        autoConnect: state.autoConnect,
      }),
    },
  ),
);
