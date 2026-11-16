import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import { EventEditor } from '@/components/modules/content/audio/AudioEventCatalog/EventEditor';
import { BudgetStressPanel } from '@/components/modules/content/audio/AudioView/BudgetStressPanel';
import { useAudioEventCatalogStore } from '@/components/modules/content/audio/audioEventCatalogStore';
import { DEFAULT_EVENTS } from '@/components/modules/content/audio/AudioEventCatalog/constants';
import type { AudioEvent } from '@/components/modules/content/audio/AudioEventCatalog/types';

/**
 * An event's concurrency is a COUNT of voices (the catalog row's unit). Both
 * inputs that edit it — the Event Catalog editor and the stress test's per-row
 * fix — clamped 1..16 but kept fractions, so `2.5` voices was stored and handed
 * to the generator prompt as "Max concurrent: 2.5".
 */

const SCENE = 'scene-whole-voices';

const SETS = [{ id: 's-long', name: 'hit-heavy', kind: 'sfx', eventKey: null, surface: null, loopable: false, createdAt: 1 }];
const ASSETS = [
  { id: 'a1', setId: 's-long', relPath: 'hit-heavy/1.mp3', favorite: false, durationMs: 1500 },
  { id: 'a2', setId: 's-long', relPath: 'hit-heavy/2.mp3', favorite: false, durationMs: 2000 },
];

function mockLibrary() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const data = url.startsWith('/api/audio-gen')
      ? { sets: SETS, assets: ASSETS }
      : { bySet: {}, latest: null, preflight: { ok: true } };
    return { json: async () => ({ success: true, data }) } as unknown as Response;
  }));
}

const flush = async () => {
  await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); });
};

const noLibrary = { options: null, isLoading: false, error: null };

beforeEach(() => {
  vi.unstubAllGlobals();
  const catalog: AudioEvent[] = structuredClone(DEFAULT_EVENTS).map((e) =>
    e.name === 'Footstep' ? { ...e, assetSetId: 's-long' } : e);
  useAudioEventCatalogStore.setState({ byScene: { [SCENE]: catalog }, legacyEvents: null });
});
afterEach(() => { vi.unstubAllGlobals(); cleanup(); });

describe('event concurrency is a whole number of voices', () => {
  it.each([['2.5', 2], ['16.9', 16], ['0.4', 1]])('EventEditor: typed %s stores %s', (typed, expected) => {
    const onUpdate = vi.fn();
    const evt = structuredClone(DEFAULT_EVENTS[0]);
    render(<EventEditor event={evt} onUpdate={onUpdate} onClose={vi.fn()} soundLibrary={noLibrary} />);
    fireEvent.change(screen.getByLabelText('Max Simultaneous'), { target: { value: typed } });
    expect(onUpdate).toHaveBeenCalledWith({ concurrency: expected });
  });

  it('BudgetStressPanel fix: typed 2.5 stores 2 in the catalog', async () => {
    mockLibrary();
    render(<BudgetStressPanel sceneId={SCENE} voiceLimit={16} />);
    await flush();
    fireEvent.change(screen.getByLabelText('Environment triggers per second'), { target: { value: '5' } });
    const row = screen.getByTestId('budget-row-evt-5');
    fireEvent.change(within(row).getByLabelText('Footstep concurrency'), { target: { value: '2.5' } });
    const footstep = useAudioEventCatalogStore.getState().byScene[SCENE]?.find((e) => e.name === 'Footstep');
    expect(footstep?.concurrency).toBe(2);
  });
});
