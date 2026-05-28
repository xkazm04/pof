import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { selected } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const STEP = 'Icon 2D Art';
const entity: LabEntity = { id: 'g1', name: 'Fireball', lifecycle: 'planned', data: {} };
const spec: StepSpec = {
  archetype: 'gallery', label: 'Icon 2D Art',
  view: { kind: 'gallery', field: 'selected', candidates: 4 },
  produce: (e) => ({
    data: { selected: 0 },
    ueAssets: [`/Game/UI/Icons/T_${e.name}_Icon`],
    links: [{ catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-library' }],
  }),
  accept: selected('selected', 'An icon candidate is selected'),
};

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const produce = () => fireEvent.click(screen.getByRole('button', { name: /Generate Icon 2D Art/ }));

describe('ArchetypeStep gallery archetype', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('shows the empty gallery + pending before Produce, then the kept batch + pass after', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    expect(status()).toBe('pending');
    expect(screen.getByTestId('candidate-gallery-empty')).toBeTruthy();

    produce();
    expect(status()).toBe('pass');
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('4 candidates · 1 re-roll kept');
    expect((screen.getByTestId('candidate-b0-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves the spec ueAssets + links through a generate, and projects the selected index', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();
    const art = useLabPipelineStore.getState().byEntity['g1'][STEP];
    expect(art.ueAssets).toContain('/Game/UI/Icons/T_Fireball_Icon');
    expect((art.data.links as { catalogId: string }[])[0].catalogId).toBe('icon-sets');
    expect(art.data.selected).toBe(0);
  });

  it('keeps prior re-rolls and persists re-selecting an older candidate', () => {
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} />);
    produce();  // batch 0
    produce();  // batch 1 (prior kept)
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('8 candidates · 2 re-rolls kept');

    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    expect((screen.getByTestId('candidate-b0-c2') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect(status()).toBe('pass');

    const art = useLabPipelineStore.getState().byEntity['g1'][STEP];
    expect((art.data.genHistory as { selectedId: string }).selectedId).toBe('b0-c2');
    expect(art.data.selected).toBe(2); // projected index
  });
});
