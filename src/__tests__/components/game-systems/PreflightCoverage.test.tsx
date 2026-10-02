import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { PreflightPanel, type PreflightStatusSummary } from '@/components/modules/game-systems/PreflightPanel';
import type { PreflightCheckResult, PreflightStatus } from '@/lib/packaging/preflight';
import { BuildConfigSelector } from '@/components/modules/game-systems/BuildConfigSelector';
import { useProjectStore } from '@/stores/projectStore';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

// BuildConfigSelector render case: CookProgress is the component that POSTs
// /api/packaging/execute, and it does so exactly when it receives a request — so
// the captured request list IS the execute-POST record. Unrelated siblings stubbed.
const cooks = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }));
vi.mock('@/components/modules/game-systems/CookProgress', () => ({
  CookProgress: ({ request }: { request: Record<string, unknown> | null }) => {
    if (request && !cooks.requests.includes(request)) cooks.requests.push(request);
    return null;
  },
}));
vi.mock('@/components/modules/game-systems/SmokeTest', () => ({ SmokeTest: () => null }));
vi.mock('@/components/modules/game-systems/NightlyBuildScheduler', () => ({ NightlyBuildScheduler: () => null }));
vi.mock('@/components/modules/game-systems/GateNotifySettings', () => ({ GateNotifySettings: () => null }));

/**
 * The pre-flight verdict must name its own coverage: on mount only the FAST
 * checks run, so a green header that reads plain "ready" is claiming a
 * shipping-build and content-validation verdict that was never measured
 * (ai-registry game-production/ship-pipeline-gating — absence of measurement is
 * its own status, never a pass).
 */
function mockFastPass() {
  const body: { results: PreflightCheckResult[]; overall: PreflightStatus } = {
    results: [
      { id: 'config-sanity', label: 'Config sanity', status: 'pass', detail: 'ok', issues: [] },
      { id: 'with-editor-audit', label: 'Plugin WITH_EDITOR audit', status: 'pass', detail: 'ok', issues: [] },
    ],
    overall: 'pass',
  };
  const mock = vi.fn().mockImplementation(() => {
    const payload = { success: true, data: body };
    return Promise.resolve({
      ok: true, status: 200,
      json: () => Promise.resolve(payload),
      text: () => Promise.resolve(JSON.stringify(payload)),
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

const props = { projectPath: 'C:\Proj\PoF', projectName: 'PoF', ueVersion: '5.8.0' };

describe('PreflightPanel — the verdict names its coverage', () => {
  it('does not claim an unqualified "ready" when only the fast checks ran', async () => {
    mockFastPass();
    render(<PreflightPanel {...props} />);
    const overall = await screen.findByTestId('pof-preflight-overall');
    await waitFor(() => expect(overall.getAttribute('data-status')).toBe('pass'));
    expect(overall.textContent?.trim()).not.toBe('ready');
    expect(overall.textContent).toContain('not run');
    expect(overall.getAttribute('data-coverage')).toBe('2/4');
  });

  it('enumerates every known check, with an explicit not-run state for the unrun ones', async () => {
    mockFastPass();
    render(<PreflightPanel {...props} />);
    await screen.findByTestId('pof-preflight-check-config-sanity');
    for (const id of ['build-verify-editor', 'build-verify-shipping', 'asset-validation']) {
      const tile = screen.getByTestId(`pof-preflight-check-${id}`);
      expect(tile.getAttribute('data-status')).toBe('not-run');
      expect(tile.textContent?.toLowerCase()).toContain('not run');
    }
  });

  it('reports the unrun cook-relevant checks to the parent gate', async () => {
    mockFastPass();
    const seen: PreflightStatusSummary[] = [];
    render(<PreflightPanel {...props} onStatusChange={(s) => { seen.push(s); }} />);
    await waitFor(() => expect(seen.some((s) => s.overall === 'pass')).toBe(true));
    const last = seen[seen.length - 1];
    expect(last.canCook).toBe(true);
    expect(last.fullyCovered).toBe(false);
    expect(last.notRunLabels).toEqual(['Build verify (Shipping)', 'Asset validation']);
    expect(last.coverage).toEqual({ ran: 2, total: 4 });
  });
});

describe('PreflightPanel — map plumbing drives a real check', () => {
  it('sends the profile maps the cook will ship, not a dead mapName', async () => {
    const fetchMock = mockFastPass();
    render(<PreflightPanel {...props} cookMaps={['/Game/Maps/VerticalSlice']} cookProfileName="Win64 Shipping" />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(0));
    const body = fetchMock.mock.calls[0][1]?.body as string;
    expect(JSON.parse(body).mapsToInclude).toEqual(['/Game/Maps/VerticalSlice']);
  });

  it('declares no prop that drives no check — `mapName` is gone from the panel', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'src/components/modules/game-systems/PreflightPanel.tsx'),
      'utf-8',
    );
    expect(src).not.toContain('mapName');
  });
});

describe('BuildConfigSelector — Package gates the profile you press', () => {
  const FAST_PASS = {
    results: [
      { id: 'config-sanity', label: 'Config sanity', status: 'pass', detail: 'ok', issues: [] },
      { id: 'with-editor-audit', label: 'Plugin WITH_EDITOR audit', status: 'pass', detail: 'ok', issues: [] },
    ],
    overall: 'pass',
  };
  const profileOf = (id: string, maps: string[], isDefault: boolean) => ({
    ...createDefaultProfile('Win64'), id, name: `Profile ${id}`, isDefault,
    cookSettings: { ...createDefaultProfile('Win64').cookSettings, mapsToInclude: maps },
  });

  it("press Package on profile B -> no cook until B's own gate settles, and the pre-flight measured B's maps", async () => {
    cooks.requests = [];
    useProjectStore.setState({ projectPath: 'C:/Proj/PoF', projectName: 'PoF', ueVersion: '5.8' });
    const preflightMaps: string[][] = [];
    let releaseB: (() => void) | null = null;
    const ok = (data: unknown) => {
      const body = { success: true, data };
      return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
    };
    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/packaging/profiles')) {
        return Promise.resolve(ok({ profiles: [profileOf('A', ['/Game/Maps/A'], true), profileOf('B', ['/Game/Maps/B'], false)] }));
      }
      if (String(url).includes('/api/packaging/preflight')) {
        const maps = JSON.parse(String(init?.body)).mapsToInclude as string[];
        preflightMaps.push(maps);
        if (maps.includes('/Game/Maps/B')) {
          return new Promise((resolve) => { releaseB = () => resolve(ok(FAST_PASS)); });
        }
        return Promise.resolve(ok(FAST_PASS));
      }
      return Promise.resolve(ok({}));
    }) as unknown as typeof fetch;

    render(<BuildConfigSelector />);
    // The default profile A's gate has settled green before anything is pressed.
    await waitFor(() => expect(preflightMaps.some((m) => m.includes('/Game/Maps/A'))).toBe(true));
    await waitFor(() => expect(screen.getByTestId('pof-preflight-panel').getAttribute('data-overall')).toBe('pass'));
    expect(preflightMaps.some((m) => m.includes('/Game/Maps/B'))).toBe(false);

    fireEvent.click(await screen.findByTestId('pof-module-packaging-start-cook-B'));
    await waitFor(() => expect(preflightMaps.some((m) => m.includes('/Game/Maps/B'))).toBe(true));
    // A's green verdict does not release B's cook.
    expect(cooks.requests).toEqual([]);

    releaseB!();
    await waitFor(() => expect(cooks.requests.length).toBe(1));
    expect(cooks.requests[0]).toMatchObject({ profileId: 'B' });
    expect(preflightMaps[preflightMaps.length - 1]).toEqual(['/Game/Maps/B']);
  });
});
