import { describe, it, expect } from 'vitest';
import { registerTrackWorkspace, getTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { DefaultTrackWorkspace } from '@/components/ecw/pipeline/workspaces/DefaultTrackWorkspace';
import '@/components/ecw/pipeline/workspaces/register'; // side-effect: register the real workspaces
import { LogicWorkspace } from '@/components/ecw/pipeline/workspaces/LogicWorkspace';
import { SpellbookLogicWorkspace } from '@/components/ecw/pipeline/workspaces/SpellbookLogicWorkspace';

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
  it('spellbook gets the rich Logic editor; other catalogs get the generic LogicWorkspace', () => {
    expect(getTrackWorkspace('spellbook', 'logic')).toBe(SpellbookLogicWorkspace);
    expect(getTrackWorkspace('loot-tables', 'logic')).toBe(LogicWorkspace);
  });
});
