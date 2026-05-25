'use client';

import { useState, useCallback } from 'react';
import {
  Network, ChevronDown, ChevronRight, RefreshCw, Loader2,
  Database, TestTube, Camera, Cpu, Activity, Settings, Radio,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ConnectionStatusBadge, type ConnectionStatus } from '@/components/ui/ConnectionStatusBadge';
import { ErrorBanner } from './ErrorBanner';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  ACCENT_CYAN, ACCENT_EMERALD, ACCENT_VIOLET, ACCENT_ORANGE,
  OPACITY_8, OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import { logger } from '@/lib/logger';

// ── Endpoint catalog (from PofHttpServer.cpp) ───────────────────────────────

type HttpMethod = 'GET' | 'POST';

interface EndpointDef {
  method: HttpMethod;
  path: string;
  description: string;
}

interface SubsystemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  endpoints: EndpointDef[];
  /** If true, the subsystem is declared but not yet implemented in the C++ plugin. */
  notIntegrated?: boolean;
}

const SUBSYSTEMS: SubsystemDef[] = [
  {
    id: 'status',
    label: 'Status',
    icon: Activity,
    color: ACCENT_EMERALD,
    endpoints: [
      { method: 'GET', path: '/pof/status', description: 'Plugin version, engine info, editor state' },
    ],
  },
  {
    id: 'manifest',
    label: 'Manifest',
    icon: Database,
    color: ACCENT_CYAN,
    endpoints: [
      { method: 'GET', path: '/pof/manifest', description: 'Full asset manifest (or ?checksum-only)' },
      { method: 'GET', path: '/pof/manifest/blueprint', description: 'Single blueprint by ?path=' },
    ],
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube,
    color: ACCENT_VIOLET,
    endpoints: [
      { method: 'POST', path: '/pof/test/run', description: 'Submit test spec for execution' },
      { method: 'GET', path: '/pof/test/results', description: 'Retrieve all test results' },
      { method: 'POST', path: '/pof/test/run-automation', description: 'Run UE5 automation tests' },
    ],
  },
  {
    id: 'snapshots',
    label: 'Snapshots',
    icon: Camera,
    color: ACCENT_ORANGE,
    endpoints: [
      { method: 'POST', path: '/pof/snapshot/capture', description: 'Capture snapshot presets' },
      { method: 'POST', path: '/pof/snapshot/baseline', description: 'Save baseline snapshots' },
      { method: 'GET', path: '/pof/snapshot/diff', description: 'Get snapshot diff report' },
    ],
  },
  {
    id: 'compile',
    label: 'Compile',
    icon: Cpu,
    color: ACCENT_EMERALD,
    endpoints: [
      { method: 'POST', path: '/pof/compile/live', description: 'Trigger live coding hot-reload' },
      { method: 'GET', path: '/pof/compile/status', description: 'Poll current compile status' },
      { method: 'POST', path: '/pof/compile/hot-patch', description: 'Write + compile + verify + auto-revert' },
      { method: 'GET', path: '/pof/compile/hot-patch/status', description: 'Poll hot-patch pipeline status' },
    ],
  },
  {
    id: 'live-state',
    label: 'Live State (WS)',
    icon: Radio,
    color: ACCENT_VIOLET,
    endpoints: [
      { method: 'GET', path: '/pof/live', description: 'WebSocket endpoint for bidirectional live state sync' },
    ],
    notIntegrated: false,
  },
];

// ── Health state ────────────────────────────────────────────────────────────

type HealthStatus = 'unknown' | 'healthy' | 'error' | 'timeout';

interface EndpointHealth {
  status: HealthStatus;
  statusCode?: number;
  responseMs?: number;
  lastChecked?: number;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: ACCENT_EMERALD,
  POST: ACCENT_CYAN,
};

function healthDotColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return STATUS_SUCCESS;
    case 'error': return STATUS_ERROR;
    case 'timeout': return STATUS_WARNING;
    default: return STATUS_NEUTRAL;
  }
}

// ── Latency sparkline ─────────────────────────────────────────────────────────

/** Samples retained per endpoint in the latency ring buffer. */
const MAX_LATENCY_SAMPLES = 30;
/** Inline sparkline canvas size (px). */
const SPARK_W = 60;
const SPARK_H = 16;

/** Map a single latency reading (ms) to a semantic gradient color. */
function latencyColor(ms: number): string {
  if (ms < 150) return STATUS_SUCCESS;
  if (ms < 750) return STATUS_WARNING;
  return STATUS_ERROR;
}

/** Median of a non-empty numeric list (used for the baseline reference). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Inline 60×16 latency sparkline. Plots the per-endpoint ring buffer as a
 * gradient-filled trend line colored by the latest sample, over a faint dashed
 * baseline at the median so spikes and dropouts read at a glance.
 */
function LatencySparkline({ samples, gradientId }: { samples: number[]; gradientId: string }) {
  if (samples.length === 0) return null;

  const latest = samples[samples.length - 1];
  const color = latencyColor(latest);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  const n = samples.length;

  // x: spread samples across the width (centered when a single sample exists).
  const xFor = (i: number) => (n <= 1 ? SPARK_W / 2 : (i / (n - 1)) * SPARK_W);
  // y: invert so higher latency sits higher; 1.5px padding keeps the line/dot in-bounds.
  const yFor = (v: number) => SPARK_H - ((v - min) / range) * (SPARK_H - 3) - 1.5;

  const linePts = samples.map((v, i) => `${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const medY = yFor(median(samples)).toFixed(1);
  const lastX = xFor(n - 1).toFixed(1);
  const lastY = yFor(latest).toFixed(1);

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={`Latency trend: latest ${latest}ms across last ${n} ping${n === 1 ? '' : 's'}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* faint median baseline — spikes read as deviations from this line */}
      <line
        x1={0} y1={medY} x2={SPARK_W} y2={medY}
        stroke={STATUS_NEUTRAL} strokeOpacity={0.5} strokeWidth={0.75} strokeDasharray="2 2"
      />
      {n > 1 && (
        <>
          <polygon points={`0,${SPARK_H} ${linePts} ${SPARK_W},${SPARK_H}`} fill={`url(#${gradientId})`} />
          <polyline
            points={linePts}
            fill="none"
            stroke={color}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 1.5px ${color})` }}
          />
        </>
      )}
      <circle cx={lastX} cy={lastY} r={1.5} fill={color} />
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function BridgeEndpointHealth() {
  const host = useUE5BridgeStore((s) => s.host);
  const rcPort = useUE5BridgeStore((s) => s.httpPort);
  const setHost = useUE5BridgeStore((s) => s.setHost);
  const setRcPort = useUE5BridgeStore((s) => s.setHttpPort);
  const pofPort = usePofBridgeStore((s) => s.pofPort);
  const setPofPort = usePofBridgeStore((s) => s.setPofPort);
  const pofAuthToken = usePofBridgeStore((s) => s.pofAuthToken);
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [health, setHealth] = useState<Record<string, EndpointHealth>>({});
  /** Per-path ring buffer of the last MAX_LATENCY_SAMPLES response times (ms). */
  const [latencyHistory, setLatencyHistory] = useState<Record<string, number[]>>({});
  const [pinging, setPinging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pingEndpoint = useCallback(async (ep: EndpointDef): Promise<EndpointHealth> => {
    const baseUrl = `http://${host}:${pofPort}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const start = performance.now();

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pofAuthToken) headers['X-Pof-Auth-Token'] = pofAuthToken;

      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        signal: controller.signal,
        headers,
        ...(ep.method === 'POST' ? { body: '{}' } : {}),
      });

      const ms = Math.round(performance.now() - start);
      return {
        status: res.ok ? 'healthy' : 'error',
        statusCode: res.status,
        responseMs: ms,
        lastChecked: Date.now(),
      };
    } catch (e) {
      const ms = Math.round(performance.now() - start);
      const isTimeout = e instanceof DOMException && e.name === 'AbortError';
      return {
        status: isTimeout ? 'timeout' : 'error',
        responseMs: ms,
        lastChecked: Date.now(),
      };
    } finally {
      clearTimeout(timer);
    }
  }, [host, pofPort, pofAuthToken]);

  const pingAll = useCallback(async () => {
    setPinging(true);
    const results: Record<string, EndpointHealth> = {};

    for (const subsystem of SUBSYSTEMS) {
      for (const ep of subsystem.endpoints) {
        let result: EndpointHealth;
        try {
          result = await pingEndpoint(ep);
        } catch {
          result = { status: 'error', lastChecked: Date.now() };
        }
        results[ep.path] = result;
        // Update progressively
        setHealth((prev) => ({ ...prev, [ep.path]: result }));
        // Append the latest reading to the per-path ring buffer (keep last N).
        if (result.responseMs !== undefined) {
          setLatencyHistory((prev) => {
            const buf = prev[ep.path] ?? [];
            return { ...prev, [ep.path]: [...buf, result.responseMs!].slice(-MAX_LATENCY_SAMPLES) };
          });
        }
      }
    }

    setPinging(false);
    logger.info('[BridgeHealth] Ping complete:', Object.keys(results).length, 'endpoints');
  }, [pingEndpoint]);

  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';
  const healthyCount = Object.values(health).filter((h) => h.status === 'healthy').length;
  const checkedCount = Object.keys(health).length;

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="bridge-endpoint-health-panel" role="region" aria-label="Bridge Endpoints">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_10}` }}
        >
          <Network className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text">Bridge Endpoints</h3>
            <ConnectionStatusBadge status={connectionStatus as ConnectionStatus} />
          </div>
          <p className="text-2xs text-text-muted" aria-live="polite">
            <span className="font-mono" style={{ color: ACCENT_EMERALD }}>:{pofPort}</span>
            <span className="mx-1">/pof</span>
            &middot;
            <span className="font-mono ml-1" style={{ color: ACCENT_CYAN }}>:{rcPort}</span>
            <span className="mx-1">/remote</span>
            {checkedCount > 0 && (
              <span className="ml-1">
                &middot; <span style={{ color: healthyCount === checkedCount ? STATUS_SUCCESS : STATUS_WARNING }}>{healthyCount}/{checkedCount} healthy</span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={`p-1.5 rounded-md text-xs transition-colors border border-border/40 ${showSettings ? 'bg-white/5' : 'hover:bg-white/5'}`}
          style={{ color: ACCENT_CYAN }}
          title="Connection settings"
          data-testid="bridge-settings-toggle-btn"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={pingAll}
          disabled={pinging || isDisconnected}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                     border border-border/40 transition-colors
                     enabled:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: ACCENT_CYAN }}
          data-testid="bridge-ping-all-btn"
        >
          {pinging ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {pinging ? 'Pinging...' : 'Ping All'}
        </button>
      </div>

      {/* Connection Settings */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-border/40 space-y-3" style={{ backgroundColor: `${ACCENT_CYAN}${OPACITY_8}` }} data-testid="bridge-connection-settings">
          {/* Host */}
          <div className="flex items-center gap-3">
            <label htmlFor="beh-host" className="text-xs font-bold text-text-muted uppercase tracking-wider w-20 shrink-0">Host</label>
            <input
              id="beh-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="flex-1 px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
              placeholder="127.0.0.1"
              data-testid="bridge-host-input"
            />
          </div>

          {/* Two-port row */}
          <div className="grid grid-cols-2 gap-3">
            {/* PoF Bridge Port */}
            <div className="space-y-1" data-testid="bridge-pof-port-field">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT_EMERALD }} />
                <label htmlFor="beh-pof-port" className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT_EMERALD }}>
                  PoF Bridge Port
                </label>
              </div>
              <input
                id="beh-pof-port"
                type="number"
                min={1024}
                max={65535}
                value={pofPort}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 65535) setPofPort(v);
                }}
                className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
                data-testid="bridge-pof-port-input"
              />
              <p className="text-2xs text-text-muted">
                PofHttpServer &mdash; serves <span className="font-mono text-text">/pof/*</span> routes (default: 30040)
              </p>
            </div>

            {/* Remote Control Port */}
            <div className="space-y-1" data-testid="bridge-rc-port-field">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ACCENT_CYAN }} />
                <label htmlFor="beh-rc-port" className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT_CYAN }}>
                  Remote Control Port
                </label>
              </div>
              <input
                id="beh-rc-port"
                type="number"
                min={1024}
                max={65535}
                value={rcPort}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 65535) setRcPort(v);
                }}
                className="w-full px-2 py-1 rounded text-xs font-mono bg-background border border-border/40 text-text focus:outline-none focus:border-[color:var(--focus-border)]"
                data-testid="bridge-rc-port-input"
              />
              <p className="text-2xs text-text-muted">
                UE5 Web Remote Control &mdash; serves <span className="font-mono text-text">/remote/*</span> routes (default: 30010)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disconnected banner */}
      {isDisconnected && (
        <ErrorBanner message="Bridge not connected — connect to ping endpoints" className="mx-4 my-2" />
      )}

      {/* Subsystem groups */}
      <div className="divide-y divide-border/20">
        {SUBSYSTEMS.map((subsystem) => {
          const SubIcon = subsystem.icon;
          const isOpen = !collapsed.has(subsystem.id);
          const groupHealthy = subsystem.endpoints.filter((ep) => health[ep.path]?.status === 'healthy').length;
          const groupChecked = subsystem.endpoints.filter((ep) => health[ep.path]).length;

          return (
            <div key={subsystem.id}>
              {/* Group header */}
              <button
                onClick={() => toggleCollapse(subsystem.id)}
                aria-expanded={isOpen}
                aria-controls={`beh-group-${subsystem.id}`}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/3 transition-colors"
                data-testid={`bridge-group-${subsystem.id}-toggle`}
              >
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-text-muted" />
                  : <ChevronRight className="w-3 h-3 text-text-muted" />
                }
                <span style={{ color: subsystem.notIntegrated ? STATUS_NEUTRAL : subsystem.color }}><SubIcon className="w-3.5 h-3.5" /></span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: subsystem.notIntegrated ? STATUS_NEUTRAL : subsystem.color }}>
                  {subsystem.label}
                </span>
                {subsystem.notIntegrated && (
                  <span
                    className="text-2xs font-medium px-1.5 py-0.5 rounded"
                    style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_15}` }}
                    data-testid={`bridge-group-${subsystem.id}-not-integrated`}
                  >
                    Not Integrated
                  </span>
                )}
                <span className="text-2xs text-text-muted">{subsystem.endpoints.length}</span>

                {groupChecked > 0 && (
                  <span className="ml-auto text-2xs font-mono" style={{ color: groupHealthy === groupChecked ? STATUS_SUCCESS : STATUS_WARNING }}>
                    {groupHealthy}/{groupChecked}
                  </span>
                )}
              </button>

              {/* Endpoints */}
              {isOpen && (
                <div id={`beh-group-${subsystem.id}`} role="region" aria-label={subsystem.label} className={`pb-1${subsystem.notIntegrated ? ' opacity-50' : ''}`}>
                  {subsystem.endpoints.map((ep) => {
                    const h = health[ep.path];
                    const dotColor = h ? healthDotColor(h.status) : STATUS_NEUTRAL;
                    const samples = latencyHistory[ep.path] ?? [];
                    return (
                      <div
                        key={ep.path}
                        className="flex items-center gap-2.5 px-4 pl-10 py-1.5 group hover:bg-white/3 transition-colors"
                        data-testid={`bridge-endpoint-${ep.path.replaceAll('/', '-').slice(1)}`}
                      >
                        {/* Health dot */}
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          role="img"
                          aria-label={`Status: ${h?.status ?? 'unknown'}`}
                          style={{
                            backgroundColor: dotColor,
                            boxShadow: h?.status === 'healthy' ? `0 0 6px ${dotColor}` : 'none',
                          }}
                        />

                        {/* Method badge */}
                        <span
                          className="text-2xs font-bold font-mono w-8 shrink-0"
                          style={{ color: METHOD_COLORS[ep.method] }}
                        >
                          {ep.method}
                        </span>

                        {/* Path */}
                        <span className="text-xs font-mono text-text truncate">{ep.path}</span>

                        {/* Description (hover) */}
                        <span className="text-2xs text-text-muted truncate opacity-0 group-hover:opacity-100 transition-opacity ml-auto hidden lg:block max-w-[200px]">
                          {ep.description}
                        </span>

                        {/* Response metrics */}
                        {h && (
                          <span className="flex items-center gap-2 shrink-0 ml-auto">
                            {h.statusCode && (
                              <span
                                className="text-2xs font-mono px-1 rounded"
                                style={{
                                  color: h.statusCode < 400 ? STATUS_SUCCESS : STATUS_ERROR,
                                  backgroundColor: h.statusCode < 400 ? `${STATUS_SUCCESS}${OPACITY_15}` : `${STATUS_ERROR}${OPACITY_15}`,
                                }}
                              >
                                {h.statusCode}
                              </span>
                            )}
                            {h.responseMs !== undefined && (
                              <span className="flex items-center gap-1.5">
                                {samples.length > 0 && (
                                  <LatencySparkline
                                    samples={samples}
                                    gradientId={`beh-spark-${ep.path.replaceAll('/', '-').slice(1)}`}
                                  />
                                )}
                                <span className="text-2xs font-mono text-text-muted w-12 text-right tabular-nums">
                                  {h.responseMs}ms
                                </span>
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
