import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { StepHistoryPanel } from '@/components/layout-lab/steps/shared/StepHistoryPanel';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { PRODUCE_DIRECTION_KEY } from '@/lib/catalog/produceDirection';

const t = LAB_THEMES[0];

const rev = (id: number, over: Record<string, unknown> = {}) => ({
  id, catalogId: 'items', entityId: 'e1', step: 'Concept Brief',
  data: { brief: `v${id}` }, ueAssets: [], status: 'pass', tier: 'L0',
  updatedAt: '2026-07-20T10:00:00.000Z', archivedAt: '2026-07-20T11:00:00.000Z', ...over,
});

/** Route responses keyed by method, in the `{success,data}` envelope tryApiFetch unwraps. */
function stubRoutes(get: unknown, post?: unknown) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => ({ success: true, data: init?.method === 'POST' ? post : get }),
  }));
  vi.stubGlobal('fetch', fn as unknown as typeof fetch);
  return fn;
}

const renderPanel = (onRestored = vi.fn()) => {
  render(<StepHistoryPanel t={t} catalogId="items" entityId="e1" step="Concept Brief" onRestored={onRestored} />);
  return onRestored;
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('<StepHistoryPanel />', () => {
  it('fetches nothing until it is opened', () => {
    const f = stubRoutes([]);
    renderPanel();
    expect(f).not.toHaveBeenCalled();
  });

  it('says plainly when a step has only ever been produced once', async () => {
    stubRoutes([]);
    renderPanel();
    fireEvent.click(screen.getByTestId('step-history-toggle'));
    expect((await screen.findByTestId('step-history-empty')).textContent).toMatch(/only ever been produced once/i);
  });

  it('lists each previous version with the direction that produced it', async () => {
    stubRoutes([
      rev(2, { data: { brief: 'v2', [PRODUCE_DIRECTION_KEY]: { direction: 'grimmer', prompt: 'p' } } }),
      rev(1),
    ]);
    renderPanel();
    fireEvent.click(screen.getByTestId('step-history-toggle'));

    const rows = await screen.findAllByTestId('step-history-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('grimmer');
    expect(rows[1].textContent).toMatch(/no direction recorded/i);
  });

  it('restores a version and tells the caller to re-read server truth', async () => {
    const f = stubRoutes([rev(1)], { artifact: { status: 'pass' }, regraded: true, archivedStatus: 'pass' });
    const onRestored = renderPanel();
    fireEvent.click(screen.getByTestId('step-history-toggle'));

    fireEvent.click(await screen.findByTestId('step-history-restore'));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());

    const posted = f.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse(String((posted?.[1] as RequestInit).body))).toEqual({ revisionId: 1 });
  });

  it('reports when the restore re-graded to a DIFFERENT verdict than the archive carried', async () => {
    stubRoutes([rev(1, { status: 'pass' })], { artifact: { status: 'fail' }, regraded: true, archivedStatus: 'pass' });
    renderPanel();
    fireEvent.click(screen.getByTestId('step-history-toggle'));
    fireEvent.click(await screen.findByTestId('step-history-restore'));

    const notice = await screen.findByTestId('step-history-notice');
    expect(notice.textContent).toContain('fail');
    expect(notice.textContent).toContain('pass');
    expect(notice.textContent).toMatch(/re-graded/i);
  });

  it('surfaces a load failure with a retry rather than an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, json: async () => ({ success: false, error: 'db is down' }),
    })) as unknown as typeof fetch);
    renderPanel();
    fireEvent.click(screen.getByTestId('step-history-toggle'));

    expect(await screen.findByText(/db is down/)).toBeTruthy();
    expect(screen.queryByTestId('step-history-empty')).toBeNull();
  });
});
