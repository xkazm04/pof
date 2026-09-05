import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { MatrixBindIcons, describeBindOutcome } from '@/components/layout-lab/MatrixBindIcons';
import { LIGHT } from '@/components/layout-lab/theme';
import type { BindIconsSummary } from '@/lib/catalog/acceptance/bindIconsAll';

/**
 * `bind-icons` was a real route with NO affordance — a documented curl fleet-memory says
 * must be re-run by hand after every campaign. The lab button must render the route's OWN
 * counts (bound / skipped with reasons / verdict deltas / which scope bound), never a bare
 * "done", and must report "0 bound" as a first-class line with its top reason.
 */
afterEach(cleanup);

const summary = (over: Partial<BindIconsSummary> = {}): BindIconsSummary => ({
  library: 3, examined: 2, bound: 1, changed: 1, skipped: 1, results: [], ...over,
});

const row = (over: Partial<BindIconsSummary['results'][number]> = {}) => ({
  catalogId: 'items', entityId: 'item-1', step: 'Icon 2D Art',
  from: 'deferred', to: 'pass', detail: '/api/visual-gen/icon/x.jpg', changed: true, ...over,
});

describe('describeBindOutcome', () => {
  it('reports 0 bound as a first-class line naming the top reason', () => {
    const out = describeBindOutcome(
      summary({ bound: 0, changed: 0, examined: 2, skipped: 2, results: [
        { ...row({ scope: undefined, changed: false, detail: 'no-history' }) },
        { ...row({ scope: undefined, changed: false, detail: 'no-history' }) },
      ] }),
      true,
    );
    expect(out.headline).toBe('0 bound — no-history.');
    expect(out.reasons[0]).toEqual({ reason: 'no-history', count: 2 });
  });

  it('names an EMPTY library rather than an anonymous zero', () => {
    const out = describeBindOutcome(summary({ library: 0, examined: 0, bound: 0, changed: 0, skipped: 0 }), true);
    expect(out.headline).toContain('the icon library is empty');
  });

  it('counts artifacts the library has no art for — they are never rows', () => {
    const out = describeBindOutcome(summary({ bound: 0, changed: 0, examined: 0, skipped: 5, results: [] }), false);
    expect(out.noArt).toBe(5);
    expect(out.headline).toContain('no art matching 5 artifacts');
    expect(out.headline).toContain('would bind');
  });

  it('separates entity art from the per-step icon standing in', () => {
    const out = describeBindOutcome(
      summary({ bound: 3, changed: 2, skipped: 0, results: [
        row({ scope: 'entity' }), row({ scope: 'step' }), row({ scope: 'step', changed: false }),
      ] }),
      true,
    );
    expect(out.scopes).toEqual({ entity: 1, step: 2 });
    expect(out.moved).toEqual([{ label: 'deferred → pass', count: 2 }]);
  });
});

describe('MatrixBindIcons', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('discloses what the pass needs BEFORE any click', () => {
    render(<MatrixBindIcons t={LIGHT} />);
    expect(screen.getByTestId('bind-icons-needs').textContent).toMatch(/generated\/icons\//);
    expect(screen.getByTestId('bind-icons-needs').textContent).toMatch(/cannot manufacture a pass/);
  });

  it('previews with GET (writing nothing) and renders the route\'s real counts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: summary({ bound: 2, changed: 1, results: [row({ scope: 'entity' }), row({ scope: 'step', changed: false })] }) }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MatrixBindIcons t={LIGHT} />);
    screen.getByTestId('bind-icons-preview').click();
    await waitFor(() => expect(screen.queryByTestId('bind-icons-summary')).not.toBeNull());
    expect(fetchMock.mock.calls[0][1]).toBeUndefined(); // GET — no method, no body
    expect(screen.getByTestId('bind-icons-summary').textContent).toContain('2 would bind');
    expect(screen.getByTestId('bind-icons-scopes').textContent).toContain('1 from art made for that entity');
  });

  it('binds with POST and never renders a bare "done"', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: summary({ bound: 0, changed: 0, examined: 1, skipped: 1, results: [row({ scope: undefined, changed: false, detail: 'already-real' })] }) }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MatrixBindIcons t={LIGHT} />);
    screen.getByTestId('bind-icons-run').click();
    await waitFor(() => expect(screen.queryByTestId('bind-icons-summary')).not.toBeNull());
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(screen.getByTestId('bind-icons-summary').textContent).toContain('0 bound — already-real');
    expect(screen.getByTestId('bind-icons-reason').textContent).toContain('already-real');
  });

  it('surfaces a failed request instead of an empty panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ success: false, error: 'library unreadable' }) }));
    render(<MatrixBindIcons t={LIGHT} />);
    screen.getByTestId('bind-icons-run').click();
    await waitFor(() => expect(screen.queryByTestId('bind-icons-error')).not.toBeNull());
    expect(screen.getByTestId('bind-icons-error').textContent).toContain('library unreadable');
  });
});
