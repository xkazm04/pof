import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { SoundscapesTab } from '@/components/modules/content/audio/AudioView/SoundscapesTab';
import { SettingsTab } from '@/components/modules/content/audio/AudioView/SettingsTab';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { AudioSceneDocument, AudioZone } from '@/types/audio-scene';

/**
 * Every keystroke in these tabs used to PUT the whole scene and refetch EVERY
 * scene. They now hold the edit locally and write once per typing pause.
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 0, y: 0, width: 100, height: 100,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

function doc(over: Partial<AudioSceneDocument> = {}): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [], emitters: [],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
    ...over,
  } as unknown as AudioSceneDocument;
}

const noopCli = { isRunning: false, sendPrompt: vi.fn() } as unknown as never;

/** Type a word one character at a time, as a user does. */
function typeInto(el: HTMLElement, text: string) {
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(el, { target: { value: text.slice(0, i) } });
  }
}

const settle = async (ms = UI_TIMEOUTS.textEditDebounce + 50) => {
  await act(async () => { vi.advanceTimersByTime(ms); });
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('SoundscapesTab — debounced scene description', () => {
  it('writes once per typing pause, not once per keystroke', async () => {
    const commitDescription = vi.fn().mockResolvedValue(undefined);
    render(
      <SoundscapesTab
        activeDoc={doc()}
        commitDescription={commitDescription}
        commitZones={vi.fn().mockResolvedValue(undefined)}
        handleGenerateSoundscape={vi.fn()}
        audioCli={noopCli}
      />,
    );

    const field = screen.getByLabelText('Scene description');
    typeInto(field, 'damp cave');
    expect(commitDescription).toHaveBeenCalledTimes(0); // ← was 9
    expect((field as HTMLTextAreaElement).value).toBe('damp cave');

    await settle();
    expect(commitDescription).toHaveBeenCalledTimes(1);
    expect(commitDescription).toHaveBeenCalledWith('damp cave');
  });

  it('uses the shared UI_TIMEOUTS delay, not a magic number', async () => {
    const commitDescription = vi.fn().mockResolvedValue(undefined);
    render(
      <SoundscapesTab
        activeDoc={doc()}
        commitDescription={commitDescription}
        commitZones={vi.fn().mockResolvedValue(undefined)}
        handleGenerateSoundscape={vi.fn()}
        audioCli={noopCli}
      />,
    );
    fireEvent.change(screen.getByLabelText('Scene description'), { target: { value: 'x' } });
    await act(async () => { vi.advanceTimersByTime(UI_TIMEOUTS.textEditDebounce - 1); });
    expect(commitDescription).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(commitDescription).toHaveBeenCalledTimes(1);
  });

  it('keeps the typed text and offers a retry when the write fails', async () => {
    const commitDescription = vi.fn()
      .mockRejectedValueOnce(new Error('Scene write rejected by the server'))
      .mockResolvedValue(undefined);
    render(
      <SoundscapesTab
        activeDoc={doc()}
        commitDescription={commitDescription}
        commitZones={vi.fn().mockResolvedValue(undefined)}
        handleGenerateSoundscape={vi.fn()}
        audioCli={noopCli}
      />,
    );

    const field = screen.getByLabelText('Scene description') as HTMLTextAreaElement;
    typeInto(field, 'echoing hall');
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Scene write rejected by the server');
    expect(field.value).toBe('echoing hall'); // the buffer survived the failure

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Retry/i })); });
    expect(commitDescription).toHaveBeenCalledTimes(2);
    expect(commitDescription).toHaveBeenLastCalledWith('echoing hall');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('per-zone soundscape text debounces into one whole-zone-array write', async () => {
    const commitZones = vi.fn().mockResolvedValue(undefined);
    render(
      <SoundscapesTab
        activeDoc={doc({ zones: [zone(), zone({ id: 'z2', name: 'Hall' })] })}
        commitDescription={vi.fn().mockResolvedValue(undefined)}
        commitZones={commitZones}
        handleGenerateSoundscape={vi.fn()}
        audioCli={noopCli}
      />,
    );

    const field = screen.getByLabelText('Soundscape description for Cavern');
    typeInto(field, 'dripping');
    expect(commitZones).toHaveBeenCalledTimes(0); // ← was 8

    await settle();
    expect(commitZones).toHaveBeenCalledTimes(1);
    const zones = commitZones.mock.calls[0][0] as AudioZone[];
    expect(zones).toHaveLength(2);
    expect(zones[0].soundscapeDescription).toBe('dripping');
    expect(zones[1].soundscapeDescription).toBe('');
  });
});

describe('SettingsTab — debounced numeric settings', () => {
  it('collapses a run of increments into a single write', async () => {
    const commitSetting = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab activeDoc={doc()} commitSetting={commitSetting} />);

    const pool = screen.getByRole('spinbutton', { name: /Sound Pool Size/i }) as HTMLInputElement;
    for (const v of ['33', '34', '35', '36']) {
      fireEvent.change(pool, { target: { value: v } });
    }
    expect(commitSetting).toHaveBeenCalledTimes(0); // ← was 4
    expect(pool.value).toBe('36');

    await settle();
    expect(commitSetting).toHaveBeenCalledTimes(1);
    expect(commitSetting).toHaveBeenCalledWith('soundPoolSize', 36);
  });

  it('surfaces a failed settings write without discarding the value', async () => {
    const commitSetting = vi.fn().mockRejectedValue(new Error('DB is locked'));
    render(<SettingsTab activeDoc={doc()} commitSetting={commitSetting} />);

    const pool = screen.getByRole('spinbutton', { name: /Sound Pool Size/i }) as HTMLInputElement;
    fireEvent.change(pool, { target: { value: '64' } });
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('DB is locked');
    expect(pool.value).toBe('64');
  });
});
