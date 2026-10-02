/**
 * scan-sweep --challenge (module-topology-graph/A): the Nexus Intelligence Map reads
 * its overlays from the durable tables (pattern-library dashboard, persisted deep-eval
 * scans, session_analytics) through `projectNexusSignals`, never from the client
 * stores nothing writes (evaluatorStore.lastScan, moduleStore.moduleHistory /
 * moduleHealth) or the Pattern Library tab's filtered slice. A failed source reads as
 * unavailable with Retry, never as an empty layer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockFetchRoutes } from '@/__tests__/setup';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});
vi.mock('@/hooks/useManifest', () => ({
  useManifest: () => ({ manifest: null, isConnected: false, isLoading: false, error: null, refresh: async () => {} }),
}));

import { NexusView } from '@/components/modules/evaluator/NexusView';
import { useNexusView } from '@/components/modules/evaluator/NexusView/useNexusView';
import { useFeatureStatuses, invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';
import { buildModuleTopology, TOPOLOGY_ROOMY } from '@/lib/topology/moduleGraph';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import { useEvaluatorStore } from '@/stores/evaluatorStore';
import { useModuleStore } from '@/stores/moduleStore';

const STATUSES = [
  { moduleId: 'arpg-combat', featureName: 'core', status: 'implemented' },
];

const LABELS = new Map(buildModuleTopology(new Map(), TOPOLOGY_ROOMY).nodes.map((n) => [n.moduleId as string, n.label]));

function pattern(id: string, moduleId: string, successRate: number) {
  return {
    id, moduleId, title: `pattern ${id}`, category: 'architecture', successRate, sessionCount: 2,
    approach: '', keyFiles: [], tags: [], pitfalls: [], avgDurationMs: 0,
  };
}

const SCAN = {
  scanId: 's1', projectId: '', scannedAt: new Date(1000).toISOString(), timestamp: 1000, durationMs: 0,
  modulesEvaluated: ['arpg-combat'], failedModules: [], totalFindings: 1,
  severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
  findings: [{
    id: 'f-crit', scanId: 's1', moduleId: 'arpg-combat', pass: 'quality', category: 'gas', severity: 'critical',
    file: 'Source/Combat.cpp', line: 7, description: 'Combat crit finding', suggestedFix: 'fix', effort: 'small', timestamp: 0,
  }],
};

function session(id: number, prompt: string, success: boolean) {
  return {
    id, moduleId: 'arpg-combat', sessionKey: `k${id}`, prompt, promptPreview: prompt, hadProjectContext: true,
    promptLength: prompt.length, success, durationMs: 30000, startedAt: '2026-09-30T10:00:00Z', completedAt: '2026-09-30T10:01:00Z',
  };
}

const MODULE_STATS = [{
  moduleId: 'arpg-combat', totalSessions: 3, successCount: 2, failCount: 1, successRate: 2 / 3, avgDurationMs: 30000,
  avgSuccessDurationMs: 0, avgFailDurationMs: 0, contextInjectedCount: 0, contextInjectedSuccessRate: 0,
  noContextCount: 0, noContextSuccessRate: 0,
}];

const ok = (data: unknown) => ({ body: { success: true, data } });

function installRoutes(opts: { dashboardFails?: boolean } = {}) {
  return mockFetchRoutes([
    { match: '/api/feature-matrix/all-statuses', response: ok({ statuses: STATUSES }) },
    { match: '/api/pattern-library', response: ok({ patterns: [pattern('p1', 'arpg-gas', 0.5), pattern('p2', 'arpg-gas', 1)] }) },
    { match: '/api/evaluator/results', response: ok({ scans: [SCAN] }) },
    {
      match: 'action=module',
      response: ok({ sessions: [session(1, 'run one', true), session(2, 'run two', true), session(3, 'run three', false)] }),
    },
    {
      match: '/api/session-analytics',
      response: opts.dashboardFails
        ? { body: { success: false, error: 'analytics db locked' }, status: 500 }
        : ok({ totalSessions: 3, moduleStats: MODULE_STATS }),
    },
  ]);
}

function dashboardCalls(mock: ReturnType<typeof mockFetchRoutes>): number {
  return mock.mock.calls.filter((c) => String(c[0]).includes('/api/session-analytics?action=dashboard')).length;
}

function svgNode(moduleId: string): HTMLElement {
  const svg = document.querySelector('svg[width="100%"]') as SVGSVGElement;
  const label = within(svg as unknown as HTMLElement).getByText(LABELS.get(moduleId)!);
  return label.closest('g') as unknown as HTMLElement;
}

beforeEach(() => {
  invalidateFeatureStatuses();
  // The writer-less / tab-scoped stores Nexus used to read: all empty, as on every page load.
  usePatternLibraryStore.setState({ patterns: [] });
  useEvaluatorStore.setState({ lastScan: null });
  useModuleStore.setState({ moduleHistory: {} });
});
afterEach(cleanup);

describe('NexusView — overlays read durable truth', () => {
  it('pattern badge, deep-dive Recommendations and Recent CLI Sessions come from the API, not the empty stores', async () => {
    installRoutes();
    render(<NexusView />);

    await waitFor(() => expect(within(svgNode('arpg-gas')).getByText('75%')).toBeTruthy());

    fireEvent.click(svgNode('arpg-combat'));

    fireEvent.click(await screen.findByRole('button', { name: /Recommendations/ }));
    expect(await screen.findByText('Combat crit finding')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: /Recent CLI Sessions/ }));
    await screen.findByText('run one');
    expect(screen.getByText('run two')).toBeTruthy();
    expect(screen.getByText('run three')).toBeTruthy();
  });

  it('a failed session-analytics read shows the Session Activity layer as unavailable with Retry, and Retry re-issues it', async () => {
    const fetchMock = installRoutes({ dashboardFails: true });
    render(<NexusView />);

    expect(await screen.findByRole('button', { name: /Session Activity.*unavailable/i })).toBeTruthy();
    const before = dashboardCalls(fetchMock);
    expect(before).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Retry Session Activity/i }));
    await waitFor(() => expect(dashboardCalls(fetchMock)).toBe(before + 1));
  });
});

describe('NexusView source ratchet', () => {
  it('no file under NexusView/ reads the writer-less stores or the Pattern Library tab slice', () => {
    const dir = join(process.cwd(), 'src/components/modules/evaluator/NexusView');
    const hits: string[] = [];
    for (const f of readdirSync(dir)) {
      readFileSync(join(dir, f), 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (/useEvaluatorStore|moduleHistory|moduleHealth|usePatternLibraryStore/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('[guard] useNexusView keeps the topology projection untouched', () => {
  it.each([
    ['no statuses', [] as typeof STATUSES],
    ['some statuses', [...STATUSES, { moduleId: 'arpg-loot', featureName: 'drops', status: 'partial' }]],
  ])('%s: nodes keep the buildModuleTopology placement and counts', async (_name, statuses) => {
    mockFetchRoutes([{ match: '/api/feature-matrix/all-statuses', response: ok({ statuses }) }]);
    const { result } = renderHook(() => ({ fs: useFeatureStatuses(), nx: useNexusView() }));
    await waitFor(() => expect(result.current.fs.loaded).toBe(true));
    const pick = (n: { moduleId: string; cx: number; cy: number; featureCount: number; implementedCount: number; blockedCount: number }) =>
      ({ moduleId: n.moduleId, cx: n.cx, cy: n.cy, featureCount: n.featureCount, implementedCount: n.implementedCount, blockedCount: n.blockedCount });
    expect(result.current.nx.nodes.map(pick)).toEqual(
      buildModuleTopology(result.current.fs.statusMap, TOPOLOGY_ROOMY).nodes.map(pick),
    );
  });
});
