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

/** Readings taken against one connection; the sparkline never mixes two hosts. */
interface Readings {
  connection: string;
  health: Record<string, EndpointHealth>;
  /** Per-path ring buffer of the last MAX_LATENCY_SAMPLES response times (ms). */
  latencyHistory: Record<string, number[]>;
}

const emptyReadings = (connection: string): Readings => ({ connection, health: {}, latencyHistory: {} });

const connectionKey = (host: string, pofPort: number, rcPort: number, wsPort: number, token: string) =>
  [host, pofPort, rcPort, wsPort, token].join('|');

/** The connection the stores hold right now (a run in flight compares against this). */
function liveConnection(): string {
  const { host, httpPort, wsPort } = useUE5BridgeStore.getState();
  const { pofPort, pofAuthToken } = usePofBridgeStore.getState();
  return connectionKey(host, pofPort, httpPort, wsPort, pofAuthToken);
}

export function useBridgeEndpointHealth() {
  const host = useUE5BridgeStore((s) => s.host);
  const rcPort = useUE5BridgeStore((s) => s.httpPort);
  const wsPort = useUE5BridgeStore((s) => s.wsPort);
  const setHost = useUE5BridgeStore((s) => s.setHost);
  const setRcPort = useUE5BridgeStore((s) => s.setHttpPort);
  const setWsPort = useUE5BridgeStore((s) => s.setWsPort);
  const pofPort = usePofBridgeStore((s) => s.pofPort);
  const setPofPort = usePofBridgeStore((s) => s.setPofPort);
  const pofAuthToken = usePofBridgeStore((s) => s.pofAuthToken);
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const connection = connectionKey(host, pofPort, rcPort, wsPort, pofAuthToken);
  const [readings, setReadings] = useState<Readings>(() => emptyReadings(connection));
  // Derived, not reset in an effect: readings from another connection simply are not shown.
  const { health, latencyHistory } = readings.connection === connection ? readings : emptyReadings(connection);
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

    run: for (const subsystem of SUBSYSTEMS) {
      for (const ep of subsystem.endpoints) {
        let result: EndpointHealth | null;
        try {
          result = await pingEndpoint(ep);
        } catch {
          result = { status: 'error', kind: 'unknown', lastChecked: Date.now() };
        }
        // The connection changed under this run: its remaining readings would be about the old one.
        if (liveConnection() !== connection) break run;
        if (!result) continue;
        results[ep.path] = result;
        const reading = result;
        // Update progressively, appending to the per-path ring buffer (keep last N).
        setReadings((prev) => {
          const base = prev.connection === connection ? prev : emptyReadings(connection);
          const buf = base.latencyHistory[ep.path] ?? [];
          return {
            connection,
            health: { ...base.health, [ep.path]: reading },
            latencyHistory: reading.responseMs === undefined
              ? base.latencyHistory
              : { ...base.latencyHistory, [ep.path]: [...buf, reading.responseMs].slice(-MAX_LATENCY_SAMPLES) },
          };
        });
      }
    }

    setPinging(false);
    logger.info('[BridgeHealth] Ping complete:', Object.keys(results).length, 'probed routes');
  }, [pingEndpoint, connection]);

  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';
  const healthyCount = Object.values(health).filter((h) => h.status === 'healthy').length;
  const checkedCount = Object.keys(health).length;

  return {
    host, rcPort, wsPort, setHost, setRcPort, setWsPort, pofPort, setPofPort, connectionStatus,
    collapsed, health, latencyHistory, pinging, showSettings, setShowSettings,
    toggleCollapse, pingAll,
    isDisconnected, healthyCount, checkedCount,
  };
}
