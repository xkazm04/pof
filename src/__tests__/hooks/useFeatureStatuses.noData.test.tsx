/**
 * An ok envelope with no `data` must settle every all-statuses consumer as
 * failed, not leave the shared flight rejected and every consumer loading.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { mockFetchRoutes } from '@/__tests__/setup';
import { useFeatureStatuses, invalidateFeatureStatuses } from '@/hooks/useFeatureStatuses';

afterEach(cleanup);
beforeEach(() => { invalidateFeatureStatuses(); });

function Probe({ id }: { id: string }) {
  const { isLoading, failed, error } = useFeatureStatuses();
  return <span data-testid={id}>{isLoading ? 'loading' : failed ? `failed:${error}` : 'ok'}</span>;
}

describe('useFeatureStatuses - ok envelope without data', () => {
  it('settles both concurrent consumers with failed=true', async () => {
    mockFetchRoutes([
      { match: '/api/feature-matrix/all-statuses', response: { body: { success: true } } },
    ]);
    const { container } = render(<><Probe id="a" /><Probe id="b" /></>);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="a"]')?.textContent ?? '').toMatch(/^failed:/);
      expect(container.querySelector('[data-testid="b"]')?.textContent ?? '').toMatch(/^failed:/);
    });
  });
});
