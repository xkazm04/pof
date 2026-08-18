import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';
import type { CLITask } from '@/lib/cli-task';

/** Captured `execute(task)` calls — the proof a dispatch did (or did not) happen. */
const executed: CLITask[] = [];
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({
    execute: async (task: CLITask) => { executed.push(task); },
    sendPrompt: () => {},
    isRunning: false,
  }),
}));

// Imported AFTER the mock so the panel picks it up.
const { AudioLibraryPanel } = await import('@/components/modules/content/audio/AudioLibraryPanel');

const SETS: AudioSet[] = [
  { id: 's1', name: 'footstep-stone', kind: 'sfx', eventKey: 'AnimNotify_FootstepEffect', surface: 'stone', loopable: false, createdAt: 0 },
  { id: 's2', name: 'cave-ambient', kind: 'ambient', eventKey: null, surface: null, loopable: true, createdAt: 0 },
];
const ASSETS: AudioAsset[] = [
  { id: 'a1', setId: 's1', filename: 'a1.mp3', relPath: 's1/a1.mp3', prompt: 'step', provider: 'elevenlabs', durationMs: 800, format: 'mp3', favorite: false, promptHash: null, createdAt: 0 },
  { id: 'a3', setId: 's2', filename: 'a3.mp3', relPath: 's2/a3.mp3', prompt: 'drip', provider: 'elevenlabs', durationMs: 9000, format: 'mp3', favorite: false, promptHash: null, createdAt: 0 },
];
const AUDIO_DIR = 'C:\\Users\\dev\\.pof\\audio';

interface Scenario {
  bySet?: Record<string, unknown>;
  preflight?: unknown;
  /** Simulate GET /api/audio/import-result failing outright. */
  importResultFails?: boolean;
  audioDir?: string | null;
}

function mockFetch(s: Scenario) {
  const mock = vi.fn().mockImplementation((url: string) => {
    const ok = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }), text: () => Promise.resolve('') });
    if (String(url).includes('/api/audio/import-result')) {
      if (s.importResultFails) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ success: false, error: 'boom' }), text: () => Promise.resolve('boom') });
      }
      return ok({
        latest: null,
        bySet: s.bySet ?? {},
        record: null,
        preflight: s.preflight ?? { ok: true, ueRoot: '/ue', scriptRelPath: 'Content/Python/import_audio_set.py', scriptAbsPath: '/ue/Content/Python/import_audio_set.py', scriptPresent: true, reason: 'found' },
      });
    }
    return ok({ sets: SETS, assets: ASSETS, usage: null, audioDir: s.audioDir === undefined ? AUDIO_DIR : s.audioDir });
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => { executed.length = 0; });
afterEach(cleanup);

describe('AudioLibraryPanel — import reports the recorded reality', () => {
  it('a set with NO import record reads as never imported, not as fine', async () => {
    mockFetch({});
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');
    const status = within(group).getByTestId('audio-import-status');
    expect(status.getAttribute('data-state')).toBe('never');
    expect(status.textContent).toContain('Never imported');
    expect(status.textContent).toContain('nothing in UE is claimed');
  });

  it('a recorded run with no cue path reads as UNVERIFIED', async () => {
    mockFetch({
      bySet: {
        'footstep-stone': { id: 1, setName: 'footstep-stone', eventKey: null, surface: null, assetsImported: 2, cuePath: null, wiredEvent: null, createdAt: Date.UTC(2026, 7, 18, 9, 30) },
      },
    });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');
    const status = within(group).getByTestId('audio-import-status');
    expect(status.getAttribute('data-state')).toBe('unverified');
    expect(status.textContent).toContain('Import not verified');
  });

  it('a complete run names the cue path and the wiring', async () => {
    mockFetch({
      bySet: {
        'footstep-stone': { id: 2, setName: 'footstep-stone', eventKey: null, surface: null, assetsImported: 3, cuePath: '/Game/Audio/footstep-stone/SC_footstep_stone', wiredEvent: 'AnimNotify_FootstepEffect|stone', createdAt: Date.UTC(2026, 7, 18, 9, 30) },
      },
    });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');
    const status = within(group).getByTestId('audio-import-status');
    expect(status.getAttribute('data-state')).toBe('imported');
    expect(status.textContent).toContain('SC_footstep_stone');
    expect(status.textContent).toContain('wired to');
  });

  it('a failed import-result fetch degrades to "never imported" (never a silent pass)', async () => {
    mockFetch({ importResultFails: true });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');
    expect(within(group).getByTestId('audio-import-status').getAttribute('data-state')).toBe('never');
  });
});

describe('AudioLibraryPanel — import preflights the UE script BEFORE dispatch', () => {
  const MISSING = {
    ok: false, ueRoot: '/ue', scriptRelPath: 'Content/Python/import_audio_set.py',
    scriptAbsPath: '/ue/Content/Python/import_audio_set.py', scriptPresent: false,
    reason: 'Missing UE dependency: /ue/Content/Python/import_audio_set.py does not exist. Import not dispatched.',
  };

  it('states the missing dependency up front, before anyone clicks', async () => {
    mockFetch({ preflight: MISSING });
    render(<AudioLibraryPanel />);
    const banner = await screen.findByTestId('audio-import-preflight');
    expect(banner.textContent).toContain('Import to UE is blocked');
    expect(banner.textContent).toContain('does not exist');
  });

  it('refuses the dispatch with the reason — no CLI task is created', async () => {
    mockFetch({ preflight: MISSING });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');

    fireEvent.click(within(group).getByTestId('import-to-ue'));

    const err = await screen.findByTestId('audio-import-error');
    expect(err.textContent).toContain('Import not dispatched for "footstep-stone"');
    expect(err.textContent).toContain('does not exist');
    expect(executed).toHaveLength(0);
  });

  it('refuses when the audio directory is unknown — paths cannot be made absolute', async () => {
    mockFetch({ audioDir: null });
    render(<AudioLibraryPanel />);
    const group = await screen.findByTestId('set-footstep-stone');

    fireEvent.click(within(group).getByTestId('import-to-ue'));

    const err = await screen.findByTestId('audio-import-error');
    expect(err.textContent).toContain('clip paths cannot be made absolute');
    expect(executed).toHaveLength(0);
  });

  it('dispatches with ABSOLUTE clip paths and the set loop flag when preflight passes', async () => {
    mockFetch({});
    render(<AudioLibraryPanel />);
    const loopGroup = await screen.findByTestId('set-cave-ambient');

    fireEvent.click(within(loopGroup).getByTestId('import-to-ue'));

    await waitFor(() => expect(executed).toHaveLength(1));
    const task = executed[0] as unknown as { setName: string; loop: boolean; assets: { srcAbsPath: string }[] };
    expect(task.setName).toBe('cave-ambient');
    // `loopable` finally reaches the dispatch — the "· loop" badge is no longer decorative.
    expect(task.loop).toBe(true);
    // No tilde: PowerShell env-var assignment never expanded `~`.
    expect(task.assets[0].srcAbsPath).toBe('C:\\Users\\dev\\.pof\\audio\\s2\\a3.mp3');
    expect(task.assets[0].srcAbsPath).not.toContain('~');
  });
});
