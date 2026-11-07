import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SettingsTab } from '@/components/modules/content/audio/AudioView/SettingsTab';
import type { SceneBuffer } from '@/components/modules/content/audio/AudioView/useSceneBuffer';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';

/**
 * The Soundscapes tab renders zones from the AudioView session buffer (unsaved
 * or refused painter edits included); the Settings tab's Zone Overview read the
 * server `activeDoc` — so a renamed zone still waiting on its write showed the
 * OLD name and emitter count under Settings while every other tab showed the new.
 */

afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

const activeDoc = {
  id: 1, name: 'Scene', description: '', zones: [zone()], emitters: [],
  soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
  lastGeneratedAt: null, createdAt: '', updatedAt: '',
} as unknown as AudioSceneDocument;

function buffer(zones: AudioZone[]): SceneBuffer {
  return {
    scene: { zones, emitters: [] }, isDirty: true, isSaving: false, saveError: 'refused',
    stage: vi.fn(), stageDebounced: vi.fn(), commit: vi.fn(), flush: vi.fn(),
    retry: vi.fn(), dismissError: vi.fn(), peek: () => ({ zones, emitters: [] }),
  };
}

describe('SettingsTab Zone Overview — the scene as the session has it', () => {
  it('shows a buffered zone rename and a buffered new zone', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, error: 'offline' }) })));
    render(
      <SettingsTab
        activeDoc={activeDoc}
        commitSetting={vi.fn().mockResolvedValue(undefined)}
        scene={buffer([zone({ name: 'Flooded Cavern' }), zone({ id: 'z2', name: 'Shaft' })])}
      />,
    );
    // The stress panel renders a table too; the Zone Overview is the last one.
    const table = screen.getAllByRole('table').at(-1)!;
    expect(within(table).queryByText('Cavern')).toBeNull();
    expect(within(table).getByText('Flooded Cavern')).toBeTruthy();
    expect(within(table).getByText('Shaft')).toBeTruthy();
  });
});
