import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PipelineTrackDetail } from '@/components/ecw/pipeline/PipelineTrackDetail';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const { evaluate } = vi.hoisted(() => ({ evaluate: vi.fn() }));
vi.mock('@/hooks/useEntityTrackHelp', () => ({
  useEntityTrackHelp: () => ({ evaluate, isRunning: false }),
}));

// Stub fetch so setTrackState's POST doesn't hit the network.
const fetchMock = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) }));
vi.stubGlobal('fetch', fetchMock);

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
};

describe('PipelineTrackDetail', () => {
  beforeEach(() => {
    usePipelineStore.setState({ tracksByEntity: {} });
    evaluate.mockClear();
    fetchMock.mockClear();
  });
  afterEach(cleanup);

  it('renders the track label + hint', () => {
    render(<PipelineTrackDetail entity={entity} trackId="art-3d" />);
    expect(screen.getByText('3D Art')).toBeTruthy();
    expect(screen.getByText(/Meshes, materials/i)).toBeTruthy();
  });

  it('renders the 4 state-setter buttons', () => {
    render(<PipelineTrackDetail entity={entity} trackId="logic" />);
    expect(screen.getByRole('button', { name: /^Not started$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^In progress$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Blocked$/i })).toBeTruthy();
  });

  it('clicking a state button updates the store optimistically', () => {
    render(<PipelineTrackDetail entity={entity} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
    expect(usePipelineStore.getState().getEntityTracks('bestiary', 'brute').logic).toBe('done');
  });

  it('clicking a state button POSTs to /api/pipeline', async () => {
    render(<PipelineTrackDetail entity={entity} trackId="logic" />);
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/pipeline');
    expect((opts as { method: string }).method).toBe('POST');
  });

  it('Evaluate with CLI dispatches useEntityTrackHelp.evaluate for this track', () => {
    render(<PipelineTrackDetail entity={entity} trackId="audio" />);
    fireEvent.click(screen.getByRole('button', { name: /evaluate with cli/i }));
    expect(evaluate).toHaveBeenCalledWith('audio');
  });
});
