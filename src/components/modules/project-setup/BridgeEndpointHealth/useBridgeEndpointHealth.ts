import { useState, useCallback } from 'react';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { logger } from '@/lib/logger';
import { planRouteProbe } from '@/lib/pof-bridge/routes';
import {
  probeHttpRoute, probeWsLiveState, type ProbeConfig, type ProbeResult,
} from '@/lib/bridge-doctor/probes';
import { SUBSYSTEMS, MAX_LATENCY_SAMPLES } from './constants';
import type { EndpointDef, EndpointHealth } from './types';

function toHealth(res: ProbeResult): EndpointHealth {
  const base = { responseMs: res.latencyMs, lastChecked: Date.now() };
  if (res.ok) return { status: 'healthy', ...base };
  return {
    status: res.kind === 'timeout' ? 'timeout' : 'error',
    kind: res.kind,
    statusCode: res.httpStatus,
    ...base,
  };
}

export function useBridgeEndpointHealth() {
  const host = useUE5BridgeStore((s) => s.host);
  const rcPort = useUE5BridgeStore((s) => s.httpPort);
  const wsPort = useUE5BridgeStore((s) => s.wsPort);
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

  /** Execute the route's declared probe plan — GET-only HTTP or the WS open.
   *  Mutating / argument-bound routes are never touched (null = not probed). */
  const pingEndpoint = useCallback(async (ep: EndpointDef): Promise<EndpointHealth | null> => {
    const plan = planRouteProbe(ep);
    if (plan.kind === 'not-probed') return null;
    const cfg: ProbeConfig = { host, pofPort, rcPort, wsPort, authToken: pofAuthToken || undefined };
    const res = plan.kind === 'ws' ? await probeWsLiveState(cfg) : await probeHttpRoute(plan.path, cfg);
    return toHealth(res);
  }, [host, pofPort, rcPort, wsPort, pofAuthToken]);

  const pingAll = useCallback(async () => {
    setPinging(true);
    const results: Record<string, EndpointHealth> = {};

    for (const subsystem of SUBSYSTEMS) {
      for (const ep of subsystem.endpoints) {
        let result: EndpointHealth | null;
        try {
          result = await pingEndpoint(ep);
        } catch {
          result = { status: 'error', kind: 'unknown', lastChecked: Date.now() };
        }
        if (!result) continue;
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
    logger.info('[BridgeHealth] Ping complete:', Object.keys(results).length, 'probed routes');
  }, [pingEndpoint]);

  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';
  const healthyCount = Object.values(health).filter((h) => h.status === 'healthy').length;
  const checkedCount = Object.keys(health).length;

  return {
    host, rcPort, setHost, setRcPort, pofPort, setPofPort, connectionStatus,
    collapsed, health, latencyHistory, pinging, showSettings, setShowSettings,
    toggleCollapse, pingAll,
    isDisconnected, healthyCount, checkedCount,
  };
}
