/**
 * Shared test utilities for the PoF test suite.
 *
 * Provides:
 *   - localStorage mock (required by Zustand persist)
 *   - fetch mock factory (for API route tests)
 *   - Zustand store reset helper
 */

import { afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { StoreApi } from 'zustand';

// ─── localStorage mock ───────────────────────────────────────────────────────

const storage: Record<string, string> = {};

export const localStorageMock = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v; },
  removeItem: (k: string) => { delete storage[k]; },
  clear: () => { for (const k of Object.keys(storage)) delete storage[k]; },
  get length() { return Object.keys(storage).length; },
  key: (i: number) => Object.keys(storage)[i] ?? null,
};

// Install globally if not already present
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
}

// ─── fetch mock factory ──────────────────────────────────────────────────────

export interface MockFetchOptions {
  /** Response body (will be JSON.stringified). Default: { success: true, data: {} } */
  body?: unknown;
  /** HTTP status code. Default: 200 */
  status?: number;
  /** Whether the response .ok flag should be true. Default: inferred from status */
  ok?: boolean;
}

/**
 * Install a global fetch mock that returns the given response.
 * Returns the mock function for assertions.
 *
 * Usage:
 *   const fetchMock = mockFetch({ body: { success: true, data: [1,2,3] } });
 *   // ... call code that uses fetch ...
 *   expect(fetchMock).toHaveBeenCalledWith('/api/foo', expect.anything());
 */
export function mockFetch(options: MockFetchOptions = {}): ReturnType<typeof vi.fn> {
  const {
    body = { success: true, data: {} },
    status = 200,
    ok = status >= 200 && status < 300,
  } = options;

  const mock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/**
 * Install a fetch mock that returns different responses per URL pattern.
 * Routes are checked in order; first match wins. Unmatched URLs return 404.
 */
export function mockFetchRoutes(
  routes: Array<{ match: string | RegExp; response: MockFetchOptions }>,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockImplementation((url: string) => {
    for (const route of routes) {
      const matches = typeof route.match === 'string'
        ? url.includes(route.match)
        : route.match.test(url);
      if (matches) {
        const { body = { success: true, data: {} }, status = 200, ok = status >= 200 && status < 300 } = route.response;
        return Promise.resolve({
          ok,
          status,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        });
      }
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ success: false, error: 'Not found' }),
      text: () => Promise.resolve('Not found'),
    });
  });

  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

// ─── Zustand store reset helper ──────────────────────────────────────────────

/**
 * Reset a Zustand store to a given partial state before each test.
 * Automatically registers a beforeEach hook.
 *
 * Usage:
 *   resetStoreBeforeEach(useMyStore, { count: 0, items: [] });
 */
export function resetStoreBeforeEach<T extends object>(
  store: StoreApi<T>,
  initialState: Partial<T>,
): void {
  beforeEach(() => {
    store.setState(initialState as T);
  });
}

// ─── Provider input images ───────────────────────────────────────────────────

/**
 * `runner-dispatch.ts` (`writeTemp`) writes each image-to-3d input to the OS temp dir as
 * `pof_<provider>_in_<stamp>.<ext>` / `pof_tripo_mv_<slot>_<stamp>.<ext>` for the provider job to
 * read. The job is mocked in the generate-route tests, so nothing ever consumes or removes the
 * file. Remove, after each test file, exactly the files of that shape written since the file
 * started (the mtime floor keeps another run's or the dev server's files out of reach).
 */
const PROVIDER_INPUT = /^pof_(?:[a-z0-9]+_in|tripo_mv_(?:front|back|left|right))_\d+\.(?:png|jpe?g|webp)$/;
const fileStartedMs = Date.now() - 1000;

afterAll(() => {
  if (process.env.KEEP_TMP === '1') return;
  const dir = os.tmpdir();
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) {
    if (!PROVIDER_INPUT.test(name)) continue;
    const file = path.join(dir, name);
    try {
      if (fs.lstatSync(file).mtimeMs >= fileStartedMs) fs.rmSync(file, { force: true });
    } catch { /* raced away or in use: a backstop, never a failure */ }
  }
});
