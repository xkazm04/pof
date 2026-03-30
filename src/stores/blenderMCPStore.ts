'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tryApiFetch } from '@/lib/api-utils';
import type { BlenderConnection } from '@/lib/blender-mcp/types';
import {
  DEFAULT_BLENDER_HOST,
  DEFAULT_BLENDER_PORT,
} from '@/lib/blender-mcp/types';

interface BlenderMCPState {
  // Persisted settings
  host: string;
  port: number;
  autoConnect: boolean;

  // Transient runtime state (reset on rehydration)
  connection: BlenderConnection;
  isConnecting: boolean;
  lastError: string | null;
  recentScreenshots: string[];

  // Actions
  connect: (host?: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  setSettings: (host: string, port: number, autoConnect: boolean) => void;
  addScreenshot: (objectUrl: string) => void;
  clearScreenshots: () => void;
}

const INITIAL_CONNECTION: BlenderConnection = {
  host: DEFAULT_BLENDER_HOST,
  port: DEFAULT_BLENDER_PORT,
  connected: false,
};

export const useBlenderMCPStore = create<BlenderMCPState>()(
  persist(
    (set, get) => ({
      // Persisted
      host: DEFAULT_BLENDER_HOST,
      port: DEFAULT_BLENDER_PORT,
      autoConnect: false,

      // Transient
      connection: INITIAL_CONNECTION,
      isConnecting: false,
      lastError: null,
      recentScreenshots: [],

      connect: async (host?: string, port?: number) => {
        const h = host ?? get().host;
        const p = port ?? get().port;
        set({ isConnecting: true, lastError: null });

        const result = await tryApiFetch<{
          connection: BlenderConnection;
        }>('/api/blender-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'connect', host: h, port: p }),
        });

        if (result.ok) {
          set({
            connection: result.data.connection,
            isConnecting: false,
            host: h,
            port: p,
          });
        } else {
          set({
            isConnecting: false,
            lastError: result.error,
            connection: { host: h, port: p, connected: false },
          });
        }
      },

      disconnect: async () => {
        await tryApiFetch('/api/blender-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect' }),
        });
        set({
          connection: { ...get().connection, connected: false },
          lastError: null,
        });
      },

      refreshStatus: async () => {
        const result = await tryApiFetch<{
          connection: BlenderConnection;
        }>('/api/blender-mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });
        if (result.ok) {
          set({ connection: result.data.connection });
        }
      },

      setSettings: (host, port, autoConnect) =>
        set({ host, port, autoConnect }),

      addScreenshot: (objectUrl) => {
        set((state) => {
          // Revoke oldest if we're at capacity
          if (state.recentScreenshots.length >= 3) {
            const oldest =
              state.recentScreenshots[state.recentScreenshots.length - 1];
            URL.revokeObjectURL(oldest);
          }
          return {
            recentScreenshots: [objectUrl, ...state.recentScreenshots].slice(
              0,
              3,
            ),
          };
        });
      },

      clearScreenshots: () => {
        const { recentScreenshots } = get();
        recentScreenshots.forEach((url) => URL.revokeObjectURL(url));
        set({ recentScreenshots: [] });
      },
    }),
    {
      name: 'pof-blender-mcp',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        host: state.host,
        port: state.port,
        autoConnect: state.autoConnect,
      }),
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<BlenderMCPState>),
        };
        // Reset transient fields on hydration
        merged.connection = INITIAL_CONNECTION;
        merged.isConnecting = false;
        merged.lastError = null;
        merged.recentScreenshots = [];
        return merged;
      },
    },
  ),
);
