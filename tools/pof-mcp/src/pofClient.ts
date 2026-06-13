/**
 * Thin HTTP client for the running PoF Next.js backend.
 *
 * pof-mcp is a thin adapter: every tool proxies to an existing PoF route and this
 * client unwraps the standard `{ success, data } / { success, error }` envelope
 * (mirroring the app's own `tryApiFetch`). It never imports PoF internals — the
 * backend (and its single shared harness orchestrator) is the source of truth.
 */

export class PofApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PofApiError';
  }
}

export interface PofClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
}

const DEFAULT_ORIGIN = 'http://127.0.0.1:3000';

/** Resolve the PoF backend origin: POF_APP_ORIGIN, then PORT, then the dev default. */
export function originFromEnv(env: Record<string, string | undefined> = process.env): string {
  if (env.POF_APP_ORIGIN) return env.POF_APP_ORIGIN.replace(/\/$/, '');
  if (env.PORT) return `http://127.0.0.1:${env.PORT}`;
  return DEFAULT_ORIGIN;
}

export function createPofClient(origin: string = originFromEnv()): PofClient {
  async function request<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${origin}${path}`, {
        method: init?.method ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        ...(init?.body ? { body: init.body } : {}),
      });
    } catch (e) {
      throw new PofApiError(
        `PoF backend not reachable at ${origin} — start the server (npm run dev) or set POF_APP_ORIGIN. ` +
          `(${e instanceof Error ? e.message : String(e)})`,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new PofApiError(`PoF returned a non-JSON response (HTTP ${res.status}) for ${path}`, res.status);
    }

    // Unwrap the { success, data/error } envelope used by every PoF route.
    if (json && typeof json === 'object' && 'success' in json) {
      const env = json as { success: boolean; data?: unknown; error?: string };
      if (env.success) return env.data as T;
      throw new PofApiError(env.error || `PoF request failed (HTTP ${res.status})`, res.status);
    }

    if (!res.ok) throw new PofApiError(`PoF request failed (HTTP ${res.status}) for ${path}`, res.status);
    return json as T;
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  };
}
