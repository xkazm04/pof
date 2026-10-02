/**
 * Module Scan tab — a Re-Scan says what is new, what is still there and what
 * the scan no longer finds; resolutions come from (and go to) the server, so a
 * reload keeps them; a scan whose report never arrived says so.
 *
 * `fetch` is a small stateful fake of `/api/module-scan/import`; the CLI hook is
 * mocked so a test can fire the scan's `onComplete` itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import type { ScanDelta, ScanFinding } from '@/types/scan';

const onCompletes: Record<string, (success: boolean) => void> = {};
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (success: boolean) => void }) => {
    if (opts.onComplete) onCompletes[opts.sessionKey] = opts.onComplete;
    return { execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false };
  },
}));

const { useModuleStore } = await import('@/stores/moduleStore');
const { useScanTab } = await import('@/components/modules/core-engine/ScanTab/useScanTab');
const { ScanTab } = await import('@/components/modules/core-engine/ScanTab');

const MODULE = 'arpg-combat' as const;

function finding(id: string, over: Partial<ScanFinding> = {}): ScanFinding {
  return {
    id, pass: 'structure', category: `Cat ${id}`, severity: 'high', file: `Source/${id}.cpp`, line: null,
    description: `Issue ${id}`, suggestedFix: 'fix', effort: 'small', foundAt: '2026-09-01T00:00:00.000Z', ...over,
  };
}

interface FakeServer { findings: ScanFinding[]; delta: ScanDelta | null; patches: { ids: string[]; resolved: boolean }[] }
let server: FakeServer;

function installFetch() {
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) }) as Response;
    if (init?.method === 'PATCH') {
      const p = JSON.parse(String(init.body)) as { ids: string[]; resolved: boolean };
      server.patches.push({ ids: p.ids, resolved: p.resolved });
      const stamp = p.resolved ? '2026-09-29T12:00:00.000Z' : undefined;
      server.findings = server.findings.map((f) => (p.ids.includes(f.id) ? { ...f, resolvedAt: stamp } : f));
      if (server.delta) {
        const drop = (xs: string[]) => xs.filter((x) => !p.ids.includes(x));
        server.delta = { ...server.delta, prior: drop(server.delta.prior), cleared: drop(server.delta.cleared), persisting: drop(server.delta.persisting) };
      }
      return body({ moduleId: MODULE, updated: p.ids.length, missing: [] });
    }
    if (u.startsWith('/api/module-scan/import')) {
      return body({ moduleId: MODULE, findings: server.findings, delta: server.delta });
    }
    throw new Error(`unexpected fetch ${u}`);
  }) as typeof fetch;
}

beforeEach(() => {
  server = { findings: [], delta: null, patches: [] };
  useModuleStore.setState({ scanResults: {} });
  installFetch();
});
afterEach(cleanup);

describe('useScanTab — resolutions come from the server', () => {
  it('a finding the DB reports resolved is resolved, even if this session held it active', async () => {
    // As left by an earlier mount in this session (before it was resolved elsewhere).
    useModuleStore.setState({ scanResults: { [MODULE]: [finding('x')] } });
    server.findings = [finding('x', { resolvedAt: '2026-09-28T10:00:00.000Z' })];

    const { result } = renderHook(() => useScanTab(MODULE));
    await waitFor(() => expect(result.current.resolvedFindings.map((f) => f.id)).toEqual(['x']));
    expect(result.current.activeFindings).toEqual([]);
  });

  it('a scan that finished with no scan recorded after dispatch is "unrecorded", not the old delta', async () => {
    const old: ScanDelta = {
      scan: { scanId: 'scan-arpg-combat-5', moduleId: MODULE, passes: ['structure'], findingCount: 1, createdAt: '2026-01-01T00:00:00.000Z' },
      prior: [], new: ['old-0'], persisting: [], cleared: [], notRescanned: [],
    };
    server.findings = [finding('old-0')];
    server.delta = old;

    const { result } = renderHook(() => useScanTab(MODULE));
    await waitFor(() => expect(result.current.deltaState.status).toBe('recorded'));

    act(() => { result.current.startScan(); });
    await act(async () => { onCompletes[`${MODULE}-scan`](true); });

    await waitFor(() => expect(result.current.deltaState.status).toBe('unrecorded'));
    const state = result.current.deltaState;
    expect(state.status === 'unrecorded' && state.reason).toBe('the scan finished but its report was not recorded');
  });
});

describe('ScanDelta — the Re-Scan summary', () => {
  it('shows the three counts and resolves the no-longer-found group in ONE PATCH', async () => {
    server.findings = [
      finding('n1'), finding('m1'), finding('m2'),
      finding('p1'), finding('p2'), finding('c1'), finding('c2'),
    ];
    server.delta = {
      scan: { scanId: 'scan-arpg-combat-9', moduleId: MODULE, passes: ['structure'], findingCount: 3, createdAt: '2026-09-29T11:00:00.000Z' },
      prior: ['p1', 'p2', 'c1', 'c2'], new: ['n1'], persisting: ['p1', 'p2'], cleared: ['c1', 'c2'], notRescanned: [],
    };

    render(<ScanTab moduleId={MODULE} />);
    expect(await screen.findByText('1 new · 2 still present · 2 no longer found')).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByText('Resolve 2 no longer found')); });

    await waitFor(() => expect(server.patches).toHaveLength(1));
    expect(server.patches[0]).toEqual({ ids: ['c1', 'c2'], resolved: true });

    const toggle = await screen.findByText('2 resolved findings');
    fireEvent.click(toggle);
    expect(screen.getByText('Cat c1: Issue c1')).toBeTruthy();
    expect(screen.getByText('Cat c2: Issue c2')).toBeTruthy();
    expect(server.patches).toHaveLength(1);
  });
});
