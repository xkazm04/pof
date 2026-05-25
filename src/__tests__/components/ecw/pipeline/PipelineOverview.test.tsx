import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PipelineOverview } from '@/components/ecw/pipeline/PipelineOverview';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { StoredCatalogEntity } from '@/lib/catalog/types';

const bestiary: StoredCatalogEntity = {
  id: 'brute', catalogId: 'bestiary', name: 'Brute',
  categoryPath: ['Bestiary'], tags: [], lifecycle: 'planned',
};

describe('PipelineOverview', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));
  afterEach(cleanup);

  it('renders one node per track in the catalog pipeline (bestiary = 6)', () => {
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={() => {}} />);
    const nodes = screen.getAllByTestId('pipeline-node');
    expect(nodes).toHaveLength(6); // logic, ai, art-3d, animation, audio, test
  });

  it('shows track labels', () => {
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={() => {}} />);
    expect(screen.getByText('Logic')).toBeTruthy();
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText('Test Gate')).toBeTruthy();
  });

  it('reflects persisted state via aria-label', () => {
    usePipelineStore.getState().loadTracks('bestiary', 'brute', [
      { catalogId: 'bestiary', entityId: 'brute', trackId: 'logic', state: 'done' },
    ]);
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={() => {}} />);
    const logicNode = screen.getByRole('button', { name: /Logic.*Done/i });
    expect(logicNode).toBeTruthy();
  });

  it('defaults unloaded tracks to not-started', () => {
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={() => {}} />);
    expect(screen.getByRole('button', { name: /AI.*Not started/i })).toBeTruthy();
  });

  it('clicking a node calls onSelectTrack with the track id', () => {
    const onSelect = vi.fn();
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /AI/i }));
    expect(onSelect).toHaveBeenCalledWith('ai');
  });

  it('shows an overall coverage summary (done / total)', () => {
    usePipelineStore.getState().loadTracks('bestiary', 'brute', [
      { catalogId: 'bestiary', entityId: 'brute', trackId: 'logic', state: 'done' },
      { catalogId: 'bestiary', entityId: 'brute', trackId: 'test', state: 'done' },
    ]);
    render(<PipelineOverview entity={bestiary} selectedTrack={null} onSelectTrack={() => {}} />);
    expect(screen.getByText(/2 \/ 6 tracks done/i)).toBeTruthy();
  });
});
