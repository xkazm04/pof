import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { CandidateGallery } from '@/components/layout-lab/steps/shared/CandidateGallery';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import { imageGalleryCandidates } from '@/components/layout-lab/steps/shared/imageGalleryCandidates';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { GenHistory } from '@/components/layout-lab/steps/shared/genHistory';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const entity: LabEntity = { id: 'ig1', name: 'Fireball', lifecycle: 'planned', data: {} };
const base = {
  archetype: 'gallery' as const, label: 'Icon 2D Art',
  view: { kind: 'gallery' as const, field: 'selected', candidates: 2 },
  produce: () => ({ data: { selected: 0 } }),
  accept: selected('selected', 'An icon candidate is selected'),
};
const produce = () => fireEvent.click(screen.getByRole('button', { name: /Produce Icon 2D Art/ }));

describe('ArchetypeStep pluggable candidate generator', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('prefers spec.genCandidates (real image thumbnails) over the swatch fallback', () => {
    const spec: StepSpec = {
      ...base,
      genCandidates: {
        build: () => [0, 1].map((i) => ({
          swatch: `hsl(${i * 40} 40% 40%)`,
          imageUrl: `/api/visual-gen/asset/realIcon${i}.png`,
          caption: `RealIcon${i}`,
          payload: { selected: i },
        })),
      },
    };
    const { container } = render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThan(0);
    expect((imgs[0] as HTMLImageElement).getAttribute('src')).toContain('/api/visual-gen/asset/realIcon0.png');
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('RealIcon0');
    // the default swatch generator's caption must NOT appear — the plug point won.
    expect(screen.getByTestId('candidate-gallery').textContent).not.toContain('Variant 1');
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });

  it('falls back to honest swatches when needsAssets has no assets on disk', () => {
    // needsAssets:true triggers the fetch; in jsdom it fails → manifest [] → build
    // delegates to the deterministic swatch generator (no fake "real" preview).
    const spec: StepSpec = {
      ...base,
      genCandidates: {
        needsAssets: true,
        build: (dir, seq, assets) => imageGalleryCandidates('selected', 2, assets, dir, seq),
      },
    };
    const { container } = render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('Variant 1');
    expect(screen.getByTestId('acceptance-banner').getAttribute('data-status')).toBe('pass');
  });
});

describe('CandidateGallery image thumbnails', () => {
  afterEach(cleanup);
  it('renders an <img> for a candidate carrying imageUrl', () => {
    const history: GenHistory = {
      selectedId: 'b0-c0',
      batches: [{
        id: 'b0', at: '2026-07-13T10:00:00.000Z', direction: 'd', prompt: 'p',
        candidates: [{ id: 'b0-c0', swatch: 'hsl(0 0% 50%)', imageUrl: '/api/visual-gen/asset/x.png', caption: 'x', payload: { selected: 0 } }],
      }],
    };
    const { container } = render(<CandidateGallery t={t} history={history} onSelect={() => {}} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe('/api/visual-gen/asset/x.png');
  });
});
