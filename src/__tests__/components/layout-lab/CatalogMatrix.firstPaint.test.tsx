import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// The FIRST paint of a cold Matrix (before the cache's fetch effect has run) sees the
// cache's EMPTY entry: not loading, not loaded, no error. That is "not fetched yet", not
// "nothing produced" — so it must paint the skeleton, never a grid of never-produced cells.
// renderToString renders exactly that frame (effects never run, the cache's server
// snapshot is EMPTY).

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

vi.mock('@/components/layout-lab/labArtifactClient', () => ({
  fetchArtifacts: vi.fn(() => new Promise(() => {})),
  fetchArtifactsResult: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@/components/layout-lab/useLabCatalogData', () => ({
  useLabDetail: (id: string) => (id === 'fixtures' ? {
    catalog: { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 },
    entities: [
      { id: 'e1', name: 'Entity One', lifecycle: 'planned', data: {} },
      { id: 'e2', name: 'Entity Two', lifecycle: 'planned', data: {} },
    ],
    steps: ['StepA', 'StepB'],
  } : null),
}));

vi.mock('@/lib/catalog/pipeline-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog/pipeline-registry')>();
  const view = { kind: 'prose', field: 'x', emptyText: '' } as const;
  const produce = () => ({ data: {}, ueAssets: [] });
  return {
    ...actual,
    getCatalogPipeline: (id: string) => ({
      catalogId: id,
      steps: [
        { archetype: 'brief', label: 'StepA', view, produce, accept: () => ({ label: 'a', status: 'pass', tier: 'L0', detail: '' }) },
        { archetype: 'gate', label: 'StepB', view, produce, accept: () => ({ label: 'b', status: 'pass', tier: 'L0', detail: '' }) },
      ],
    }),
  };
});

import { CatalogMatrix } from '@/components/layout-lab/CatalogMatrix';
import { LIGHT } from '@/components/layout-lab/theme';

const groups = [{ category: 'Test', catalogs: [
  { catalogId: 'fixtures', label: 'Fixtures', description: '', total: 2, verified: 0 },
] }];

describe('CatalogMatrix first paint', () => {
  it('paints the loading skeleton, not a grid of never-produced cells, before the first fetch starts', () => {
    const html = renderToString(
      <CatalogMatrix t={LIGHT} groups={groups} catalogId="fixtures" onSelectCatalog={vi.fn()} onOpenStep={vi.fn()} />,
    );
    expect(html).toContain('data-testid="matrix-skeleton"');
    expect(html).toContain('aria-busy="true"');
  });
});
