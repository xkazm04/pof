import { describe, it, expect, beforeEach } from 'vitest';
import { usePipelineStore, entityKey } from '@/stores/pipelineStore';
import type { PipelineTrackRecord } from '@/lib/pipeline/types';

describe('pipelineStore', () => {
  beforeEach(() => usePipelineStore.setState({ tracksByEntity: {} }));

  it('entityKey composes catalogId/entityId', () => {
    expect(entityKey('bestiary', 'brute')).toBe('bestiary/brute');
  });

  it('loadTracks populates the per-entity map', () => {
    const records: PipelineTrackRecord[] = [
      { catalogId: 'bestiary', entityId: 'brute', trackId: 'logic', state: 'done' },
      { catalogId: 'bestiary', entityId: 'brute', trackId: 'art-3d', state: 'in-progress' },
    ];
    usePipelineStore.getState().loadTracks('bestiary', 'brute', records);
    const tracks = usePipelineStore.getState().tracksByEntity['bestiary/brute'];
    expect(tracks.logic).toBe('done');
    expect(tracks['art-3d']).toBe('in-progress');
  });

  it('setTrackState updates a single track', () => {
    usePipelineStore.getState().setTrackState('bestiary', 'brute', 'ai', 'blocked');
    expect(usePipelineStore.getState().tracksByEntity['bestiary/brute'].ai).toBe('blocked');
  });

  it('setTrackState preserves other tracks', () => {
    usePipelineStore.getState().setTrackState('bestiary', 'brute', 'logic', 'done');
    usePipelineStore.getState().setTrackState('bestiary', 'brute', 'ai', 'in-progress');
    const tracks = usePipelineStore.getState().tracksByEntity['bestiary/brute'];
    expect(tracks.logic).toBe('done');
    expect(tracks.ai).toBe('in-progress');
  });

  it('getEntityTracks returns {} for an unloaded entity', () => {
    expect(usePipelineStore.getState().getEntityTracks('items', 'sword')).toEqual({});
  });
});
