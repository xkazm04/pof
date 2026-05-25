import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EntityPipelinePanel } from '@/components/ecw/pipeline/EntityPipelinePanel';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({
  useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }),
}));
const fetchMock = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) }));
vi.stubGlobal('fetch', fetchMock);

const entity: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
};

describe('EntityPipelinePanel', () => {
  beforeEach(() => {
    usePipelineStore.setState({ tracksByEntity: {} });
    fetchMock.mockClear();
  });
  afterEach(cleanup);

  it('renders the pipeline overview', () => {
    render(<EntityPipelinePanel entity={entity} />);
    expect(screen.getByText(/Production Pipeline/i)).toBeTruthy();
  });

  it('shows the first track detail by default', () => {
    render(<EntityPipelinePanel entity={entity} />);
    // bestiary first track = logic
    expect(screen.getByText(/Gameplay C\+\+/i)).toBeTruthy();
  });

  it('clicking a node swaps the detail to that track', () => {
    render(<EntityPipelinePanel entity={entity} />);
    fireEvent.click(screen.getByRole('button', { name: /Audio/i }));
    expect(screen.getByText(/SFX, music cues/i)).toBeTruthy();
  });

  it('loads persisted track states from /api/pipeline on mount', () => {
    render(<EntityPipelinePanel entity={entity} />);
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/pipeline?catalogId=bestiary&entityId=brute');
  });
});
