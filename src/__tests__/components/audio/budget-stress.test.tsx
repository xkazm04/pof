import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { SettingsTab } from '@/components/modules/content/audio/AudioView/SettingsTab';
import { BudgetStressPanel } from '@/components/modules/content/audio/AudioView/BudgetStressPanel';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';
import type { AudioSceneDocument } from '@/types/audio-scene';

/**
 * The voice-budget stress test sits under Max Concurrent Sounds: it re-runs a
 * crowded fight against the DRAFT limit, fixes a class in the row that shows
 * the problem, and never generates or plays anything.
 */

const SCENE = '1';

const SETS = [
  { id: 's-long', name: 'hit-heavy', kind: 'sfx', eventKey: null, surface: null, loopable: false, createdAt: 1 },
  { id: 's-loop', name: 'cave-bed', kind: 'ambient', eventKey: null, surface: null, loopable: true, createdAt: 1 },
];
const ASSETS = [
  { id: 'a1', setId: 's-long', relPath: 'hit-heavy/1.mp3', favorite: false, durationMs: 1500 },
  { id: 'a2', setId: 's-long', relPath: 'hit-heavy/2.mp3', favorite: false, durationMs: 2000 },
  { id: 'a3', setId: 's-loop', relPath: 'cave-bed/1.mp3', favorite: false, durationMs: 0 },
];

function mockLibrary() {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const data = url.startsWith('/api/audio-gen')
      ? { sets: SETS, assets: ASSETS }
      : { bySet: {}, latest: null, preflight: { ok: true } };
    return { json: async () => ({ success: true, data }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Melee Hit + Footstep on a 2 s clip, Ambient Loop on a loopable bed. */
function boundCatalog(): AudioEvent[] {
  return structuredClone(DEFAULT_EVENTS).map((e) => {
    if (e.name === 'Melee Hit' || e.name === 'Footstep') return { ...e, assetSetId: 's-long' };
    if (e.name === 'Ambient Loop') return { ...e, assetSetId: 's-loop' };
    return e;
  });
}

function doc(over: Partial<AudioSceneDocument> = {}): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [], emitters: [],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
    ...over,
  } as unknown as AudioSceneDocument;
}

const flush = async () => {
  await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
};

const footstep = () => useAudioEventCatalogStore.getState().byScene[SCENE]?.find((e) => e.name === 'Footstep');

beforeEach(() => {
  vi.unstubAllGlobals();
  useAudioEventCatalogStore.setState({ byScene: { [SCENE]: boundCatalog() }, legacyEvents: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); cleanup(); });

describe('SettingsTab — budget stress test beside the voice limit', () => {
  it('re-runs against the draft limit before anything is committed', async () => {
    vi.useFakeTimers();
    mockLibrary();
    const commitSetting = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab activeDoc={doc()} commitSetting={commitSetting} />);
    await flush();

    const before = screen.getByTestId('budget-totals').textContent;
    expect(before).toMatch(/limit 16/);

    fireEvent.change(screen.getByLabelText('Max Concurrent Sounds'), { target: { value: '4' } });
    await flush();

    const after = screen.getByTestId('budget-totals').textContent;
    expect(after).toMatch(/limit 4/);
    expect(after).not.toBe(before);
    expect(commitSetting).toHaveBeenCalledTimes(0);
  });
});

describe('BudgetStressPanel — act from the result', () => {
  it('raising Footstep cooldown 100 -> 250 writes the catalog store and recomputes cooled', async () => {
    mockLibrary();
    render(<BudgetStressPanel sceneId={SCENE} voiceLimit={16} />);
    await flush();

    fireEvent.change(screen.getByLabelText('Environment triggers per second'), { target: { value: '5' } });
    const row = screen.getByTestId('budget-row-evt-5');
    const cooledBefore = within(row).getByTestId('cooled').textContent;
    expect(cooledBefore).toBe('0');

    fireEvent.change(within(row).getByLabelText('Footstep cooldown ms'), { target: { value: '250' } });

    expect(footstep()?.cooldownMs).toBe(250);
    const cooledAfter = within(screen.getByTestId('budget-row-evt-5')).getByTestId('cooled').textContent;
    expect(cooledAfter).toBe('25');
  });

  it('[guard] reads the library with GETs only and constructs no audio playback', async () => {
    const fetchMock = mockLibrary();
    const audioCtx = vi.fn();
    const audioEl = vi.fn();
    vi.stubGlobal('AudioContext', audioCtx);
    vi.stubGlobal('Audio', audioEl);
    const createElement = vi.spyOn(document, 'createElement');

    render(<BudgetStressPanel sceneId={SCENE} voiceLimit={4} />);
    await flush();
    fireEvent.change(screen.getByLabelText('Enemies'), { target: { value: '12' } });
    await flush();

    expect(fetchMock).toHaveBeenCalled();
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url === '/api/audio-gen' || url === '/api/audio/import-result').toBe(true);
      expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    }
    expect(audioCtx).not.toHaveBeenCalled();
    expect(audioEl).not.toHaveBeenCalled();
    expect(createElement.mock.calls.some(([tag]) => String(tag).toLowerCase() === 'audio')).toBe(false);
  });
});
