import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { MatrixSettle } from '@/components/layout-lab/MatrixSettle';
import { LIGHT } from '@/components/layout-lab/theme';

/**
 * The matrix header's Settle panel: ONE scoped preview of the three filesystem passes (what
 * would lift, what would DROP and why) before ONE confirmed Apply for the catalog on screen.
 * The old MatrixBindIcons POSTed '{}' — every catalog — from inside one catalog's header.
 */
afterEach(cleanup);

const staticRows = Array.from({ length: 8 }, (_, i) => ({
  catalogId: 'bestiary', entityId: `e${i}`, step: 'Stat Blocks', from: 'pass', to: 'deferred', reason: 'UE root not resolved',
}));
const preview = {
  catalogId: 'bestiary',
  ueRoot: null,
  plan: {
    passes: [
      { pass: 'bind-icons', examined: 0, lifts: 0, drops: 0, moves: [], cause: 'icon library empty', remedy: 'generate art into generated/icons/', rows: [] },
      { pass: 'verify-static', examined: 8, lifts: 0, drops: 8, moves: [{ label: 'pass → deferred', count: 8 }], cause: 'UE root not resolved', remedy: 'set POF_UE_ROOT', rows: staticRows },
      { pass: 'verify-packaging', examined: 0, lifts: 0, drops: 0, moves: [], cause: null, rows: [] },
    ],
    totals: { lifts: 0, drops: 8 },
  },
  bindIcons: { library: 0, examined: 0, bound: 0, changed: 0, skipped: 0, results: [] },
  remaining: [
    { drain: 150, needs: 'running UE editor (bridge)' },
    { drainPython: 2, needs: 'editor open with PoF bridge' },
  ],
};

describe('MatrixSettle', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('shows the drops, their pass and cause before any apply, then applies exactly what was previewed (acceptance 7)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: preview }) })
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: { ...preview, ran: ['bind-icons', 'verify-static', 'verify-packaging'], confirmedDrops: 8 } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<MatrixSettle t={LIGHT} catalogId="bestiary" />);

    fireEvent.click(screen.getByTestId('settle-preview'));
    await waitFor(() => expect(screen.queryByTestId('settle-plan')).not.toBeNull());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pipeline-artifacts/settle?catalogId=bestiary');
    expect(fetchMock.mock.calls[0][1]).toBeUndefined(); // GET — writes nothing

    const staticLine = screen.getByTestId('settle-pass-verify-static').textContent ?? '';
    expect(staticLine).toContain('verify-static');
    expect(staticLine).toMatch(/8 drop/);
    expect(staticLine).toContain('UE root not resolved');
    expect(screen.getByTestId('settle-remaining').textContent).toContain('150');
    expect(fetchMock).toHaveBeenCalledTimes(1); // nothing applied yet

    fireEvent.click(screen.getByTestId('settle-apply'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/pipeline-artifacts/settle');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ catalogId: 'bestiary', confirmDrops: 8 });
    await waitFor(() => expect(screen.queryByTestId('settle-applied')).not.toBeNull());
  });

  it('cannot apply before a preview', () => {
    render(<MatrixSettle t={LIGHT} catalogId="bestiary" />);
    expect((screen.getByTestId('settle-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('surfaces a 409 refusal and drops the stale preview', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ success: true, data: preview }) })
      .mockResolvedValueOnce({ json: async () => ({ success: false, error: 'You confirmed 8 drops, the fresh preview now shows 9.' }) }));
    render(<MatrixSettle t={LIGHT} catalogId="bestiary" />);
    fireEvent.click(screen.getByTestId('settle-preview'));
    await waitFor(() => expect(screen.queryByTestId('settle-plan')).not.toBeNull());
    fireEvent.click(screen.getByTestId('settle-apply'));
    await waitFor(() => expect(screen.queryByTestId('settle-error')).not.toBeNull());
    expect(screen.getByTestId('settle-error').textContent).toContain('fresh preview now shows 9');
    expect(screen.queryByTestId('settle-plan')).toBeNull();
  });
});
