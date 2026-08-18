/**
 * React hook for UE5 Remote Control connection state — the browser's ONLY
 * live view of the server-owned connection.
 *
 * OWNERSHIP (deliberate — see `@/lib/ue5-bridge/connection-manager`): the UE5
 * Remote Control socket lives in the Node server process, because server-only
 * routes (`/api/ue5-inject-item`, `/api/ue5-bridge/query`) drive the plugin
 * with no user present. Client code cannot read that singleton — importing it
 * into the browser bundle yields a SEPARATE, permanently-disconnected
 * instance. Everything the UI needs therefore comes over the wire:
 *
 *   state  ← GET  /api/ue5-bridge/status  (SSE, pushes every state change)
 *   verbs  → POST /api/ue5-bridge/query   (connect / disconnect / consoleCommand)
 *
 * Mounting this hook is what makes `useUE5BridgeStore.connectionState`
 * reachable: every SSE frame is written into the store, so features gated on
 * `connectionState.status === 'connected'` (the affix workbench's UE5 inject,
 * for one) finally have a live path to `connected`.
 *
 * The SSE frame is the SINGLE source of truth for the store. `connect()` does
 * NOT also write its own POST response into the store — the server emits the
 * state change to the stream anyway, and a second writer would race the stream
 * and could clobber a newer frame with a stale snapshot.
 *
 * ONE STREAM PER TAB, not one per mount: the hook is mounted on more than one
 * surface (Project Setup's connection card, the debug console). Each mount used
 * to open its own `EventSource`; they now share a single refcounted stream —
 * see `subscribeStatusStream` below.
 */

'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import type {
  UE5ConnectionState,
  UE5ConnectionStatus,
  UE5RemoteControlInfo,
} from '@/types/ue5-bridge';
import type { Result } from '@/types/result';
import { tryApiFetch } from '@/lib/api-utils';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';

/** Server-executed console command result (mirrors `RemoteControlClient`). */
export interface UE5ConsoleCommandResult {
  command: string;
  executed: boolean;
}

interface UseUE5ConnectionResult {
  status: UE5ConnectionStatus;
  info: UE5RemoteControlInfo | null;
  error: string | null;
  isConnected: boolean;
  /**
   * True once the SSE stream has delivered at least one frame — i.e. the
   * status shown is the server's, not the store's optimistic default. UI that
   * would otherwise report "Offline" before the first frame should wait.
   */
  isStateLive: boolean;
  connect: () => Promise<Result<UE5ConnectionState, string>>;
  disconnect: () => Promise<Result<UE5ConnectionState, string>>;
  /**
   * Run a console command on the server-held connection. Fallible: a rejected
   * Result means the command was NOT executed, and the string says why.
   */
  executeConsoleCommand: (command: string) => Promise<Result<UE5ConsoleCommandResult, string>>;
}

const STATUS_SSE_URL = '/api/ue5-bridge/status';
const QUERY_URL = '/api/ue5-bridge/query';

function postQuery(body: Record<string, unknown>) {
  return tryApiFetch<UE5ConnectionState>(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ── Shared SSE stream ──────────────────────────────────────────────────────
 *
 * Module-level, refcounted: however many components mount this hook, the tab
 * holds exactly ONE `EventSource` on /api/ue5-bridge/status. The stream opens
 * on the first mount and closes on the last unmount.
 *
 * Liveness (`sawFirstFrame`) lives here too, and is deliberately NOT per-mount:
 * a second mount arriving after the first frame must inherit "live" rather than
 * sit on "Checking…" forever waiting for a frame that may not come for minutes.
 * It resets when the stream is torn down — with nothing listening we are no
 * longer being told anything, so the next mount must earn "live" again.
 *
 * This is transport plumbing only: the frame handler is still the single writer
 * of `connectionState`, exactly as before.
 */

/** Live stream, or null when no component has the hook mounted. */
let statusStream: EventSource | null = null;
/** How many mounts currently hold the stream. */
let streamHolders = 0;
/** Has this stream delivered at least one frame? */
let sawFirstFrame = false;
/** One auto-connect attempt per stream, not per mount. */
let autoConnectFired = false;
/** `useSyncExternalStore` notifiers — one per mount. */
const livenessListeners = new Set<() => void>();

function markStateLive() {
  if (sawFirstFrame) return;
  sawFirstFrame = true;
  for (const notify of livenessListeners) notify();
}

function openStatusStream(): EventSource {
  const es = new EventSource(STATUS_SSE_URL);

  es.onmessage = (event) => {
    try {
      const state = JSON.parse(event.data) as UE5ConnectionState;
      // Read the store through getState() rather than a captured action so
      // the stream never needs re-subscribing on a store identity change.
      useUE5BridgeStore.getState().setConnectionState(state);
      markStateLive();
    } catch {
      /* a malformed frame tells us nothing — leave the last known state */
    }
  };

  es.onerror = () => {
    // The browser's EventSource retries on its own. What we lost is the
    // app server's stream, so we no longer KNOW that UE5 is connected —
    // saying so would be the exact lie this hook exists to remove.
    const prev = useUE5BridgeStore.getState().connectionState;
    if (prev.status === 'connected') {
      useUE5BridgeStore.getState().setConnectionState({ ...prev, status: 'reconnecting' });
    }
  };

  return es;
}

/**
 * `useSyncExternalStore` subscribe — doubles as the stream's acquire/release.
 * Module-level (stable identity) so React never re-subscribes on re-render.
 */
function subscribeStatusStream(onLivenessChange: () => void): () => void {
  livenessListeners.add(onLivenessChange);
  streamHolders += 1;
  if (!statusStream && typeof EventSource !== 'undefined') {
    statusStream = openStatusStream();
  }

  return () => {
    livenessListeners.delete(onLivenessChange);
    streamHolders -= 1;
    if (streamHolders > 0) return;

    if (statusStream) {
      statusStream.onmessage = null;
      statusStream.onerror = null;
      statusStream.close();
      statusStream = null;
    }
    sawFirstFrame = false;
    autoConnectFired = false;
  };
}

const getIsStateLive = () => sawFirstFrame;
/** On the server there is no stream, so nothing has been observed yet. */
const getIsStateLiveOnServer = () => false;

export function useUE5Connection(): UseUE5ConnectionResult {
  const host = useUE5BridgeStore((s) => s.host);
  const httpPort = useUE5BridgeStore((s) => s.httpPort);
  const autoConnect = useUE5BridgeStore((s) => s.autoConnect);
  const connectionState = useUE5BridgeStore((s) => s.connectionState);

  // ── SSE subscription — the live transport ─────────────────────────────────
  //
  // Subscribing through `useSyncExternalStore` (rather than useEffect +
  // useState) does three jobs at once: it holds a share of the ONE refcounted
  // stream for as long as this component is mounted, it reports whether that
  // stream has delivered a frame yet, and it never sets state from an effect.
  //
  // Deliberately not `useSuspendableEffect`: this is not polling. It is one
  // event-driven stream whose whole job is to keep `connectionState` truthful
  // for OTHER modules (the affix workbench reads it while this module is
  // hidden in the LRU). Pausing it on suspend would freeze the store at a
  // value that may since have gone stale. Idle cost is one keepalive comment
  // every 30s, for the whole tab.

  /** Has the SSE stream delivered a frame yet? Gates auto-connect and the UI. */
  const isStateLive = useSyncExternalStore(
    subscribeStatusStream,
    getIsStateLive,
    getIsStateLiveOnServer,
  );

  // ── Auto-connect on mount ─────────────────────────────────────────────────
  //
  // Gated on `isStateLive` so we never fire a redundant connect at a server
  // that is already connected (the store's pre-stream default is
  // 'disconnected', which is a guess, not an observation). The guard is
  // per-stream, not per-mount, so two mounted surfaces do not both POST.

  useEffect(() => {
    if (!autoConnect || !isStateLive || autoConnectFired) return;
    if (connectionState.status !== 'disconnected') return;

    autoConnectFired = true;
    void postQuery({ action: 'connect', host, httpPort });
    // Failures land on the SSE stream as an 'error' state.
  }, [autoConnect, isStateLive, connectionState.status, host, httpPort]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const connect = useCallback(
    () => postQuery({ action: 'connect', host, httpPort }),
    [host, httpPort],
  );

  const disconnect = useCallback(
    () => postQuery({ action: 'disconnect', reason: 'user-requested' }),
    [],
  );

  const executeConsoleCommand = useCallback(
    (command: string) =>
      tryApiFetch<UE5ConsoleCommandResult>(QUERY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consoleCommand', command }),
      }),
    [],
  );

  return {
    status: connectionState.status,
    info: connectionState.info,
    error: connectionState.error,
    isConnected: connectionState.status === 'connected',
    isStateLive,
    connect,
    disconnect,
    executeConsoleCommand,
  };
}
