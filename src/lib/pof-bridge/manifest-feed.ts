/**
 * Pure half of the PoF Bridge manifest feed (server-safe: no store, no React).
 *
 * The stateful feed — one refcounted 30s checksum interval per tab, one
 * in-flight request per kind, shared loading/error — lives in
 * `@/hooks/useManifest`, which reads the store. This file holds the decisions
 * both the hook and the `/api/pof-bridge/manifest` route agree on:
 *
 * - {@link readManifestChecksum} — the tolerant checksum read. The plugin
 *   contract answers `{ checksum }` (plugin design doc section 8); the legacy
 *   client shape is `{ checksumSha256 }`. The route normalizes to the latter.
 * - {@link manifestKey} — the cache key: every argument that changes the
 *   answer (bridge port + editor project). A manifest cached under another
 *   key is never served.
 * - {@link planManifestSync} — what the feed does next, given what is cached
 *   and what the connection says.
 */
import type { PofConnectionStatus } from '@/types/pof-bridge';

/** Read a manifest checksum from `{ checksum }` or `{ checksumSha256 }`; anything else is `null`. */
export function readManifestChecksum(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  for (const key of ['checksum', 'checksumSha256'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Cache key of a manifest: `${port}::${projectName}`, or `null` when the editor is unknown. */
export function manifestKey(port: number, projectName: string | null | undefined): string | null {
  return projectName ? `${port}::${projectName}` : null;
}

export type ManifestSyncPlan =
  /** Not connected: fetch nothing, keep whatever is cached. */
  | 'idle'
  /** The cache belongs to another editor: drop it, then fetch in full. */
  | 'clear-then-fetch'
  /** Nothing cached, or the remote checksum moved: fetch in full. */
  | 'fetch-full'
  /** Cached and matching key, remote checksum unknown yet: ask for it. */
  | 'check'
  /** Remote checksum matches (or the plugin gave none): keep the cache. */
  | 'keep';

export interface ManifestSyncInput {
  status: PofConnectionStatus;
  /** Key of the editor we are connected to now (null when the plugin has not said). */
  currentKey: string | null;
  /** Key the cached manifest was fetched under. */
  cachedKey: string | null;
  hasManifest: boolean;
  cachedChecksum: string | null;
  /** `undefined` = not asked yet; `null` = asked, the answer carried none. */
  remoteChecksum?: string | null;
}

export function planManifestSync(input: ManifestSyncInput): ManifestSyncPlan {
  if (input.status !== 'connected') return 'idle';
  if (input.currentKey && input.cachedKey && input.cachedKey !== input.currentKey) {
    return 'clear-then-fetch';
  }
  if (!input.hasManifest) return 'fetch-full';
  if (input.remoteChecksum === undefined) return 'check';
  if (input.remoteChecksum && input.remoteChecksum !== input.cachedChecksum) return 'fetch-full';
  return 'keep';
}
