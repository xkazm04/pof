import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';

/** Deleting an event row is one click on a hover-revealed X; Undo must restore it. */

const SCENE = 'scene-undo-delete';
const ROW: AudioEvent = {
  id: 'evt-keep', name: 'Sword Hit', category: 'combat', trigger: 'OnHit', priority: 'normal',
  spatial: '3d', concurrency: 2, cooldownMs: 50, tags: ['metal', 'impact'], assetSetId: 'set-1',
};
const OTHER: AudioEvent = { ...ROW, id: 'evt-other', name: 'Shield Block', tags: [], assetSetId: null };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, error: 'offline' }) })));
  useAudioEventCatalogStore.setState({ byScene: { [SCENE]: [ROW, OTHER] }, legacyEvents: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); cleanup(); });

const stored = () => useAudioEventCatalogStore.getState().byScene[SCENE] ?? [];

describe('AudioEventCatalog - undo a deleted event', () => {
  it('delete then Undo restores the same row at its position', async () => {
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete event Sword Hit' }));
    await act(async () => { await Promise.resolve(); });
    expect(stored().map((e) => e.id)).toEqual(['evt-other']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await act(async () => { await Promise.resolve(); });
    expect(stored()).toEqual([ROW, OTHER]);
  });
});
