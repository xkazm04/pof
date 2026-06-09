'use client';

import { useState, useCallback } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { ok, type Result } from '@/types/result';
import type { AssetResult } from '@/lib/blender-mcp/types';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { captureViewportSnapshot } from '@/lib/blender-mcp/snapshot';
import {
  mergeAssetResults,
  assetKey,
  DEFAULT_POLYHAVEN_RESOLUTION,
  type PolyHavenResolution,
} from '@/lib/blender-mcp/assetBrowser';

interface AssetSearchResponse {
  assets: AssetResult[];
}

/** Lift a `{ assets }` envelope Result into a bare `AssetResult[]` Result. */
function unwrapAssets(
  r: Result<AssetSearchResponse, string>,
): Result<AssetResult[], string> {
  return r.ok ? ok(r.data.assets ?? []) : r;
}

export interface UseAssetBrowser {
  // Query controls
  query: string;
  setQuery: (q: string) => void;
  category: string | null;
  setCategory: (c: string | null) => void;
  resolution: PolyHavenResolution;
  setResolution: (r: PolyHavenResolution) => void;
  // Search state
  results: AssetResult[];
  isSearching: boolean;
  hasSearched: boolean;
  searchError: string | null;
  searchWarning: string | null;
  search: () => Promise<void>;
  // Import state
  importingKey: string | null;
  importedKeys: ReadonlySet<string>;
  importError: string | null;
  importAsset: (asset: AssetResult) => Promise<void>;
}

/**
 * Orchestrates the Asset Browser: a single query fans out to PolyHaven +
 * Sketchfab in parallel, results merge via {@link mergeAssetResults}, and a
 * one-click import POSTs to the download endpoint then auto-captures a viewport
 * snapshot so the user sees the asset land in-scene (best-effort — a snapshot
 * failure never masks a successful import).
 */
export function useAssetBrowser(): UseAssetBrowser {
  const addScreenshot = useBlenderMCPStore((s) => s.addScreenshot);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [resolution, setResolution] = useState<PolyHavenResolution>(
    DEFAULT_POLYHAVEN_RESOLUTION,
  );

  const [results, setResults] = useState<AssetResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);

  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    setSearchWarning(null);
    setImportError(null);

    const q = query.trim();
    const poly = new URLSearchParams({ source: 'polyhaven' });
    if (q) poly.set('query', q);
    if (category) poly.set('category', category);
    const sketch = new URLSearchParams({ source: 'sketchfab' });
    if (q) sketch.set('query', q);

    const [polyRes, sketchRes] = await Promise.all([
      tryApiFetch<AssetSearchResponse>(`/api/blender-mcp/assets?${poly}`),
      tryApiFetch<AssetSearchResponse>(`/api/blender-mcp/assets?${sketch}`),
    ]);

    const outcome = mergeAssetResults(
      unwrapAssets(polyRes),
      unwrapAssets(sketchRes),
    );
    setResults(outcome.assets);
    setSearchError(outcome.error);
    setSearchWarning(outcome.warning);
    setHasSearched(true);
    setIsSearching(false);
  }, [query, category]);

  const importAsset = useCallback(
    async (asset: AssetResult) => {
      const key = assetKey(asset);
      setImportingKey(key);
      setImportError(null);

      const body: Record<string, unknown> = {
        source: asset.source,
        id: asset.id,
      };
      // Resolution only applies to PolyHaven downloads.
      if (asset.source === 'polyhaven') body.resolution = resolution;

      const result = await tryApiFetch<{ objectName: string }>(
        '/api/blender-mcp/assets/download',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (result.ok) {
        setImportedKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        // Auto-capture so the import is visible in the embedded viewport.
        const shot = await captureViewportSnapshot();
        if (shot.ok) addScreenshot(shot.data);
      } else {
        setImportError(`${asset.name || asset.id}: ${result.error}`);
      }
      setImportingKey(null);
    },
    [resolution, addScreenshot],
  );

  return {
    query,
    setQuery,
    category,
    setCategory,
    resolution,
    setResolution,
    results,
    isSearching,
    hasSearched,
    searchError,
    searchWarning,
    search,
    importingKey,
    importedKeys,
    importError,
    importAsset,
  };
}
