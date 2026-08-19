import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ExperimentHistory } from '@/components/experiment-lab/ExperimentHistory';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) }) as Response;

const run = (over: Record<string, unknown> = {}) => ({
  id: 'r1', createdAt: 't', mode: 'scenario', ok: true, error: null, durationMs: 2000,
  hasScreenshot: false, captureState: 'none', label: 'scenario /Game/M [moved]', ...over,
});

describe('ExperimentHistory', () => {
  it('renders the list of past runs', async () => {
    const runs = [run()];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ runs })));
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/scenario \/Game\/M/)).toBeTruthy());
  });

  it('shows the empty state when there are no runs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ runs: [] })));
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/No past runs yet/)).toBeTruthy());
  });

  it('flags a run whose capture is gone instead of silently rendering a broken image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ runs: [run({ captureState: 'missing' })] })));
    const { container } = render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByText(/capture gone/)).toBeTruthy());
    expect(container.querySelector('img')).toBeNull();
  });

  it('labels the verdict UNAUDITABLE in compare when its evidence is gone (verdict is kept, not deleted)', async () => {
    const summary = run({ captureState: 'missing' });
    const detail = {
      ...summary,
      spec: { python: 'x' },
      markers: {},
      observationSummary: null,
      verdict: { status: 'pass', detail: 'visual character: pass' },
      behavioralVerdict: null,
      screenshotPath: 'C:/Temp/pof_exp_gone.png',
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('/runs/') ? ok(detail) : ok({ runs: [summary] }),
    ));
    const { container } = render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByLabelText(/Compare .* as A/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Compare .* as A/));
    fireEvent.click(screen.getByLabelText(/Compare .* as B/));
    await waitFor(() => expect(screen.getAllByText(/UNAUDITABLE/).length).toBeGreaterThan(0));
    // The verdict itself survives — it is qualified, not erased.
    expect(screen.getAllByText(/pass/i).length).toBeGreaterThan(0);
    expect(container.querySelector('img')).toBeNull();
  });

  it('a delete asks for confirmation first, then calls DELETE and re-lists', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? ok({ id: 'r1', deleted: true }) : ok({ runs: [run()] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ExperimentHistory refreshKey={0} />);
    await waitFor(() => expect(screen.getByLabelText(/Delete run/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Delete run/));
    // Retention is stated at the point of deletion.
    await waitFor(() => expect(screen.getByText(/kept indefinitely/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/api/experiment/runs/r1') && (i as RequestInit)?.method === 'DELETE')).toBe(true),
    );
  });
});
