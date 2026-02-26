/**
 * PoF Bridge Store
 *
 * Persisted settings for the PoF Bridge plugin connection (port, auth, auto-detect).
 * Non-persisted runtime state for the current connection status and manifest cache.
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PofBridgeStatus, AssetManifest, PofConnectionStatus } from '@/types/pof-bridge';

interface PofBridgeState {
  // ── Persisted settings ──
  /** PoF Bridge plugin HTTP port (default: 30040). */
  pofPort: number;
  /** Optional auth token for the PoF Bridge plugin. */
  pofAuthToken: string;
  /** Whether to auto-detect and connect on app load. */
  autoDetect: boolean;

  // ── Non-persisted runtime state ──
  /** Current connection status (not persisted — always starts disconnected). */
  connectionStatus: PofConnectionStatus;
  /** Plugin status info from the last successful health check. */
  pluginInfo: PofBridgeStatus | null;
  /** Cached asset manifest from the last fetch. */
  manifest: AssetManifest | null;
  /** Checksum of the cached manifest for change detection. */
  manifestChecksum: string | null;
  /** ISO timestamp of the last manifest update. */
  lastManifestUpdate: string | null;
  /** Current error message, if any. */
  error: string | null;

  // ── Actions ──
  setPofPort: (port: number) => void;
  setPofAuthToken: (token: string) => void;
  setAutoDetect: (auto: boolean) => void;
  setConnectionStatus: (status: PofConnectionStatus) => void;
  setPluginInfo: (info: PofBridgeStatus | null) => void;
  setManifest: (manifest: AssetManifest | null, checksum?: string) => void;
  setError: (error: string | null) => void;
}

export const usePofBridgeStore = create<PofBridgeState>()(
  persist(
    (set) => ({
      // Persisted defaults
      pofPort: 30040,
      pofAuthToken: '',
      autoDetect: true,

      // Non-persisted runtime (reset on every session)
      connectionStatus: 'disconnected',
      pluginInfo: null,
      manifest: null,
      manifestChecksum: null,
      lastManifestUpdate: null,
      error: null,

      // Actions
      setPofPort: (pofPort) => set({ pofPort }),
      setPofAuthToken: (pofAuthToken) => set({ pofAuthToken }),
      setAutoDetect: (autoDetect) => set({ autoDetect }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setPluginInfo: (pluginInfo) => set({ pluginInfo }),
      setManifest: (manifest, checksum) =>
        set({
          manifest,
          manifestChecksum: checksum ?? manifest?.checksumSha256 ?? null,
          lastManifestUpdate: manifest ? new Date().toISOString() : null,
        }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'pof-bridge',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pofPort: state.pofPort,
        pofAuthToken: state.pofAuthToken,
        autoDetect: state.autoDetect,
      }),
    },
  ),
);
