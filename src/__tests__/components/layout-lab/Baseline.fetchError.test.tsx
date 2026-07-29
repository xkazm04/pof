import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment.
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

// No bespoke steps for the synthetic catalog → the generic renderer.
vi.mock('@/components/layout-lab/steps', () => ({
  getStepComponent: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'Alpha', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'a', status: 'pass', tier: 'L0', detail: '' }) },
        { archetype: 'brief', label: 'Beta', view: { kind: 'prose', field: 'x', emptyText: '' }, produce: () => ({ data: {}, ueAssets: [] }), accept: () => ({ label: 'b', status: 'pass', tier: 'L0', detail: '' }) },
      ],
    }),
  };
});

import { Baseline } from '@/components/layout-lab/Baseline';
import { LIGHT } from '@/components/layout-lab/theme';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { _resetArtifactCache } from '@/components/layout-lab/labArtifactCache';

const groups = [{ category: 'Test', catalogs: [{ catalogId: 'fixtures', label: 'Fixtures', description: '', verified: 0, total: 1 }] }];
const detail = {
  catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 1, verified: 0 },
  entities: [{ id: 'fix-1', name: 'Fixture One', lifecycle: 'planned' as const, data: {} }],
  steps: ['Alpha', 'Beta'],
};

/** A real HTTP 500 from GET /api/pipeline-artifacts (the app's error envelope). */
const five00 = () => Promise.resolve({
  ok: false, status: 500,
  json: () => Promise.resolve({ success: false, error: 'Internal server error' }),
} as unknown as Response);

const okEmpty = () => Promise.resolve({
  ok: true, status: 200,
  json: () => Promise.resolve({ success: true, data: [] }),
} as unknown as Response);

const renderLab = () => render(
  <Baseline theme={LIGHT} groups={groups} detail={detail} onSelectCatalog={() => {}} entityId="fix-1" onSelectEntity={() => {}} />,
);

beforeEach(() => {
  _resetArtifactCache();
  useLabPipelineStore.setState({ byEntity: {} });
  vi.stubGlobal('fetch', vi.fn(five00));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Baseline · a failed artifact fetch is not an empty pipeline', () => {
  it('renders a visible, named error state instead of an all-unproduced rail', async () => {
    const { container } = renderLab();

    // The failure names itself and offers a retry (shared InlineErrorRetry).
    const banner = await waitFor(() => {
      const el = container.querySelector('[data-testid="rail-load-error"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(banner.textContent).toContain('Internal server error');

    // And the dots read UNKNOWN — not the "nothing has run here" lie that would invite
    // re-producing over server truth.
    const statuses = Array.from(container.querySelectorAll('[data-step-status]')).map((n) => n.getAttribute('data-step-status'));
    expect(statuses).toEqual(['unknown', 'unknown']);
    expect(statuses).not.toContain('unproduced');
  });

  it('the per-entity coach declines to advise (never "nothing has run here") and offers the retry', async () => {
    const { container } = renderLab();
    const coach = await waitFor(() => {
      const el = container.querySelector('[data-testid="next-step-coach"][data-coach-state="error"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(coach.textContent).toContain('Internal server error');
    expect(coach.textContent).not.toContain('nothing has run here');
  });

  it('retrying re-reads server truth and clears the error state', async () => {
    const { container } = renderLab();
    const banner = await waitFor(() => {
      const el = container.querySelector('[data-testid="rail-load-error"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    vi.stubGlobal('fetch', vi.fn(okEmpty));
    fireEvent.click(banner.querySelector('button') as HTMLElement); // Retry

    await waitFor(() => expect(container.querySelector('[data-testid="rail-load-error"]')).toBeNull());
    // Now the empty result is the HONEST empty: unproduced, not unknown.
    const statuses = Array.from(container.querySelectorAll('[data-step-status]')).map((n) => n.getAttribute('data-step-status'));
    expect(statuses).toEqual(['unproduced', 'unproduced']);
  });
});
