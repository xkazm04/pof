import { describe, it, expect } from 'vitest';
import { registerTrackWorkspace, getTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { DefaultTrackWorkspace } from '@/components/ecw/pipeline/workspaces/DefaultTrackWorkspace';

const Exact = () => null;
const Wild = () => null;

describe('trackWorkspaceRegistry', () => {
  it('exact (catalogId,trackId) wins', () => {
    registerTrackWorkspace('bestiary', 'logic', Exact);
    expect(getTrackWorkspace('bestiary', 'logic')).toBe(Exact);
  });
  it('falls back to wildcard (*,trackId)', () => {
    registerTrackWorkspace('*', 'test', Wild);
    expect(getTrackWorkspace('loot-tables', 'test')).toBe(Wild);
  });
  it('falls back to DefaultTrackWorkspace when nothing registered', () => {
    expect(getTrackWorkspace('zone-map', 'art-3d')).toBe(DefaultTrackWorkspace);
  });
});
