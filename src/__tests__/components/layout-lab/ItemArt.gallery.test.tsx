import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

import { ItemIcon2D, Item3DGen, ItemMaterial } from '@/components/layout-lab/steps/ItemArt';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LIGHT } from '@/components/layout-lab/theme';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const entity: LabEntity = { id: 'item-test', name: 'Iron Longsword', lifecycle: 'planned', data: {} };

const status = () => screen.getByTestId('acceptance-banner').getAttribute('data-status');
const generate = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }));
// Dispatch is async by default: onComplete (the batch append) runs synchronously on the
// click, but the in-flight guard only clears on the microtask — flush it before the next
// re-roll so a rapid second click isn't swallowed by the double-dispatch guard.
const settle = () => act(async () => {});

describe('ItemArt persistent candidate gallery', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  // NOTE on the expected status: a locally-generated batch carries DETERMINISTIC SWATCHES, not
  // generated art, so Acceptance is `deferred` (L4) — the honest reading. It used to be `pass`
  // on the existence of the projected integer, which claimed art nobody produced.
  it('Icon 2D: Produce appends a kept batch, flips Acceptance to deferred, and shows the gallery', () => {
    render(<ItemIcon2D t={LIGHT} entity={entity} step="Icon 2D Art" />);
    // Before producing: pending + empty gallery hint.
    expect(status()).toBe('pending');
    expect(screen.getByTestId('candidate-gallery-empty')).toBeTruthy();

    generate(/Produce via Leonardo/);
    expect(status()).toBe('deferred');                   // a swatch candidate is not an asset
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('4 candidates · 1 re-roll kept');
    expect((screen.getByTestId('candidate-b0-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('Icon 2D: a re-roll keeps the prior batch (history not discarded) and re-selecting an older candidate persists', async () => {
    render(<ItemIcon2D t={LIGHT} entity={entity} step="Icon 2D Art" />);
    generate(/Produce via Leonardo/);   // batch 0
    await settle();
    generate(/Produce via Leonardo/);   // batch 1 (re-roll) — prior batch kept

    expect(screen.getByTestId('candidate-gallery').textContent).toContain('8 candidates · 2 re-rolls kept');
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    // Re-select a candidate from the FIRST batch — the core "re-select an older one" loop.
    fireEvent.click(screen.getByTestId('candidate-b0-c2'));
    expect((screen.getByTestId('candidate-b0-c2') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByTestId('candidate-b1-c0') as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false');
    expect(status()).toBe('deferred'); // still a swatch candidate → still unverifiable

    // Selection survives in the persisted store (not just local component state).
    const persisted = useLabPipelineStore.getState().byEntity['item-test']['Icon 2D Art'];
    expect((persisted.data.genHistory as { selectedId: string }).selectedId).toBe('b0-c2');
  });

  it('3D Generation: Produce yields a batch of tri-budget variants and passes the LOD0 cap', () => {
    render(<Item3DGen t={LIGHT} entity={entity} step="3D Generation" />);
    expect(status()).toBe('pending');
    generate(/Produce mesh/);
    // The tri budget (the L0 SHAPE half) is satisfied — but the candidate is a swatch, so the
    // verdict is `deferred`, not a pass on the hardcoded 4200.
    expect(status()).toBe('deferred');
    // "4200 tris" appears both as the LOD0 budget and the candidate caption — scope to the tile.
    expect(within(screen.getByTestId('candidate-b0-c0')).getByText('4200 tris')).toBeTruthy();
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('3 candidates · 1 re-roll kept');
  });

  it('Material / Texture: Produce yields named looks each carrying the required PBR maps', () => {
    render(<ItemMaterial t={LIGHT} entity={entity} step="Material / Texture" />);
    expect(status()).toBe('pending');
    generate(/Produce PBR maps/);
    expect(status()).toBe('deferred'); // maps present (shape ok), but no generated texture set
    expect(screen.getByText('worn iron')).toBeTruthy();      // candidate caption (look name)
    expect(screen.getByTestId('candidate-gallery').textContent).toContain('3 candidates · 1 re-roll kept');
  });
});
