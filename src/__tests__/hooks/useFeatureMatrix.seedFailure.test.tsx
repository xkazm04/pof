/**
 * A failed auto-seed is visible and retryable.
 *
 * `useFeatureMatrix` seeds an empty module once per (project, module), guarded by a
 * module-level Set so two mounted instances cannot race a duplicate seed. The guard
 * entry was added BEFORE the POST and never released, and the failure went only to
 * the console: the matrix sat empty with `error === null` (an "unreviewed module",
 * not a failure), and Retry re-read the empty table without ever seeding again for
 * the rest of the session.
 *
 * RED before the fix: error stayed null, and Retry issued 0 further seed POSTs.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor, act } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { useProjectStore } from '@/stores/projectStore';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';
import type { SubModuleId } from '@/types/modules';

const EMPTY = {
  body: {
    success: true,
    data: { features: [], summary: { total: 0, implemented: 0, improved: 0, partial: 0, missing: 0, unknown: 0 } },
  },
};

afterEach(() => {
  cleanup();
  invalidateFeatureData();
  useProjectStore.setState({ projectPath: '' } as never);
});

function install(seedOk: boolean) {
  return mockFetchRoutes([
    { match: '/api/feature-matrix/', response: { body: { success: true, data: { statuses: [], modules: [] } } } },
    { match: '/api/feature-matrix?moduleId=', response: EMPTY },
    {
      match: '/api/feature-matrix',
      response: seedOk
        ? { body: { success: true, data: { inserted: 1 } } }
        : { status: 500, body: { success: false, error: 'database is locked' } },
    },
  ]);
}

const seedPosts = (m: ReturnType<typeof install>) =>
  m.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST').length;

describe('useFeatureMatrix — auto-seed failure', () => {
  it('surfaces the seed failure and lets Retry seed again', async () => {
    // A project key no other case uses: the seed guard is module-level by design.
    useProjectStore.setState({ projectPath: 'C:/Projects/SeedFail' } as never);
    const mock = install(false);
    const { result } = renderHook(() => useFeatureMatrix('arpg-combat' as SubModuleId));

    await waitFor(() => expect(seedPosts(mock)).toBe(1));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain('database is locked');

    act(() => { result.current.retry(); });
    await waitFor(() => expect(seedPosts(mock)).toBe(2));
  });

  it('[control] a successful seed is dispatched once and not repeated by a refetch', async () => {
    useProjectStore.setState({ projectPath: 'C:/Projects/SeedOk' } as never);
    const mock = install(true);
    const { result } = renderHook(() => useFeatureMatrix('arpg-combat' as SubModuleId));

    await waitFor(() => expect(seedPosts(mock)).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();

    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(seedPosts(mock)).toBe(1);
  });
});
