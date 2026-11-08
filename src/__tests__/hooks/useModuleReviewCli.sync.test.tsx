/**
 * Manual Sync POSTs /api/feature-matrix/import, which answers in the standard
 * `{ success, data }` envelope (`apiSuccess({ imported, ... })`). The hook read
 * `imported` off the ENVELOPE, so every successful sync toasted
 * "Imported undefined features".
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { mockFetchRoutes } from '../setup';

afterEach(cleanup);

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));
vi.mock('@/hooks/useChecklistCLI', () => ({
  useChecklistCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));

import { useModuleReviewCli } from '@/hooks/useModuleReviewCli';
import { useProjectStore } from '@/stores/projectStore';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

beforeEach(() => {
  useProjectStore.setState({ projectPath: 'C:/Users/me/Unreal Projects/PoF' });
});

function setup(response: { status?: number; body: unknown }) {
  mockFetchRoutes([{ match: '/api/feature-matrix/import', response }]);
  const onToast = vi.fn();
  const { result } = renderHook(() =>
    useModuleReviewCli({ moduleId: 'audio', moduleLabel: 'Audio', accentColor: STATUS_SUCCESS, onToast }),
  );
  return { onToast, result };
}

describe('useModuleReviewCli — manual sync', () => {
  it('reports the imported count from the envelope data', async () => {
    const { onToast, result } = setup({ body: { success: true, data: { imported: 7, source: 'review' } } });
    await act(async () => { await result.current.handleSync(); });
    expect(onToast).toHaveBeenCalledWith('Imported 7 features', 'success');
  });

  it('reports the route error on a failed sync', async () => {
    const { onToast, result } = setup({ status: 404, body: { success: false, error: 'Review results not found at X' } });
    await act(async () => { await result.current.handleSync(); });
    expect(onToast).toHaveBeenCalledWith('Review results not found at X', 'error');
  });
});
