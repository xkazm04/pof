import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { AudioLibraryPanel } from '@/components/modules/content/audio/AudioLibraryPanel';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

const SETS: AudioSet[] = [
  { id: 's1', name: 'footstep-stone', kind: 'sfx', eventKey: null, surface: null, loopable: false, createdAt: 0 },
];
const ASSETS: AudioAsset[] = [
  { id: 'a1', setId: 's1', filename: 'a1.mp3', relPath: 's1/a1.mp3', prompt: 'step', provider: 'elevenlabs', durationMs: 800, format: 'mp3', favorite: false, promptHash: null, createdAt: 0 },
];

function mockFetch(opts: { disk?: unknown; deleteData?: unknown } = {}) {
  const mock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const ok = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve('') });
    if ((init?.method ?? 'GET').toUpperCase() === 'DELETE') {
      return ok(opts.deleteData ?? { deleted: 'set', dbRowDeleted: true, fileRemoval: { ok: true, path: '/x', removed: 1 } });
    }
    if (String(url).includes('/api/audio/import-result')) return ok({ latest: null, bySet: {}, preflight: null });
    return ok({
      sets: SETS, assets: ASSETS, usage: null, audioDir: 'C:\\a',
      disk: opts.disk === undefined ? { bytes: 3_145_728, files: 7 } : opts.disk,
    });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(cleanup);

describe('AudioLibraryPanel — the library states its real disk footprint', () => {
  it('renders bytes + file count from the server', async () => {
    mockFetch();
    render(<AudioLibraryPanel />);
    const fp = await screen.findByTestId('audio-disk-footprint');
    expect(fp.textContent).toContain('3.0 MB');
    expect(fp.textContent).toContain('7 files');
  });

  it('omits the footprint rather than inventing one when the server reports none', async () => {
    mockFetch({ disk: null });
    render(<AudioLibraryPanel />);
    await waitFor(() => expect(screen.getByTestId('set-footstep-stone')).toBeTruthy());
    expect(screen.queryByTestId('audio-disk-footprint')).toBeNull();
  });
});

describe('AudioLibraryPanel — a failed file removal is reported, not swallowed', () => {
  it('states BOTH outcomes: the row went, the bytes did not', async () => {
    mockFetch({
      deleteData: {
        deleted: 'set', dbRowDeleted: true,
        fileRemoval: { ok: false, path: 'C:\\a\\s1', removed: 0, reason: 'EPERM: operation not permitted' },
      },
    });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');

    fireEvent.click(within(group).getByLabelText('Delete set footstep-stone'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Deleted set "footstep-stone" from the database');
    expect(alert.textContent).toContain('files were NOT removed');
    expect(alert.textContent).toContain('C:\\a\\s1');
    expect(alert.textContent).toContain('EPERM');
    expect(alert.textContent).toContain('still on disk');
  });

  it('a clean delete reports nothing (no false alarm)', async () => {
    mockFetch();
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');

    fireEvent.click(within(group).getByLabelText('Delete set footstep-stone'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
