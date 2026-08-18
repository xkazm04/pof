import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog';

const ev = (id: string) => ([{ id, name: id }] as unknown as AudioEvent[]);

beforeEach(() => {
  useAudioEventCatalogStore.setState({ byScene: {}, legacyEvents: null });
});

describe('audioEventCatalogStore.clearScene — a deleted scene stops leaking its catalog', () => {
  it('drops only the named scene', () => {
    const s = useAudioEventCatalogStore.getState();
    s.setEvents('scene-1', ev('a'));
    s.setEvents('scene-2', ev('b'));

    useAudioEventCatalogStore.getState().clearScene('scene-1');

    const after = useAudioEventCatalogStore.getState();
    expect(after.getEvents('scene-1')).toBeNull();
    expect(after.getEvents('scene-2')).not.toBeNull();
    expect(Object.keys(after.byScene)).toEqual(['scene-2']);
  });

  it('is idempotent, and an unknown scene returns the SAME state object (no notify)', () => {
    useAudioEventCatalogStore.getState().setEvents('scene-1', ev('a'));
    const before = useAudioEventCatalogStore.getState().byScene;

    useAudioEventCatalogStore.getState().clearScene('nope');
    expect(useAudioEventCatalogStore.getState().byScene).toBe(before);

    useAudioEventCatalogStore.getState().clearScene('scene-1');
    useAudioEventCatalogStore.getState().clearScene('scene-1');
    expect(useAudioEventCatalogStore.getState().byScene).toEqual({});
  });

  it('clearing a scene does not wipe the pre-scoping legacy catalog', () => {
    useAudioEventCatalogStore.setState({ legacyEvents: ev('legacy') });
    useAudioEventCatalogStore.getState().setEvents('scene-1', ev('a'));

    useAudioEventCatalogStore.getState().clearScene('scene-1');

    // The scene inherits the legacy list again — its OWN entry is what was reaped.
    expect(useAudioEventCatalogStore.getState().legacyEvents).not.toBeNull();
  });
});
