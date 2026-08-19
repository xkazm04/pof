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
  /**
   * Adopt the server's real connection state on mount and arm the liveness
   * probe if the bridge answers (idempotent). For mount.
   */
  ensureHealthCheck: () => void;
  /** Tear down the liveness probe without touching the connection. For unmount. */
  stopHealthCheck: () => void;
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

// Module-level liveness probe. Same rationale as retryTimer: a timer handle is
// not serializable, and at most one probe loop runs while connected. The OS can
// tear down the TCP socket on a Blender close/crash/sleep without any client
// notification, so each tick asks the server to ROUND-TRIP a `get_scene_info`
// (`action:'status'` → `BlenderMCPService.probe()`) to detect the silent drop —
// and a wedged-but-open addon, which a cached flag could never see — and
// self-heal.
let healthTimer: ReturnType<typeof setInterval> | null = null;

function clearHealthTimer() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
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

      /**
       * Arm the periodic liveness probe. Idempotent — clears any prior loop
       * first so a reconnect never stacks intervals. Each tick makes the server
       * round-trip a real `get_scene_info`, which is what detects a socket the
       * OS tore down silently (and an addon that is wedged but still holding
       * the socket open) and triggers self-healing (see refreshStatus).
       */
      const startHealthCheck = () => {
        clearHealthTimer();
        healthTimer = setInterval(() => {
          void get().refreshStatus();
        }, UI_TIMEOUTS.blenderHealthCheck);
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
            // Arm the liveness probe so a silent socket drop is detected.
            startHealthCheck();
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
          clearHealthTimer();
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
          const wasConnected = get().connection.connected;
          const result = await tryApiFetch<{
            connection: BlenderConnection;
          }>('/api/blender-mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status' }),
          });

          // A transport failure, OR a success envelope that does not actually
          // carry a connection (a shape only a bug or a stubbed fetch produces —
          // the previous code assigned `undefined` straight into `connection`
          // and left the rest of the app dereferencing it). Either way we could
          // not establish that the bridge is alive.
          const fresh = result.ok ? result.data?.connection : undefined;
          if (!fresh || typeof fresh.connected !== 'boolean') {
            // Returning here used to leave the last "Connected" pill on screen
            // with every Produce gate open, which is the same lie as a cached
            // flag — just one layer up. We do not know, so we must not claim it.
            clearHealthTimer();
            set({
              connection: { ...get().connection, connected: false },
              lastError: result.ok
                ? 'Bridge status response did not include a connection'
                : result.error,
            });
            if (wasConnected && get().autoConnect && !get().autoRetrying) {
              set({ retryAttempt: 0 });
              scheduleRetry();
            }
            return;
          }

          set({
            connection: fresh,
            // A probe that put bytes on the wire and failed carries its own
            // reason; show it rather than a bare grey dot. A live probe clears
            // whatever the previous failure said.
            lastError: fresh.connected ? null : (fresh.lastProbeError ?? get().lastError),
          });

          if (fresh.connected) {
            // The server says the bridge answered. Arm the probe loop even if
            // THIS page load never clicked Connect: `merge` resets `connection`
            // on rehydration, it does not close the socket, so a reload used to
            // show "Disconnected" over a live bridge.
            if (!healthTimer) startHealthCheck();
            return;
          }

          // The probe found Blender gone (OS tore down the socket, or the addon
          // stopped answering). Stop polling a dead link and, when auto-connect
          // is on, arm the backoff loop to self-heal.
          clearHealthTimer();
          if (wasConnected && get().autoConnect && !get().autoRetrying) {
            set({ retryAttempt: 0 });
            scheduleRetry();
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

        ensureHealthCheck: () => {
          // A fresh page load knows NOTHING about the bridge: `merge` resets
          // `connection` to INITIAL_CONNECTION, so the old
          // `if (get().connection.connected)` guard was ALWAYS false on mount.
          // The bar therefore read "Disconnected" over a perfectly live socket
          // and the user clicked Connect — which destroys and rebuilds a working
          // connection. Ask the server instead of trusting the reset copy;
          // `refreshStatus` arms the loop when the probe says the bridge is up.
          // No client-side dedupe needed for concurrent bars: `probe()` collapses
          // simultaneous requests onto one in-flight `get_scene_info`, so N bars
          // still cost exactly one command on the wire.
          if (get().isConnecting) return;
          void get().refreshStatus();
        },

        stopHealthCheck: () => {
          clearHealthTimer();
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
