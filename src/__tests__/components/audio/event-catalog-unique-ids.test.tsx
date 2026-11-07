import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';

/**
 * New events were keyed `evt-${Date.now()}`: two adds in the same millisecond
 * got the SAME id — a duplicate React key, and an edit or delete aimed at one
 * row hit both. Ids are now unique per add regardless of the clock.
 */

const SCENE = 'scene-unique-ids';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, error: 'offline' }) })));
  useAudioEventCatalogStore.setState({ byScene: { [SCENE]: [] }, legacyEvents: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); cleanup(); });

describe('AudioEventCatalog — added events get unique ids', () => {
  it('two adds within one millisecond produce two ids', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={vi.fn()} isGenerating={false} />);
    const add = screen.getByRole('button', { name: 'Add Combat event' });
    fireEvent.click(add);
    fireEvent.click(add);
    await act(async () => { await Promise.resolve(); });
    const ids = (useAudioEventCatalogStore.getState().byScene[SCENE] ?? []).map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
