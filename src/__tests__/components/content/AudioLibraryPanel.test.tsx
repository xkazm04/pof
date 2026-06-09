import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { AudioLibraryPanel } from '@/components/modules/content/audio/AudioLibraryPanel';
import type { AudioAsset, AudioSet, AudioUsageSummary } from '@/types/audio-asset';

function set(over: Partial<AudioSet> & { id: string; name: string }): AudioSet {
  return {
    id: over.id, name: over.name, kind: over.kind ?? 'sfx',
    eventKey: over.eventKey ?? null, surface: over.surface ?? null,
    loopable: over.loopable ?? false, createdAt: 0,
  };
}
function asset(over: Partial<AudioAsset> & { id: string; setId: string }): AudioAsset {
  return {
    id: over.id, setId: over.setId, filename: over.filename ?? `${over.id}.mp3`,
    relPath: `${over.setId}/${over.id}.mp3`, prompt: over.prompt ?? 'p',
    provider: 'elevenlabs', durationMs: over.durationMs ?? 1500, format: 'mp3',
    favorite: over.favorite ?? false, promptHash: over.promptHash ?? null, createdAt: 0,
  };
}

const USAGE: AudioUsageSummary = {
  generated: 12, cached: 4, quota: 200, windowStart: 0, totalGenerated: 30, totalCached: 9,
};

const SETS = [
  set({ id: 's1', name: 'footstep-stone', kind: 'sfx', eventKey: 'footstep', surface: 'stone' }),
  set({ id: 's2', name: 'cave-ambient', kind: 'ambient' }),
];
const ASSETS = [
  asset({ id: 'a1', setId: 's1', durationMs: 800, favorite: false, prompt: 'footstep stone dry' }),
  asset({ id: 'a2', setId: 's1', durationMs: 1500, favorite: true }),
  asset({ id: 'a3', setId: 's2', durationMs: 12000, prompt: 'cave drip echo' }),
];

/** fetch mock: GET returns the library; PATCH echoes the toggled asset. */
function mockLibraryFetch() {
  const mock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'PATCH') {
      const parsed = init?.body ? JSON.parse(init.body as string) : {};
      const body = { success: true, data: { asset: { ...ASSETS[0], id: parsed.assetId, favorite: parsed.favorite } } };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
    }
    const body = { success: true, data: { sets: SETS, assets: ASSETS, usage: USAGE } };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve('') });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

describe('AudioLibraryPanel — faceted search', () => {
  it('renders the usage meter and all variations by default', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('audio-usage-meter')).toBeTruthy());
    expect(screen.getByTestId('audio-usage-count').textContent).toContain('12');
    expect(screen.getByTestId('audio-result-count').textContent).toContain('3 variation');
    expect(screen.getByTestId('set-footstep-stone')).toBeTruthy();
    expect(screen.getByTestId('set-cave-ambient')).toBeTruthy();
  });

  it('filters by kind facet (ambient hides the sfx set)', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('set-footstep-stone')).toBeTruthy());

    fireEvent.change(screen.getByTestId('facet-kind'), { target: { value: 'ambient' } });

    expect(screen.queryByTestId('set-footstep-stone')).toBeNull();
    expect(screen.getByTestId('set-cave-ambient')).toBeTruthy();
    expect(screen.getByTestId('audio-result-count').textContent).toContain('1 of 3');
  });

  it('filters favorites only', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('asset-a1')).toBeTruthy());

    fireEvent.click(screen.getByTestId('facet-favorites'));

    expect(screen.queryByTestId('asset-a1')).toBeNull();
    expect(screen.getByTestId('asset-a2')).toBeTruthy();
    expect(screen.queryByTestId('asset-a3')).toBeNull();
  });

  it('text search matches prompt content', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('asset-a3')).toBeTruthy());

    fireEvent.change(screen.getByTestId('audio-search'), { target: { value: 'drip' } });

    expect(screen.getByTestId('asset-a3')).toBeTruthy();
    expect(screen.queryByTestId('asset-a1')).toBeNull();
  });

  it('toggles a favorite via PATCH (optimistic aria-pressed)', async () => {
    const mock = mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('favorite-a1')).toBeTruthy());

    const star = screen.getByTestId('favorite-a1');
    expect(star.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(star);
    expect(star.getAttribute('aria-pressed')).toBe('true');

    await waitFor(() => {
      const patched = mock.mock.calls.some(([, init]) => (init?.method ?? '').toUpperCase() === 'PATCH');
      expect(patched).toBe(true);
    });
  });

  it('shows a no-matches state when filters exclude everything', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('audio-search')).toBeTruthy());

    fireEvent.change(screen.getByTestId('audio-search'), { target: { value: 'zzz-nothing-matches' } });

    expect(screen.getByTestId('audio-no-matches')).toBeTruthy();
  });

  it('each variation row carries a waveform thumbnail', async () => {
    mockLibraryFetch();
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('asset-a1')).toBeTruthy());
    const row = screen.getByTestId('asset-a1');
    expect(within(row).getByLabelText('Audio waveform')).toBeTruthy();
  });
});
