'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tryApiFetch } from '@/lib/api-utils';
import { UI_TIMEOUTS } from '@/lib/constants';
import {
  BLENDER_RETRY_MAX_ATTEMPTS,
  nextRetryDelay,
} from '@/lib/blender-mcp/diagnostics';
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
  /** Number of automatic retries performed for the current connect cycle. */
  retryAttempt: number;
  /** True while a backoff retry is scheduled or in flight. */
  autoRetrying: boolean;
  /** Guard so autoConnect-on-mount only fires once per app session. */
  autoConnectAttempted: boolean;

  // Actions
  connect: (host?: string, port?: number) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  setSettings: (host: string, port: number, autoConnect: boolean) => void;
  setAutoConnect: (autoConnect: boolean) => void;
  /** Honor the persisted autoConnect flag on mount (idempotent). */
  maybeAutoConnect: () => void;
  /** Stop and clear any scheduled/in-flight auto-retry. */
  cancelRetry: () => void;
  addScreenshot: (objectUrl: string) => void;
  clearScreenshots: () => void;
}

const INITIAL_CONNECTION: BlenderConnection = {
  host: DEFAULT_BLENDER_HOST,
  port: DEFAULT_BLENDER_PORT,
  connected: false,
};

// Module-level timer for the backoff loop. Lives outside the store because a
// timer handle is not serializable state and only ever one retry is in flight.
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export const useBlenderMCPStore = create<BlenderMCPState>()(
  persist(
    (set, get) => {
      /** Schedule the next backoff retry, or give up at the attempt ceiling. */
      const scheduleRetry = () => {
        clearRetryTimer();
        const attempt = get().retryAttempt;
        if (attempt >= BLENDER_RETRY_MAX_ATTEMPTS) {
          // Exhausted — leave the diagnosis on screen for the user.
          set({ autoRetrying: false });
          return;
        }
        const delay = nextRetryDelay(
          attempt,
          UI_TIMEOUTS.blenderReconnectBase,
          UI_TIMEOUTS.blenderReconnectMax,
        );
        set({ autoRetrying: true });
        retryTimer = setTimeout(() => {
          retryTimer = null;
          set({ retryAttempt: get().retryAttempt + 1 });
          void get().connect();
        }, delay);
      };

      return {
        // Persisted
        host: DEFAULT_BLENDER_HOST,
        port: DEFAULT_BLENDER_PORT,
        autoConnect: false,

        // Transient
        connection: INITIAL_CONNECTION,
        isConnecting: false,
        lastError: null,
        recentScreenshots: [],
        retryAttempt: 0,
        autoRetrying: false,
        autoConnectAttempted: false,

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
            clearRetryTimer();
            set({
              connection: result.data.connection,
              isConnecting: false,
              lastError: null,
              host: h,
              port: p,
              retryAttempt: 0,
              autoRetrying: false,
            });
          } else {
            set({
              isConnecting: false,
              lastError: result.error,
              connection: { host: h, port: p, connected: false },
            });
            // Keep trying with exponential backoff when auto-connect is on.
            if (get().autoConnect) {
              scheduleRetry();
            }
          }
        },

        disconnect: async () => {
          clearRetryTimer();
          set({ retryAttempt: 0, autoRetrying: false });
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

        setAutoConnect: (autoConnect) => {
          set({ autoConnect });
          if (!autoConnect) {
            // Turning it off stops any pending retry loop.
            get().cancelRetry();
            return;
          }
          // Turning it on while idle should connect right away.
          const { connection, isConnecting, autoRetrying } = get();
          if (!connection.connected && !isConnecting && !autoRetrying) {
            set({ retryAttempt: 0 });
            void get().connect();
          }
        },

        maybeAutoConnect: () => {
          if (get().autoConnectAttempted) return;
          set({ autoConnectAttempted: true });
          const { autoConnect, connection, isConnecting, autoRetrying } = get();
          if (
            autoConnect &&
            !connection.connected &&
            !isConnecting &&
            !autoRetrying
          ) {
            set({ retryAttempt: 0 });
            void get().connect();
          }
        },

        cancelRetry: () => {
          clearRetryTimer();
          set({ retryAttempt: 0, autoRetrying: false });
        },

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
      };
    },
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
        merged.retryAttempt = 0;
        merged.autoRetrying = false;
        merged.autoConnectAttempted = false;
        return merged;
      },
    },
  ),
);
