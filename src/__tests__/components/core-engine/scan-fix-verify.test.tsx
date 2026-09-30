/**
 * Module Scan tab — Fix & verify. A fix run exiting 0 resolves nothing; the
 * operator clicks Verify, ONE module scan runs over the targets' passes, and
 * only the targets that scan no longer finds are resolved (one PATCH). A fix
 * never auto-dispatches a paid scan, and a single-row Fix This goes through
 * the fix session, so it is not counted as a scan.
 *
 * `fetch` is a small stateful fake of `/api/module-scan/import`; the CLI hook is
 * mocked with ONE stable handle per session so a test can tell the scan session
 * from the fix session and fire each one's `onComplete` itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, cleanup, act, fireEvent, waitFor } from '@testing-library/react';
import type { ScanDelta, ScanFinding } from '@/types/scan';
import type { ModuleScanTask } from '@/lib/cli-task';

type Session = { execute: ReturnType<typeof vi.fn>; sendPrompt: ReturnType<typeof vi.fn>; isRunning: boolean };
const { sessions, onCompletes } = vi.hoisted(() => ({
  sessions: {} as Record<'scan' | 'fix', Session>,
  onCompletes: {} as Record<'scan' | 'fix', (success: boolean) => void>,
}));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (success: boolean) => void }) => {
    const kind = opts.sessionKey.endsWith('-fix') ? 'fix' : 'scan';
    if (opts.onComplete) onCompletes[kind] = opts.onComplete;
    sessions[kind] ??= { execute: vi.fn(), sendPrompt: vi.fn(), isRunning: false };
    return sessions[kind];
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
      const stamp = p.resolved ? '2026-09-30T12:00:00.000Z' : undefined;
      server.findings = server.findings.map((f) => (p.ids.includes(f.id) ? { ...f, resolvedAt: stamp } : f));
      return body({ moduleId: MODULE, updated: p.ids.length, missing: [] });
    }
    if (u.startsWith('/api/module-scan/import')) {
      return body({ moduleId: MODULE, findings: server.findings, delta: server.delta });
    }
    throw new Error(`unexpected fetch ${u}`);
  }) as typeof fetch;
}

/** The verification scan's record, created after it was dispatched. */
function recordVerificationScan(over: Partial<ScanDelta>) {
  server.delta = {
    scan: { scanId: 'scan-verify', moduleId: MODULE, passes: ['structure', 'quality'], findingCount: 1, createdAt: new Date(Date.now() + 60_000).toISOString() },
    prior: ['f1', 'f2'], new: [], persisting: [], cleared: [], notRescanned: [], ...over,
  };
}

beforeEach(() => {
  server = { findings: [finding('f1', { pass: 'structure' }), finding('f2', { pass: 'quality' })], delta: null, patches: [] };
  useModuleStore.setState({ scanResults: {} });
  for (const s of Object.values(sessions)) { s.execute.mockClear(); s.sendPrompt.mockClear(); }
  installFetch();
});
afterEach(cleanup);

/** Select f1 + f2, Fix Selected, and complete both fix runs with the given outcomes. */
async function fixBoth(outcomes: [boolean, boolean]) {
  const hook = renderHook(() => useScanTab(MODULE));
  const { result } = hook;
  await waitFor(() => expect(result.current.activeFindings).toHaveLength(2));
  act(() => { result.current.toggleSelectFinding('f1'); result.current.toggleSelectFinding('f2'); });
  act(() => { result.current.startBatchFix(); });
  expect(sessions.fix.sendPrompt).toHaveBeenCalledTimes(1);
  await act(async () => { onCompletes.fix(outcomes[0]); });
  await waitFor(() => expect(sessions.fix.sendPrompt).toHaveBeenCalledTimes(2), { timeout: 3000 });
  await act(async () => { onCompletes.fix(outcomes[1]); });
  return hook;
}

describe('useScanTab — a fix is verified by a re-scan, not by its exit code', () => {
  it('two successful fixes resolve nothing and dispatch no scan; Verify runs ONE scan over their passes', async () => {
    const { result } = await fixBoth([true, true]);

    expect(server.patches).toHaveLength(0);
    expect(sessions.scan.execute).toHaveBeenCalledTimes(0);
    expect(result.current.fixVerification.status).toBe('ready-to-verify');

    act(() => { result.current.verifyFixes(); });
    expect(sessions.scan.execute).toHaveBeenCalledTimes(1);
    const task = sessions.scan.execute.mock.calls[0][0] as ModuleScanTask;
    expect(task.type).toBe('module-scan');
    expect(task.passes).toEqual(['structure', 'quality']);
    expect(result.current.fixVerification.status).toBe('verifying');
  });

  it('the recorded verification scan resolves only what it cleared, in one PATCH; the rest is still present', async () => {
    const { result } = await fixBoth([true, true]);
    act(() => { result.current.verifyFixes(); });

    recordVerificationScan({ cleared: ['f1'], persisting: ['f2'] });
    await act(async () => { onCompletes.scan(true); });

    await waitFor(() => expect(server.patches).toHaveLength(1));
    expect(server.patches[0]).toEqual({ ids: ['f1'], resolved: true });
    await waitFor(() => expect(result.current.activeFindings.map((f) => f.id)).toEqual(['f2']));
    expect(result.current.fixVerification.byId.f2).toBe('still-present');
    expect(result.current.fixVerification.byId.f1).toBe('verified');
    expect(server.patches).toHaveLength(1);
  });

  it('a failed fix run is fix-failed, left out of the verification plan and never PATCHed', async () => {
    const { result } = await fixBoth([true, false]);
    expect(result.current.fixVerification.byId.f2).toBe('fix-failed');

    act(() => { result.current.verifyFixes(); });
    const task = sessions.scan.execute.mock.calls[0][0] as ModuleScanTask;
    expect(task.passes).toEqual(['structure']);
    expect(task.previousFindings).toContain('Issue f1');
    expect(task.previousFindings).not.toContain('Issue f2');

    recordVerificationScan({ cleared: ['f1', 'f2'] });
    await act(async () => { onCompletes.scan(true); });
    await waitFor(() => expect(server.patches).toHaveLength(1));
    expect(server.patches[0]).toEqual({ ids: ['f1'], resolved: true });
    expect(result.current.fixVerification.byId.f2).toBe('fix-failed');
  });

  it('a verification scan with no newer record resolves nothing and says why', async () => {
    const { result } = await fixBoth([true, true]);
    act(() => { result.current.verifyFixes(); });

    await act(async () => { onCompletes.scan(true); });

    await waitFor(() => expect(result.current.fixVerification.status).toBe('unverified'));
    expect(result.current.fixVerification.reason).toBe('the scan finished but its report was not recorded');
    expect(server.patches).toHaveLength(0);
    expect(result.current.activeFindings).toHaveLength(2);
  });
});

describe('ScanTab — single-row Fix This', () => {
  it('goes through the fix session, is not counted as a scan, and dispatches no scan', async () => {
    render(<ScanTab moduleId={MODULE} />);
    fireEvent.click(await screen.findByText('Issue f1'));
    await act(async () => { fireEvent.click(screen.getByText('Fix This')); });

    expect(sessions.fix.sendPrompt).toHaveBeenCalledTimes(1);
    expect(sessions.fix.sendPrompt.mock.calls[0][0]).toContain('Issue f1');
    expect(sessions.scan.sendPrompt).toHaveBeenCalledTimes(0);

    await act(async () => { onCompletes.fix(true); });
    expect(screen.queryByText(/\d+ scans?$/)).toBeNull();
    expect(sessions.scan.execute).toHaveBeenCalledTimes(0);
    expect(server.patches).toHaveLength(0);
  });
});
