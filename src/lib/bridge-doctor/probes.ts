/**
 * Bridge Doctor — channel probes
 *
 * Independent reachability checks for each of the three UE bridge channels:
 *   - PoF Bridge HTTP        (default 30040, GET /pof/status)
 *   - Remote Control HTTP    (default 30010, GET /remote/info)
 *   - WS live-state          (default 30041, ws://.../pof/live)
 *
 * Each probe classifies its outcome into a small `ProbeFailureKind` so the
 * remediation layer can map it to a plain-language fix without parsing
 * free-form error strings.
 */

import { logger } from '@/lib/logger';

// ── Channel and outcome model ───────────────────────────────────────────────

export type ChannelId = 'pof-bridge' | 'remote-control' | 'ws-live-state';

export type ProbeFailureKind =
  | 'editor-not-running' // TCP refused — typically the editor isn't up
  | 'timeout'            // no response in time — port forwarded but no listener, firewall
  | 'auth-rejected'      // HTTP 401/403 — token missing or wrong
  | 'plugin-disabled'    // HTTP 404 — listener answers but the route doesn't exist
  | 'wrong-port'         // HTTP responded with non-JSON / wrong content
  | 'http-error'         // any other non-2xx HTTP status
  | 'unknown';           // anything we couldn't classify

export interface ProbeOk {
  channel: ChannelId;
  ok: true;
  latencyMs: number;
  /** Channel-specific server-supplied details (version, project name, …). */
  details?: Record<string, unknown>;
}

export interface ProbeError {
  channel: ChannelId;
  ok: false;
  latencyMs: number;
  kind: ProbeFailureKind;
  /** Verbatim message from the underlying transport for power users. */
  rawError: string;
  /** HTTP status, if applicable. */
  httpStatus?: number;
}

export type ProbeResult = ProbeOk | ProbeError;

export interface ProbeConfig {
  host: string;
  pofPort: number;
  rcPort: number;
  wsPort: number;
  authToken?: string;
  /** Per-probe time budget. Shorter than the live-client timeouts on purpose
   *  so the Doctor stays responsive even when the editor is offline. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

// ── HTTP helper ─────────────────────────────────────────────────────────────

interface HttpProbeArgs {
  channel: ChannelId;
  url: string;
  timeoutMs: number;
  authToken?: string;
  /** Required substring in the (parsed) JSON when present, to detect
   *  "something else is listening on the port" cases. */
  expectKeys?: readonly string[];
}

async function httpProbe({
  channel,
  url,
  timeoutMs,
  authToken,
  expectKeys,
}: HttpProbeArgs): Promise<ProbeResult> {
  const started = nowMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers['X-Pof-Auth-Token'] = authToken;

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, headers });
    const latencyMs = Math.round(nowMs() - started);

    if (res.ok) {
      let details: Record<string, unknown> | undefined;
      try {
        const body = (await res.json()) as Record<string, unknown>;
        details = body;
        if (expectKeys && expectKeys.length > 0) {
          const hit = expectKeys.some((k) => k in body);
          if (!hit) {
            return {
              channel,
              ok: false,
              latencyMs,
              kind: 'wrong-port',
              rawError: `Got 200 OK but payload missing expected keys: ${expectKeys.join(', ')}`,
              httpStatus: res.status,
            };
          }
        }
      } catch {
        return {
          channel,
          ok: false,
          latencyMs,
          kind: 'wrong-port',
          rawError: 'Got 200 OK but body was not valid JSON',
          httpStatus: res.status,
        };
      }
      return { channel, ok: true, latencyMs, details };
    }

    const text = await safeReadText(res);
    const kind: ProbeFailureKind =
      res.status === 401 || res.status === 403
        ? 'auth-rejected'
        : res.status === 404
          ? 'plugin-disabled'
          : 'http-error';

    return {
      channel,
      ok: false,
      latencyMs,
      kind,
      rawError: `HTTP ${res.status}: ${truncate(text)}`,
      httpStatus: res.status,
    };
  } catch (e) {
    const latencyMs = Math.round(nowMs() - started);

    if (e instanceof DOMException && e.name === 'AbortError') {
      return {
        channel,
        ok: false,
        latencyMs,
        kind: 'timeout',
        rawError: `Timed out after ${timeoutMs}ms`,
      };
    }

    return {
      channel,
      ok: false,
      latencyMs,
      kind: classifyNetworkError(e),
      rawError: errorMessage(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Public probe entry points ───────────────────────────────────────────────

export async function probePofBridge(cfg: ProbeConfig): Promise<ProbeResult> {
  return httpProbe({
    channel: 'pof-bridge',
    url: `http://${cfg.host}:${cfg.pofPort}/pof/status`,
    timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    authToken: cfg.authToken,
    expectKeys: ['pluginVersion', 'engineVersion'] as const,
  });
}

export async function probeRemoteControl(cfg: ProbeConfig): Promise<ProbeResult> {
  return httpProbe({
    channel: 'remote-control',
    url: `http://${cfg.host}:${cfg.rcPort}/remote/info`,
    timeoutMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    // Remote Control has no auth header model in PoF's setup.
    expectKeys: undefined,
  });
}

/**
 * Probe the WebSocket live-state channel by attempting a real `ws://` open.
 *
 * Strategy:
 *   - In browsers (`globalThis.WebSocket`), open a socket and resolve on the
 *     first `open` / `error` / `close` event or timeout.
 *   - In Node test environments, fall back to a TCP-style HTTP probe that will
 *     correctly classify timeout / refused since the WS port won't answer the
 *     HTTP upgrade attempt.
 */
export async function probeWsLiveState(cfg: ProbeConfig): Promise<ProbeResult> {
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const WS = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (typeof WS !== 'function') {
    // Headless / Node — best-effort HTTP probe (the server will refuse or 426).
    return httpProbe({
      channel: 'ws-live-state',
      url: `http://${cfg.host}:${cfg.wsPort}/pof/live`,
      timeoutMs,
    });
  }

  return new Promise<ProbeResult>((resolve) => {
    const started = nowMs();
    let settled = false;
    const url = `ws://${cfg.host}:${cfg.wsPort}/pof/live`;

    let sock: WebSocket;
    try {
      sock = new WS(url);
    } catch (e) {
      resolve({
        channel: 'ws-live-state',
        ok: false,
        latencyMs: Math.round(nowMs() - started),
        kind: 'unknown',
        rawError: errorMessage(e),
      });
      return;
    }

    const done = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      try {
        // Tear down; the socket isn't meant to outlive the probe.
        sock.onopen = null;
        sock.onerror = null;
        sock.onclose = null;
        sock.close();
      } catch {
        // ignore — already-closed sockets throw on close()
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({
        channel: 'ws-live-state',
        ok: false,
        latencyMs: timeoutMs,
        kind: 'timeout',
        rawError: `WebSocket did not open within ${timeoutMs}ms`,
      });
    }, timeoutMs);

    sock.onopen = () => {
      clearTimeout(timer);
      done({
        channel: 'ws-live-state',
        ok: true,
        latencyMs: Math.round(nowMs() - started),
      });
    };

    sock.onerror = () => {
      clearTimeout(timer);
      done({
        channel: 'ws-live-state',
        ok: false,
        latencyMs: Math.round(nowMs() - started),
        kind: 'editor-not-running',
        rawError: 'WebSocket error before open — likely no listener on the port',
      });
    };

    sock.onclose = (ev) => {
      if (settled) return;
      clearTimeout(timer);
      done({
        channel: 'ws-live-state',
        ok: false,
        latencyMs: Math.round(nowMs() - started),
        kind: ev.code === 1006 ? 'editor-not-running' : 'unknown',
        rawError: `WebSocket closed before open (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`,
      });
    };
  });
}

// ── Aggregate API ───────────────────────────────────────────────────────────

export interface DiagnosticsReport {
  startedAt: string;
  finishedAt: string;
  config: ProbeConfig;
  channels: Record<ChannelId, ProbeResult>;
  allGreen: boolean;
}

/** Run all three probes concurrently and return a single report. */
export async function runDiagnostics(cfg: ProbeConfig): Promise<DiagnosticsReport> {
  const startedAt = new Date().toISOString();
  logger.info('[Bridge-Doctor] Running diagnostics on', cfg.host);

  const [pof, rc, ws] = await Promise.all([
    probePofBridge(cfg),
    probeRemoteControl(cfg),
    probeWsLiveState(cfg),
  ]);

  const channels: Record<ChannelId, ProbeResult> = {
    'pof-bridge': pof,
    'remote-control': rc,
    'ws-live-state': ws,
  };
  const allGreen = pof.ok && rc.ok && ws.ok;

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    config: cfg,
    channels,
    allGreen,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unknown error';
}

function classifyNetworkError(e: unknown): ProbeFailureKind {
  const msg = errorMessage(e).toLowerCase();
  if (msg.includes('refused') || msg.includes('econnrefused')) return 'editor-not-running';
  if (msg.includes('not found') || msg.includes('enotfound')) return 'editor-not-running';
  if (msg.includes('failed to fetch')) return 'editor-not-running';
  return 'unknown';
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function truncate(s: string, max = 160): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
