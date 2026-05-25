import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DefaultTrackWorkspace } from '@/components/ecw/pipeline/workspaces/DefaultTrackWorkspace';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

vi.mock('@/hooks/useEntityTrackHelp', () => ({ useEntityTrackHelp: () => ({ evaluate: vi.fn(), isRunning: false }) }));
vi.stubGlobal('fetch', vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })));

const entity: StoredCatalogEntity = { id: 'brute', catalogId: 'bestiary', name: 'Brute', categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned' };

describe('DefaultTrackWorkspace', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders the track label + state setters (via PipelineTrackDetail)', () => {
    render(<DefaultTrackWorkspace entity={entity} trackId="logic" />);
    expect(screen.getByText(/Gameplay C\+\+/i)).toBeTruthy(); // logic track label/hint
    expect(screen.getByRole('button', { name: /^Done$/i })).toBeTruthy();
  });

  it('shows a generation-pending note for art-3d', () => {
    render(<DefaultTrackWorkspace entity={entity} trackId="art-3d" />);
    expect(screen.getByText(/generation pipeline pending/i)).toBeTruthy();
  });

  it('does not show the pending note for logic', () => {
    render(<DefaultTrackWorkspace entity={entity} trackId="logic" />);
    expect(screen.queryByText(/generation pipeline pending/i)).toBeNull();
  });
});
