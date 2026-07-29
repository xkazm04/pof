import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { ArchetypeStep } from '@/components/layout-lab/steps/ArchetypeStep';
import { useLabPipelineStore } from '@/components/layout-lab/labPipelineStore';
import { LAB_THEMES } from '@/components/layout-lab/theme';
import { GEN_HISTORY_KEY } from '@/components/layout-lab/steps/shared/genHistory';
import { minLength } from '@/lib/catalog/acceptance/dataCheckers';
import type { StepSpec } from '@/lib/catalog/stepSpec';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const t = LAB_THEMES[0];
const STEP = 'Game-Tier Convert';
const entity: LabEntity = { id: 'ev1', name: 'Jinx', lifecycle: 'planned', data: {} };

const spec: StepSpec = {
  archetype: 'brief', label: STEP,
  view: { kind: 'prose', field: 'brief', emptyText: 'Nothing yet' },
  produce: () => ({ data: { brief: 'x'.repeat(400) }, ueAssets: [] }),
  accept: minLength('brief', 'Brief ≥ 300', 300),
};

/** Seed the step artifact directly — this test is about what the prompt CITES, not producing. */
function seed(data: Record<string, unknown>) {
  useLabPipelineStore.setState({
    byEntity: { [entity.id]: { [STEP]: { done: true, data, ueAssets: [], at: '2026-07-20T10:00:00.000Z' } } },
  });
}

const viewPrompt = () => {
  fireEvent.click(screen.getByRole('button', { name: /view prompt/ }));
  return screen.getByText(/Produce Game-Tier Convert for Jinx/).textContent ?? '';
};

describe('ArchetypeStep — evidence attached to the produce prompt', () => {
  beforeEach(() => { useLabPipelineStore.setState({ byEntity: {} }); localStorage.clear(); });
  afterEach(cleanup);

  it('attaches nothing when the step holds no real artifact', () => {
    seed({ brief: 'x'.repeat(400) });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);
    expect(screen.queryByTestId('cli-produce-attachments')).toBeNull();
    expect(viewPrompt()).not.toContain('Current output');
  });

  it('cites a served mesh by URL and shows it as attached', () => {
    seed({ brief: 'x'.repeat(400), glbUrl: '/api/visual-gen/asset/jinx_hd.glb' });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);

    const chips = screen.getByTestId('cli-produce-attachments');
    expect(chips.getAttribute('data-count')).toBe('1');
    expect(chips.textContent).toContain('/api/visual-gen/asset/jinx_hd.glb');
    expect(viewPrompt()).toContain('/api/visual-gen/asset/jinx_hd.glb');
  });

  it('cites the SELECTED gallery candidate’s image, not the rejected ones', () => {
    seed({
      brief: 'x'.repeat(400),
      [GEN_HISTORY_KEY]: {
        batches: [{
          id: 'b0', at: '2026-07-20T10:00:00.000Z', direction: 'd', prompt: 'p',
          candidates: [
            { id: 'b0-c0', swatch: '#111', imageUrl: '/api/visual-gen/asset/rejected.png', payload: {} },
            { id: 'b0-c1', swatch: '#222', imageUrl: '/api/visual-gen/asset/chosen.png', payload: {} },
          ],
        }],
        selectedId: 'b0-c1',
      },
    });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);

    const chips = screen.getByTestId('cli-produce-attachments');
    expect(chips.textContent).toContain('chosen.png');
    expect(chips.textContent).not.toContain('rejected.png');

    const prompt = viewPrompt();
    expect(prompt).toContain('chosen.png');
    expect(prompt).not.toContain('rejected.png');
  });

  it('never cites a swatch — an invented colour must not be passed off as the output', () => {
    seed({
      brief: 'x'.repeat(400),
      [GEN_HISTORY_KEY]: {
        batches: [{
          id: 'b0', at: '2026-07-20T10:00:00.000Z', direction: 'd', prompt: 'p',
          candidates: [{ id: 'b0-c0', swatch: 'linear-gradient(#123,#456)', payload: {} }],
        }],
        selectedId: 'b0-c0',
      },
    });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);

    expect(screen.queryByTestId('cli-produce-attachments')).toBeNull();
    const prompt = viewPrompt();
    expect(prompt).not.toContain('Current output');
    expect(prompt).not.toContain('linear-gradient');
  });

  it('tells the session the direction is feedback ON the cited artifact', () => {
    seed({ brief: 'x'.repeat(400), glbUrl: '/api/visual-gen/asset/jinx_hd.glb' });
    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);
    expect(viewPrompt()).toMatch(/feedback ON these/i);
  });

  it('carries a referenced library asset — and its licence — into the prompt', async () => {
    seed({ brief: 'x'.repeat(400) });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: [{
        id: 'a1', assetId: 'rocky', name: 'Rocky Terrain', source: 'polyhaven', category: 'textures',
        license: 'CC0', thumbnailUrl: '', downloadUrl: 'https://x/d.zip', tags: [], favorite: false,
        collectionIds: [], createdAt: 0,
      }] }),
    })) as unknown as typeof fetch);

    render(<ArchetypeStep t={t} entity={entity} step={STEP} spec={spec} catalogId="character-pipeline" />);
    expect(viewPrompt()).not.toContain('Rocky Terrain');

    fireEvent.click(screen.getByTestId('step-library-toggle'));
    fireEvent.click(await screen.findByTestId('step-library-pick'));

    // It reaches BOTH surfaces: the visible attachment list and the built prompt.
    expect(screen.getByTestId('cli-produce-attachments').textContent).toContain('Rocky Terrain');
    const prompt = screen.getByText(/Produce Game-Tier Convert for Jinx/).textContent ?? '';
    expect(prompt).toContain('Rocky Terrain');
    expect(prompt).toContain('CC0');
    expect(prompt).toContain('https://x/d.zip');
    vi.unstubAllGlobals();
  });
});
