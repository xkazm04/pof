'use client';

/**
 * React hook for the PoF Bridge asset manifest - a thin view over ONE manifest
 * feed per tab (the same refcounted shape as `useUE5Connection`'s stream).
 *
 * - Keyed: the cached manifest carries the key (`${port}::${projectName}`) it
 *   was fetched under; a manifest cached for another editor is never returned,
 *   and a reconnect to another editor clears it and refetches.
 * - One flight: concurrent callers join the in-flight request for the same key.
 * - One interval: the 30s checksum poll is refcounted by VISIBLE holders -
 *   holders acquire through `useSuspendableEffect`, so hidden LRU panes release
 *   it and the interval dies with the last visible holder.
 * - Live: the checksum answer is read tolerantly (`readManifestChecksum`), a
 *   change refetches in full, and the store facts the feed watches (connection
 *   status, editor key, `manifestAssetCount` from the 10s health check) trigger
 *   an immediate sync; the poll is the backstop floor.
 * - Every URL carries `?port=` from the store.
 */

import { useSyncExternalStore } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { manifestKey, planManifestSync, readManifestChecksum } from '@/lib/pof-bridge/manifest-feed';
import type { AssetManifest } from '@/types/pof-bridge';

interface UseManifestResult {
  manifest: AssetManifest | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

type BridgeState = ReturnType<typeof usePofBridgeStore.getState>;

/** Key of the editor the store says we are connected to (null when unknown). */
const currentKeyOf = (s: BridgeState) => manifestKey(s.pofPort, s.pluginInfo?.projectName);
/** Key the cached manifest was fetched under; an unkeyed entry self-identifies by its project. */
const cachedKeyOf = (s: BridgeState) =>
  s.manifest ? s.manifestKey ?? manifestKey(s.pofPort, s.manifest.projectName) : null;
/** The store facts that should wake the feed immediately. */
const wakeSignatureOf = (s: BridgeState) =>
  `${s.connectionStatus}|${currentKeyOf(s)}|${s.pluginInfo?.manifestAssetCount ?? ''}`;

// ── The feed (module-level: one per tab) ────────────────────────────────────

interface FeedSnapshot { isLoading: boolean; error: string | null }
interface FullFlight { key: string | null; promise: Promise<void> }

const IDLE_SNAPSHOT: FeedSnapshot = { isLoading: false, error: null };
let snapshot: FeedSnapshot = IDLE_SNAPSHOT;
const listeners = new Set<() => void>();
let holders = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let unsubscribeStore: (() => void) | null = null;
let inflightFull: FullFlight | null = null;
let inflightCheck: Promise<void> | null = null;

function emit(next: Partial<FeedSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function manifestUrl(checksumOnly: boolean): string {
  const port = usePofBridgeStore.getState().pofPort;
  return checksumOnly
    ? `/api/pof-bridge/manifest?checksum-only=true&port=${port}`
    : `/api/pof-bridge/manifest?port=${port}`;
}

function fetchFull(remoteChecksum?: string): Promise<void> {
  const key = currentKeyOf(usePofBridgeStore.getState());
  if (inflightFull && inflightFull.key === key) return inflightFull.promise;

  emit({ isLoading: true, error: null });
  const flight: FullFlight = { key, promise: Promise.resolve() };
  flight.promise = (async () => {
    const result = await tryApiFetch<AssetManifest>(manifestUrl(false));
    if (inflightFull !== flight) return; // a newer flight owns the cache and the snapshot
    inflightFull = null;

    const latest = usePofBridgeStore.getState();
    const now = currentKeyOf(latest);
    if (key && now && now !== key) {
      emit({ isLoading: false }); // an answer for an editor we are no longer connected to
      return;
    }
    if (result.ok) {
      const data = result.data;
      latest.setManifest(
        data,
        data.checksumSha256 || remoteChecksum,
        key ?? manifestKey(latest.pofPort, data.projectName),
      );
      emit({ isLoading: false, error: null });
    } else {
      emit({ isLoading: false, error: result.error });
    }
  })();
  inflightFull = flight;
  return flight.promise;
}

function checkChecksum(): Promise<void> {
  if (inflightCheck) return inflightCheck;
  inflightCheck = (async () => {
    const result = await tryApiFetch<{ checksumSha256: string }>(manifestUrl(true));
    inflightCheck = null;
    // Checksum errors are silent: the connection may be flapping; the next tick retries.
    if (result.ok) await sync(readManifestChecksum(result.data));
  })();
  return inflightCheck;
}

function sync(remoteChecksum?: string | null): Promise<void> {
  const s = usePofBridgeStore.getState();
  const plan = planManifestSync({
    status: s.connectionStatus,
    currentKey: currentKeyOf(s),
    cachedKey: cachedKeyOf(s),
    hasManifest: s.manifest !== null,
    cachedChecksum: s.manifestChecksum,
    remoteChecksum,
  });
  switch (plan) {
    case 'clear-then-fetch':
      s.clearManifest();
      return fetchFull();
    case 'fetch-full':
      return fetchFull(remoteChecksum ?? undefined);
    case 'check':
      return checkChecksum();
    default:
      return Promise.resolve();
  }
}

/** Take a share of the feed; the first holder starts it, the last release stops it. */
function acquireManifestFeed(): () => void {
  holders += 1;
  if (holders === 1) {
    let signature = wakeSignatureOf(usePofBridgeStore.getState());
    unsubscribeStore = usePofBridgeStore.subscribe((state) => {
      const next = wakeSignatureOf(state);
      if (next === signature) return;
      signature = next;
      void sync();
    });
    interval = setInterval(() => { void sync(); }, UI_TIMEOUTS.pofManifestPoll);
    void sync();
  }
  return () => {
    holders -= 1;
    if (holders > 0) return;
    if (interval) clearInterval(interval);
    interval = null;
    unsubscribeStore?.();
    unsubscribeStore = null;
  };
}

function subscribeManifestFeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getFeedSnapshot = () => snapshot;
const getServerFeedSnapshot = () => IDLE_SNAPSHOT;
const refreshManifest = () => fetchFull();

export function useManifest(): UseManifestResult {
  const manifest = usePofBridgeStore((s) => s.manifest);
  const cachedKey = usePofBridgeStore(cachedKeyOf);
  const currentKey = usePofBridgeStore(currentKeyOf);
  const isConnected = usePofBridgeStore((s) => s.connectionStatus === 'connected');
  const feed = useSyncExternalStore(subscribeManifestFeed, getFeedSnapshot, getServerFeedSnapshot);

  // Visible holders only: a hidden LRU pane releases its share of the poll.
  useSuspendableEffect(() => acquireManifestFeed(), []);

  return {
    // Never serve another editor's manifest; while no editor is known, the last one stands.
    manifest: currentKey && cachedKey !== currentKey ? null : manifest,
    isLoading: feed.isLoading,
    error: feed.error,
    refresh: refreshManifest,
    isConnected,
  };
}
