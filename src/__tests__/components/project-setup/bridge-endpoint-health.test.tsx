/**
 * Bridge Endpoints: a side-effect-free route monitor, mounted in Project Setup.
 *
 * "Ping All" used to fetch every catalog route with its own method — six POSTs
 * of '{}' to compile/live (a real Live Coding request), snapshot/capture (a real
 * HighResShot), test/run-automation (outside the drain lease)… — and probed the
 * /pof/live WebSocket over HTTP on the wrong port. The monitor now executes the
 * declared route table's probe plan through the Bridge Doctor's GET-only prober.
 *
 * Pinned here (acceptance cases 1, 3, 4, 6, 8 of ue5-bridge-monitoring/A):
 *   1. mutating routes are never probed: Ping All issues 0 non-GET requests;
 *   3. a route that needs an argument is "not probed", outside every count;
 *   4. /pof/live is resolved over ws:// on wsPort, never fetched on pofPort;
 *   6. failures carry the Doctor's ProbeFailureKind, not a bare 'error';
 *   8. mounted in Project Setup, and nothing touches the bridge before the click.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, renderHook, act, fireEvent, waitFor } from '@testing-library/react';
import type { ChecklistItem, ScanState } from '@/components/modules/project-setup/useProjectScan';

const { scanResult } = vi.hoisted(() => ({
  scanResult: {
    current: {
      engines: [{ version: '5.8.0', path: 'C:/UE_5.8' }] as Array<{ version: string; path: string }>,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: true, detail: 'PoF.uproject' }] as ChecklistItem[],
      projectFiles: [] as string[],
      scanning: false,
      scanState: 'settled' as ScanState,
      scan: vi.fn(),
      hasProject: true,
      okCount: 1,
      missingToolCount: 0,
    },
  },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ sendPrompt: vi.fn(), execute: () => Promise.resolve(), isRunning: false }),
}));

vi.mock('@/components/modules/project-setup/useProjectScan', () => ({
  useProjectScan: () => scanResult.current,
}));

import { POF_ROUTES, planRouteProbe } from '@/lib/pof-bridge/routes';
import { useBridgeEndpointHealth } from '@/components/modules/project-setup/BridgeEndpointHealth/useBridgeEndpointHealth';
import { BridgeEndpointHealth } from '@/components/modules/project-setup/BridgeEndpointHealth';
import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { useProjectStore } from '@/stores/projectStore';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';

// ── Fake WebSocket: opens on the next tick, records where it was pointed ─────

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send() {}
  close() {}
}

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

/** fetch spy: 200 JSON by default, `overrides` maps a URL substring -> status. */
function installFetch(overrides: Record<string, number> = {}) {
  calls = [];
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const hit = Object.keys(overrides).find((k) => url.includes(k));
    const status = hit ? overrides[hit] : 200;
    const body = url.includes('/api/') ? { success: true, data: {} } : { ok: true };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  }) as unknown as typeof fetch;
}

const bridgeCalls = () => calls.filter((c) => /:3004[01]\b/.test(c.url));

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeWebSocket;
  installFetch();
  useProjectStore.setState({ projectPath: 'C:/proj/PoF', projectName: 'PoF', ueVersion: '5.8.0' });
  useUE5BridgeStore.setState({ host: '127.0.0.1', wsPort: 30041, wsStatus: 'disconnected' });
  usePofBridgeStore.setState({ pofPort: 30040, pofAuthToken: '', connectionStatus: 'connected' });
});

afterEach(() => cleanup());

async function pingAllViaHook() {
  const { result } = renderHook(() => useBridgeEndpointHealth());
  await act(async () => { await result.current.pingAll(); });
  return result;
}

describe('case 1 — mutating routes are never probed', () => {
  it('every mutates route plans not-probed; Ping All sends 0 non-GET requests', async () => {
    const mutating = POF_ROUTES.filter((r) => r.effect === 'mutates').map((r) => r.path).sort();
    expect(mutating).toEqual([
      '/pof/compile/hot-patch', '/pof/compile/live', '/pof/python/run',
      '/pof/snapshot/baseline', '/pof/snapshot/capture',
      '/pof/test/run', '/pof/test/run-automation',
    ]);
    for (const r of POF_ROUTES.filter((x) => x.effect === 'mutates')) {
      expect(planRouteProbe(r)).toEqual({ kind: 'not-probed', reason: 'mutates' });
    }

    await pingAllViaHook();
    expect(bridgeCalls().length).toBeGreaterThan(0);
    const nonGet = calls.filter((c) => (c.init?.method ?? 'GET').toUpperCase() !== 'GET');
    expect(nonGet).toEqual([]);
    expect(calls.filter((c) => c.init?.body !== undefined)).toEqual([]);
  });
});

describe('case 3 — a route that needs an argument is not probed and not counted', () => {
  it('blueprint plans needs-argument, is never fetched, and sits outside the header counts', async () => {
    expect(planRouteProbe(POF_ROUTES.find((r) => r.path === '/pof/manifest/blueprint')!))
      .toEqual({ kind: 'not-probed', reason: 'needs-argument' });

    render(<BridgeEndpointHealth />);
    fireEvent.click(screen.getByTestId('bridge-ping-all-btn'));
    const probed = POF_ROUTES.filter((r) => planRouteProbe(r).kind !== 'not-probed').length;
    const skipped = POF_ROUTES.length - probed;
    await waitFor(() => {
      expect(screen.getByTestId('bridge-health-counts').textContent)
        .toContain(`${probed}/${probed} probed healthy`);
    });
    expect(screen.getByTestId('bridge-health-counts').textContent).toContain(`${skipped} not probed`);
    expect(calls.some((c) => c.url.includes('/pof/manifest/blueprint'))).toBe(false);
    const row = screen.getByTestId('bridge-endpoint-pof-manifest-blueprint');
    expect(row.getAttribute('data-probe')).toBe('not-probed');
    expect(row.textContent).toMatch(/needs an argument/i);
  });
});

describe('case 4 — /pof/live is a WebSocket on wsPort', () => {
  it('resolved through ws:// on :30041; never fetched on :30040', async () => {
    const result = await pingAllViaHook();
    expect(FakeWebSocket.instances.map((w) => w.url)).toContain('ws://127.0.0.1:30041/pof/live');
    expect(calls.some((c) => c.url.includes(':30040/pof/live'))).toBe(false);
    expect(result.current.health['/pof/live']?.status).toBe('healthy');
  });
});

describe("case 6 — failures carry the Doctor's ProbeFailureKind", () => {
  it('404 -> plugin-disabled, 401 -> auth-rejected', async () => {
    installFetch({ '/pof/test/results': 404, '/pof/snapshot/diff': 401 });
    const result = await pingAllViaHook();
    expect(result.current.health['/pof/test/results']).toMatchObject({ status: 'error', kind: 'plugin-disabled', statusCode: 404 });
    expect(result.current.health['/pof/snapshot/diff']).toMatchObject({ status: 'error', kind: 'auth-rejected', statusCode: 401 });
  });
});

describe('case 8 — mounted in Project Setup; probing stays an explicit click', () => {
  it('panel present with a project, 0 bridge requests until Ping All is clicked', async () => {
    render(<ProjectSetupModule />);
    expect(screen.getByTestId('bridge-endpoint-health-panel')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(bridgeCalls()).toEqual([]);
    expect(FakeWebSocket.instances.filter((w) => w.url.includes(':30041'))).toEqual([]);

    fireEvent.click(screen.getByTestId('bridge-ping-all-btn'));
    await waitFor(() => expect(calls.some((c) => c.url.includes(':30040/pof/status'))).toBe(true));
  });
});
