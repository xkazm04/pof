import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioEventCatalog } from '@/components/modules/content/audio/AudioEventCatalog';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';

/**
 * The catalog reads the generated-audio library (GET only), binds the confident
 * matches in one click, and "Generate Audio Manager" hands the prompt builder the
 * bound sets' REAL import status. Nothing here generates or plays audio.
 */

const SCENE = 'scene-sound-test';
const CUE = '/Game/Audio/footstep-stone/SC_footstep-stone';

const SETS = [
  { id: 's1', name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone', loopable: false, createdAt: 1 },
];
const ASSETS = [
  { id: 'a1', setId: 's1', relPath: 'footstep-stone/1.mp3', favorite: false },
  { id: 'a2', setId: 's1', relPath: 'footstep-stone/2.mp3', favorite: false },
];
const IMPORTS = {
  'footstep-stone': { id: 1, setName: 'footstep-stone', eventKey: 'footstep', surface: 'stone', assetsImported: 2, cuePath: CUE, wiredEvent: null, createdAt: 1 },
};

function mockLibrary() {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const data = url.startsWith('/api/audio-gen')
      ? { sets: SETS, assets: ASSETS }
      : { bySet: IMPORTS, latest: null, preflight: { ok: true } };
    return { json: async () => ({ success: true, data }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const flush = async () => {
  await act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });
};

beforeEach(() => {
  vi.unstubAllGlobals();
  useAudioEventCatalogStore.setState({ byScene: {}, legacyEvents: null });
});
afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

describe('AudioEventCatalog — library sound binding', () => {
  it('applies the confident suggestion with GET-only reads', async () => {
    const fetchMock = mockLibrary();
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={vi.fn()} isGenerating={false} />);
    await flush();

    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Apply 1 suggestion/ })); });

    const stored = useAudioEventCatalogStore.getState().getEvents(SCENE);
    expect(stored?.find((e) => e.id === 'evt-5')?.assetSetId).toBe('s1');

    expect(fetchMock).toHaveBeenCalled();
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url === '/api/audio-gen' || url === '/api/audio/import-result').toBe(true);
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    }
  });

  it('hands onGenerate the bound set with its real import path', async () => {
    mockLibrary();
    const onGenerate = vi.fn();
    render(<AudioEventCatalog sceneId={SCENE} onGenerate={onGenerate} isGenerating={false} />);
    await flush();

    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: /Apply 1 suggestion/ })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Audio Manager/ })); });

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const config = onGenerate.mock.calls[0][0];
    expect(config.bindings?.s1).toEqual({ setName: 'footstep-stone', cuePath: CUE });
  });
});
