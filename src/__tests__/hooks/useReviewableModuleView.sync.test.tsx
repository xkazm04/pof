/**
 * Manual Sync POSTs /api/feature-matrix/import, which answers in the standard
 * `{ success, data }` envelope. The view hook read `imported` off the ENVELOPE, so
 * every successful sync toasted "Imported undefined features" (twin of
 * useModuleReviewCli.sync.test.tsx).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { mockFetchRoutes } from '../setup';

afterEach(cleanup);

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute: vi.fn(), isRunning: false }),
}));

import { useReviewableModuleView } from '@/components/modules/shared/ReviewableModuleView/useReviewableModuleView';
import { useProjectStore } from '@/stores/projectStore';
import { STATUS_SUCCESS } from '@/lib/chart-colors';

beforeEach(() => {
  toast.success.mockClear();
  toast.error.mockClear();
  useProjectStore.setState({ projectPath: 'C:/Users/me/Unreal Projects/PoF' });
});

function setup(response: { status?: number; body: unknown }) {
  mockFetchRoutes([{ match: '/api/feature-matrix/import', response }]);
  return renderHook(() =>
    useReviewableModuleView({
      moduleId: 'audio', moduleLabel: 'Audio', accentColor: STATUS_SUCCESS, checklist: [], extraTabs: [],
    }),
  ).result;
}

describe('useReviewableModuleView — manual sync', () => {
  it('reports the imported count from the envelope data', async () => {
    const result = setup({ body: { success: true, data: { imported: 7, source: 'review' } } });
    await act(async () => { await result.current.handleSync(); });
    expect(toast.success).toHaveBeenCalledWith('Imported 7 features');
  });

  it('reports the route error on a failed sync', async () => {
    const result = setup({ status: 404, body: { success: false, error: 'Review results not found at X' } });
    await act(async () => { await result.current.handleSync(); });
    expect(toast.error).toHaveBeenCalledWith('Review results not found at X');
  });
});
