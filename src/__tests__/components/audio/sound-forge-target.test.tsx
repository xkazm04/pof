import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { SoundForgePanel } from '@/components/modules/content/audio/SoundForgePanel';
import { AudioLibraryPanel } from '@/components/modules/content/audio/AudioLibraryPanel';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

/**
 * Generation is PAID. Every fetch here is a mock: the GET is the free local
 * library read, the POST is the billed call and must only follow an explicit
 * Generate click, aimed at the chosen set with continued take numbers.
 */

afterEach(cleanup);

const S1: AudioSet = {
  id: 'S1', name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone',
  loopable: false, createdAt: 0,
};
function asset(id: string, prompt: string): AudioAsset {
  return {
    id, setId: 'S1', filename: `${id}.mp3`, relPath: `S1/${id}.mp3`, prompt,
    provider: 'elevenlabs', durationMs: 1500, format: 'mp3', favorite: false, promptHash: null, createdAt: 0,
  };
}
const ASSETS = [asset('a1', 'p (variation 1)'), asset('a2', 'p (variation 2)'), asset('a3', 'p (variation 3)')];

const reply = (data: unknown) => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve(''),
});

function mockAudioFetch() {
  let n = 0;
  const mock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (url.startsWith('/api/audio-gen') && method === 'POST') {
      n += 1;
      const body = JSON.parse(init!.body as string) as { prompt: string };
      return reply({ asset: { ...asset(`new${n}`, body.prompt) }, set: S1, cached: false });
    }
    if (url.startsWith('/api/audio-gen')) {
      return reply({ sets: [S1], assets: ASSETS, usage: null, audioDir: 'C:/audio', disk: null });
    }
    return reply({ bySet: {}, preflight: null });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

const posts = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.filter(([url, init]) =>
    String(url).startsWith('/api/audio-gen') && ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase() === 'POST');
const gets = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.filter(([url, init]) =>
    String(url).startsWith('/api/audio-gen') && ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase() === 'GET');

describe('SoundForgePanel aimed at a library set', () => {
  it('reads the library on mount without spending, then adds takes 4-5 into S1 on one Generate click', async () => {
    const mock = mockAudioFetch();
    render(<SoundForgePanel initialTargetSetId="S1" />);

    await waitFor(() => expect(screen.getByTestId('forge-plan').textContent).toContain('footstep-stone'));
    expect(posts(mock)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Variations'), { target: { value: '2' } });
    expect(screen.getByTestId('forge-plan').textContent).toContain('takes 4-5 into footstep-stone');
    expect(posts(mock)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => expect(posts(mock)).toHaveLength(2));
    const bodies = posts(mock).map(([, init]) => JSON.parse((init as RequestInit).body as string));
    expect(bodies.map((b) => b.setId)).toEqual(['S1', 'S1']);
    expect(bodies[0].prompt.endsWith('(variation 4)')).toBe(true);
    expect(bodies[1].prompt.endsWith('(variation 5)')).toBe(true);
    // The next plan must see the new takes: the library is re-read after the run.
    await waitFor(() => expect(gets(mock).length).toBeGreaterThanOrEqual(2));
    expect(posts(mock)).toHaveLength(2);
  });
});

describe('AudioLibraryPanel — More takes', () => {
  it('hands the set id to the Forge and spends nothing', async () => {
    const mock = mockAudioFetch();
    const spy = vi.fn();
    render(<AudioLibraryPanel onMoreTakes={spy} />);
    await waitFor(() => expect(screen.getByTestId('set-footstep-stone')).toBeTruthy());
    fireEvent.click(screen.getByTestId('more-takes-S1'));
    expect(spy).toHaveBeenCalledWith('S1');
    expect(posts(mock)).toHaveLength(0);
  });

  it('[guard] without onMoreTakes there is no More takes control', async () => {
    mockAudioFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('set-footstep-stone')).toBeTruthy());
    expect(screen.queryByTestId('more-takes-S1')).toBeNull();
    expect(screen.queryByRole('button', { name: /more takes/i })).toBeNull();
  });
});
