import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Leonardo2DWorkspace } from '@/components/ecw/pipeline/workspaces/Leonardo2DWorkspace';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));

const entity: StoredCatalogEntity = { id: 'fb', catalogId: 'spellbook', name: 'Fireball', categoryPath: ['Offensive', 'Fire'], tags: [], lifecycle: 'planned' };

describe('Leonardo2DWorkspace', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('renders a prompt prefilled with the entity + a generate button', () => {
    vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ json: () => Promise.resolve({ success: true, data: {} }) })));
    render(<Leonardo2DWorkspace entity={entity} trackId="art-2d" />);
    expect((screen.getByLabelText(/concept art prompt/i) as HTMLTextAreaElement).value).toMatch(/Fireball/);
    expect(screen.getByRole('button', { name: /generate concept/i })).toBeTruthy();
  });

  it('generates and shows the returned image in the gallery', async () => {
    vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) =>
      Promise.resolve({ json: () => Promise.resolve({ success: true, data: { imageBase64: 'QUJD' } }) }),
    ));
    render(<Leonardo2DWorkspace entity={entity} trackId="art-2d" />);
    fireEvent.click(screen.getByRole('button', { name: /generate concept/i }));
    await waitFor(() => {
      const img = screen.getByRole('img', { name: /Fireball concept 1/i }) as HTMLImageElement;
      expect(img.src).toContain('data:image/jpeg;base64,QUJD');
    });
  });
});
