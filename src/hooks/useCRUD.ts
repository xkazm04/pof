'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useIsMounted } from '@/hooks/useIsMounted';

export interface UseCRUDOptions<T> {
  /** Transform raw API response into the state value. Defaults to identity. */
  transform?: (raw: unknown) => T;
  /** Custom fetcher that replaces the default apiFetch(endpoint) call. Use for dual-fetch or tryApiFetch patterns. */
  fetcher?: () => Promise<T>;
  /** Error message shown when fetch fails. */
  errorMessage?: string;
  /** Skip auto-fetch on mount (useful when you need to call refetch manually). */
  skipInitialFetch?: boolean;
  /**
   * When the endpoint changes, report `initial` until the new endpoint answers instead of
   * the previous endpoint's data. Off by default: existing callers keep the old data.
   */
  resetOnEndpointChange?: boolean;
}

export interface UseCRUDResult<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch data from the endpoint. */
  refetch: () => Promise<void>;
  /** Alias for refetch. */
  retry: () => void;
  /**
   * Perform a mutation (POST/PUT/DELETE) then auto-refetch. Returns the parsed
   * response, or `null` if the mutation failed (the reason is exposed on
   * `mutationError` so callers can surface it instead of failing silently).
   */
  mutate: <R = unknown>(url: string, init?: RequestInit) => Promise<R | null>;
  /** Reason the last `mutate` call failed (`null` when the last one succeeded). */
  mutationError: string | null;
  /** Clear a surfaced `mutationError` (e.g. when the user dismisses the banner). */
  clearMutationError: () => void;
}

/**
 * Generic data-fetching hook with mounted-ref safety, loading/error states,
 * and a `mutate` helper that auto-refetches after success.
 *
 * @param endpoint  The GET endpoint to fetch data from.
 * @param initial   The initial (empty) state value before first fetch.
 * @param options   Optional transform, error message, etc.
 */
export function useCRUD<T>(
  endpoint: string,
  initial: T,
  options: UseCRUDOptions<T> = {},
): UseCRUDResult<T> {
  const { transform, fetcher, errorMessage, skipInitialFetch, resetOnEndpointChange } = options;
  const [loaded, setLoaded] = useState<{ endpoint: string; value: T }>({ endpoint, value: initial });
  const data = resetOnEndpointChange && loaded.endpoint !== endpoint ? initial : loaded.value;
  const [isLoading, setIsLoading] = useState(!skipInitialFetch);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const isMounted = useIsMounted();
  // Last request wins: a slow response for a previous endpoint never lands over the current one.
  const latestRequestRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    const isCurrent = () => isMounted() && requestId === latestRequestRef.current;
    setIsLoading(true);
    setError(null);
    try {
      let result: T;
      if (fetcher) {
        result = await fetcher();
      } else {
        const raw = await apiFetch<unknown>(endpoint);
        result = transform ? transform(raw) : raw as T;
      }
      if (!isCurrent()) return;
      setLoaded({ endpoint, value: result });
    } catch (err) {
      if (isCurrent()) {
        setError(err instanceof Error ? err.message : (errorMessage ?? 'Failed to fetch data'));
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [endpoint, transform, fetcher, errorMessage, isMounted]);

  useEffect(() => {
    if (!skipInitialFetch) refetch();
  }, [refetch, skipInitialFetch]);

  const clearMutationError = useCallback(() => setMutationError(null), []);

  const mutate = useCallback(async <R = unknown>(url: string, init?: RequestInit): Promise<R | null> => {
    if (isMounted()) setMutationError(null);
    try {
      const result = await apiFetch<R>(url, init);
      await refetch();
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Action failed. Please try again.';
      logger.error('useCRUD mutate error', { url, err: reason });
      if (isMounted()) setMutationError(reason);
      return null;
    }
  }, [refetch, isMounted]);

  return { data, isLoading, error, refetch, retry: refetch, mutate, mutationError, clearMutationError };
}
