'use client';

/**
 * React hook for the PoF Bridge asset manifest.
 *
 * Fetches the full manifest on mount (if connected), then polls every 30s for
 * checksum changes. Only fetches the full manifest when the checksum differs,
 * keeping network usage low during idle periods.
 *
 * Caches the manifest in pofBridgeStore so other hooks/components can read it
 * without re-fetching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { AssetManifest } from '@/types/pof-bridge';

interface UseManifestResult {
  manifest: AssetManifest | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

export function useManifest(): UseManifestResult {
  const manifest = usePofBridgeStore((s) => s.manifest);
  const manifestChecksum = usePofBridgeStore((s) => s.manifestChecksum);
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);
  const setManifest = usePofBridgeStore((s) => s.setManifest);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const checksumRef = useRef(manifestChecksum);
  checksumRef.current = manifestChecksum;

  const isConnected = connectionStatus === 'connected';

  // ── Fetch full manifest ─────────────────────────────────────────────────────

  const fetchFullManifest = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await tryApiFetch<AssetManifest>('/api/pof-bridge/manifest');

    if (!mountedRef.current) return;

    if (result.ok) {
      setManifest(result.data, result.data.checksumSha256);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }, [setManifest]);

  // ── Check checksum for changes ──────────────────────────────────────────────

  const pollChecksum = useCallback(async () => {
    const result = await tryApiFetch<{ checksumSha256: string }>(
      '/api/pof-bridge/manifest?checksum-only=true',
    );

    if (!mountedRef.current) return;

    if (result.ok) {
      const remote = result.data.checksumSha256;
      if (remote && remote !== checksumRef.current) {
        // Checksum changed — fetch the full manifest
        await fetchFullManifest();
      }
    }
    // Silently ignore checksum poll errors (connection may be temporarily lost)
  }, [fetchFullManifest]);

  // ── Initial fetch when connected ────────────────────────────────────────────

  useEffect(() => {
    if (!isConnected) return;

    // Only fetch if we don't already have a cached manifest
    if (!manifest) {
      fetchFullManifest();
    }
  }, [isConnected, manifest, fetchFullManifest]);

  // ── Periodic checksum polling ───────────────────────────────────────────────

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      pollChecksum();
    }, UI_TIMEOUTS.pofManifestPoll);

    return () => clearInterval(interval);
  }, [isConnected, pollChecksum]);

  return {
    manifest,
    isLoading,
    error,
    refresh: fetchFullManifest,
    isConnected,
  };
}
