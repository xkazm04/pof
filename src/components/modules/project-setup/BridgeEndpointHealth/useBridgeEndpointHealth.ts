import { useState, useCallback } from 'react';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { logger } from '@/lib/logger';
import { SUBSYSTEMS, MAX_LATENCY_SAMPLES } from './constants';
import type { EndpointDef, EndpointHealth } from './types';

export function useBridgeEndpointHealth() {
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

  return {
    host, rcPort, setHost, setRcPort, pofPort, setPofPort, connectionStatus,
    collapsed, health, latencyHistory, pinging, showSettings, setShowSettings,
    toggleCollapse, pingAll,
    isDisconnected, healthyCount, checkedCount,
  };
}
