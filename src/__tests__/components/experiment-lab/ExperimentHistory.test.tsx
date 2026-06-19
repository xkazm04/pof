import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ExperimentHistory } from '@/components/experiment-lab/ExperimentHistory';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;

describe('ExperimentHistory', () => {
  it('renders the list of past runs', async () => {
    const runs = [{ id: 'r1', createdAt: 't', mode: 'scenario', ok: true, error: null, durationMs: 2000, hasScreenshot: false, label: 'scenario /Game/M [moved]' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ runs })));
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/scenario \/Game\/M/)).toBeTruthy());
  });

  it('shows the empty state when there are no runs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ runs: [] })));
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/No past runs yet/)).toBeTruthy());
  });
});
