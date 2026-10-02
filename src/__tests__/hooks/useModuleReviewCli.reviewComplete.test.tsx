/**
 * After a successful CLI review the review results are ALREADY in the DB: the
 * review prompt forbids writing files ("Do NOT write any files to disk — submit
 * results using the callback format below") and its callback POSTs the rows to
 * /api/feature-matrix/import. The hook used to POST a second, DISK-mode import
 * ({ moduleId, projectPath }) that reads <projectPath>/.pof/matrix/<id>.json —
 * a file the prompt makes impossible — so every successful review ended in a
 * 404 "Review results not found" error toast.
 *
 * Now onComplete(true) only refetches and toasts what the review MOVED (the
 * history route's per-feature delta), 'warning' when something regressed.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '../setup';

afterEach(cleanup);

const h = vi.hoisted(() => ({
  onComplete: new Map<string, (success: boolean) => void>(),
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (opts: { sessionKey: string; onComplete?: (success: boolean) => void }) => {
    if (opts.onComplete) h.onComplete.set(opts.sessionKey, opts.onComplete);
    return { execute: vi.fn(), isRunning: false };
  },
}));
vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));

import { useModuleReviewCli } from '@/hooks/useModuleReviewCli';
import { useProjectStore } from '@/stores/projectStore';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

const PROJECT = 'C:/Users/me/Unreal Projects/PoF';

beforeEach(() => {
  h.onComplete.clear();
  useProjectStore.setState({ projectPath: PROJECT });
});

const REGRESSED_DELTA = {
  measured: true,
  fromReviewedAt: '2026-09-01T00:00:00.000Z',
  toReviewedAt: '2026-09-02T00:00:00.000Z',
  regressed: [{ featureName: 'Dodge roll', from: 'implemented', to: 'partial' }],
  improved: [],
  qualityDropped: [],
  qualityRaised: [],
  assessed: [],
  cleared: [],
  added: [],
  removed: [],
};

function setup(delta: unknown) {
  const fetchMock = mockFetchRoutes([
    { match: '/api/feature-matrix/history', response: { body: { success: true, data: { snapshots: [], projectId: 'x', delta } } } },
    {
      match: '/api/feature-matrix/import',
      response: { status: 404, body: { success: false, error: 'Review results not found at C:/x/.pof/matrix/arpg-audio.json' } },
    },
  ]);
  const onToast = vi.fn();
  const { result } = renderHook(() =>
    useModuleReviewCli({ moduleId: 'audio', moduleLabel: 'Audio', accentColor: STATUS_SUCCESS, onToast }),
  );
  return { fetchMock, onToast, result };
}

describe('useModuleReviewCli — review completion', () => {
  it('makes NO disk-mode import POST and toasts the delta as a warning when a feature regressed', async () => {
    const { fetchMock, onToast, result } = setup(REGRESSED_DELTA);
    const complete = h.onComplete.get('audio-rv-review');
    expect(complete).toBeDefined();

    await act(async () => { await complete!(true); });

    await waitFor(() => expect(onToast).toHaveBeenCalled());
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/feature-matrix/import'))).toBe(false);
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('1 regressed, 0 improved'), 'warning');
    expect(onToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
    expect(result.current.refetchKey).toBe(1);
  });

  it('a pre-column predecessor toasts its reason, never "0 regressed, 0 improved"', async () => {
    const { onToast } = setup({ measured: false, reason: 'The previous snapshot predates per-feature capture.', fromReviewedAt: 'a', toReviewedAt: 'b' });
    await act(async () => { await h.onComplete.get('audio-rv-review')!(true); });
    await waitFor(() => expect(onToast).toHaveBeenCalled());
    const [message, type] = onToast.mock.calls[0];
    expect(message).toContain('predates');
    expect(message).not.toContain('0 regressed');
    expect(type).toBe('success');
  });

  it('a failed review does nothing', async () => {
    const { fetchMock, onToast } = setup(REGRESSED_DELTA);
    await act(async () => { await h.onComplete.get('audio-rv-review')!(false); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onToast).not.toHaveBeenCalled();
  });
});
