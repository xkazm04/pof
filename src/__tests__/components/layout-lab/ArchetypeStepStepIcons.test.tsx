import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import { iconSlug } from '@/lib/visual-gen/generated-icons';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const CATALOG = 'vfx';
const entity: LabEntity = { id: 'v1', name: 'Fire Impact', lifecycle: 'planned', data: {} };
const spec: StepSpec = {
  archetype: 'gallery',
  label: 'Icon 2D Art',
  view: { kind: 'gallery', field: 'selected', candidates: 4 },
  produce: () => ({ data: { selected: 0 } }),
  accept: selected('selected', 'An icon candidate is selected'),
};
const produce = () => fireEvent.click(screen.getByRole('button', { name: /Produce Icon 2D Art/ }));

/** Stand in for GET /api/visual-gen/icons — the route already filters by slug. */
function mockIcons(icons: { name: string; url: string }[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/visual-gen/icons')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { icons: icons.map((i, n) => ({ ...i, slug: iconSlug(CATALOG, STEP), mtimeMs: n })) },
        }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ArchetypeStep — generated art reaches the step it was generated for', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('renders THIS step\'s generated icon and captions it as this step\'s asset', async () => {
    const fetchMock = mockIcons([{ name: 'vfx_Icon_2D_Art.jpg', url: '/api/visual-gen/icon/vfx_Icon_2D_Art.jpg' }]);
    const { container } = render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId={CATALOG} />);

    // The manifest is fetched per (catalogId, step) — not "whatever is on disk".
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested).toContain(`catalogId=${CATALOG}`);
    expect(requested).toContain('step=Icon');

    produce();
    await waitFor(() => expect(container.querySelectorAll('img').length).toBeGreaterThan(0));
    const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('/api/visual-gen/icon/vfx_Icon_2D_Art.jpg');
    // It never claims a mesh turntable / another step's art: only the one real asset.
    expect(srcs.every((s) => s === '/api/visual-gen/icon/vfx_Icon_2D_Art.jpg')).toBe(true);
    expect(screen.getByTestId('gallery-selected-caption').textContent)
      .toBe('Real generated asset for this step: vfx_Icon_2D_Art.jpg');
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });

  it('keeps the honest swatch fallback (and no "real" claim) when the step has no art', async () => {
    const fetchMock = mockIcons([]);
    const { container } = render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId={CATALOG} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    produce();
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('Variant 1');
    const caption = screen.getByTestId('gallery-selected-caption').textContent ?? '';
    expect(caption).toBe('Deterministic seed preview — not the generated asset.');
    expect(caption).not.toContain('Real generated asset');
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });
});
