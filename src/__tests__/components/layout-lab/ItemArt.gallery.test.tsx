import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { ItemIcon2D, Item3DGen, ItemMaterial } from '@/components/layout-lab/steps/ItemArt';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LIGHT } from '@/components/layout-lab/theme';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const entity: LabEntity = { id: 'item-test', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const generate = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));

describe('ItemArt persistent candidate gallery', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('Icon 2D: Produce appends a kept batch, flips Acceptance to pass, and shows the gallery', () => {
    render(<ItemIcon2D t={LIGHT} entity={entity} step="Icon 2D Art" />);
    // Before producing: pending + empty gallery hint.
    expect(status()).toBe('pending');
    expect(screen.getByTestId('candidate-gallery-empty')).toBeTruthy();

    generate(/Generate via Leonardo/);
    expect(status()).toBe('pass');                       // derived from the projected `selected`
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('4 candidates · 1 re-roll kept');
    expect((screen.getByTestId('candidate-b0-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('Icon 2D: a re-roll keeps the prior batch (history not discarded) and re-selecting an older candidate persists', () => {
    render(<ItemIcon2D t={LIGHT} entity={entity} step="Icon 2D Art" />);
    generate(/Generate via Leonardo/);   // batch 0
    generate(/Generate via Leonardo/);   // batch 1 (re-roll) — prior batch kept

    expect(screen.getByTestId('candidate-gallery').textContent).toContain('8 candidates · 2 re-rolls kept');
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    // Re-select a candidate from the FIRST batch — the core "re-select an older one" loop.
    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    expect((screen.getByTestId('candidate-b0-c2') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
    expect(status()).toBe('pass'); // still selected → still passing

    // Selection survives in the persisted store (not just local component state).
    const persisted = useLabPipelineStore.getState().byEntity['item-test']['Icon 2D Art'];
    expect((persisted.data.genHistory as { selectedId: string }).selectedId).toBe('b0-c2');
  });

  it('3D Generation: Produce yields a batch of tri-budget variants and passes the LOD0 cap', () => {
    render(<Item3DGen t={LIGHT} entity={entity} step="3D Generation" />);
    expect(status()).toBe('pending');
    generate(/Generate mesh/);
    expect(status()).toBe('pass');
    // "4200 tris" appears both as the LOD0 budget and the candidate caption — scope to the tile.
    expect(within(screen.getByTestId('candidate-b0-c0')).getByText('4200 tris')).toBeTruthy();
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('3 candidates · 1 re-roll kept');
  });

  it('Material / Texture: Produce yields named looks each carrying the required PBR maps', () => {
    render(<ItemMaterial t={LIGHT} entity={entity} step="Material / Texture" />);
    expect(status()).toBe('pending');
    generate(/Generate PBR maps/);
    expect(status()).toBe('pass');
    expect(screen.getByText('worn iron')).toBeTruthy();      // candidate caption (look name)
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('3 candidates · 1 re-roll kept');
  });
});
