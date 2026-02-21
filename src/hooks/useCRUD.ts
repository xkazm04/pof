'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/api-utils';

export interface UseCRUDOptions<T> {
  /** Transform raw API response into the state value. Defaults to identity. */
  transform?: (raw: unknown) => T;
  /** Custom fetcher that replaces the default apiFetch(endpoint) call. Use for dual-fetch or tryApiFetch patterns. */
  fetcher?: () => Promise<T>;
  /** Error message shown when fetch fails. */
  errorMessage?: string;
  /** Skip auto-fetch on mount (useful when you need to call refetch manually). */
  skipInitialFetch?: boolean;
}

export interface UseCRUDResult<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch data from the endpoint. */
  refetch: () => Promise<void>;
  /** Alias for refetch. */
  retry: () => void;
  /** Perform a mutation (POST/PUT/DELETE) then auto-refetch. Returns the parsed response. */
  mutate: <R = unknown>(url: string, init?: RequestInit) => Promise<R | null>;
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
  const { transform, fetcher, errorMessage, skipInitialFetch } = options;
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(!skipInitialFetch);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refetch = useCallback(async () => {
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
      if (!mountedRef.current) return;
      setData(result);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : (errorMessage ?? 'Failed to fetch data'));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [endpoint, transform, fetcher, errorMessage]);

  useEffect(() => {
    if (!skipInitialFetch) refetch();
  }, [refetch, skipInitialFetch]);

  const mutate = useCallback(async <R = unknown>(url: string, init?: RequestInit): Promise<R | null> => {
    try {
      const result = await apiFetch<R>(url, init);
      await refetch();
      return result;
    } catch (err) {
      console.error('useCRUD mutate error:', err);
      return null;
    }
  }, [refetch]);

  return { data, isLoading, error, refetch, retry: refetch, mutate };
}
