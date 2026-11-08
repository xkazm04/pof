import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  tryApiFetch: fetchMock,
}));

import { HarnessVisualGallery } from '@/components/harness/HarnessVisualGallery';

afterEach(() => { cleanup(); fetchMock.mockReset(); });

describe('HarnessVisualGallery corrupt iterations', () => {
  it('shows a damaged-record alert, not the empty-iteration copy, for a corrupt iteration', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      data: { statePath: 'x', baselineSlugs: [], iterations: [{ iteration: 4, capturedAt: '', modules: [], corrupt: true }] },
    });
    const { container } = render(<HarnessVisualGallery />);
    await waitFor(() => expect(container.querySelector('section')).not.toBeNull());
    const text = container.textContent ?? '';
    expect(text).toContain('corrupt result.json');
    expect(text).not.toContain('captured no modules');
    expect(container.querySelector('option')?.textContent).toContain('corrupt');
  });

  it('keeps the empty copy for a legitimately empty iteration', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      data: { statePath: 'x', baselineSlugs: [], iterations: [{ iteration: 4, capturedAt: '', modules: [] }] },
    });
    const { container } = render(<HarnessVisualGallery />);
    await waitFor(() => expect(container.querySelector('section')).not.toBeNull());
    expect(container.textContent).toContain('captured no modules');
    expect(container.textContent).not.toContain('corrupt');
  });
});
