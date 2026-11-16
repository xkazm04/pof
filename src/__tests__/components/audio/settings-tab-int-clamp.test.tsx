import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { SettingsTab } from '@/components/modules/content/audio/AudioView/SettingsTab';
import { UI_TIMEOUTS } from '@/lib/constants';
import type { AudioSceneDocument } from '@/types/audio-scene';

/**
 * Sound Pool Size and Max Concurrent Sounds are emitted verbatim into generated
 * C++ (`int32 SoundPoolSize = ${doc.soundPoolSize};`). The inputs used to clamp
 * only the floor, so a typed `2.5` reached the codegen as `int32 ... = 2.5;` and
 * `9999` sailed past the field's own `max`. The draft is now a whole number
 * inside the field's declared range.
 */

function doc(): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [], emitters: [],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
  } as unknown as AudioSceneDocument;
}

afterEach(() => { vi.useRealTimers(); cleanup(); });

async function typeAndSettle(name: RegExp, value: string) {
  const input = screen.getByRole('spinbutton', { name }) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  await act(async () => { vi.advanceTimersByTime(UI_TIMEOUTS.textEditDebounce + 10); });
  await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

}

describe('SettingsTab — numeric settings are engine integers in range', () => {
  it.each([
    [/Sound Pool Size/i, 'soundPoolSize', '2.5', 2],
    [/Sound Pool Size/i, 'soundPoolSize', '9999', 256],
    [/Max Concurrent Sounds/i, 'maxConcurrentSounds', '7.9', 7],
    [/Max Concurrent Sounds/i, 'maxConcurrentSounds', '500', 128],
    [/Max Concurrent Sounds/i, 'maxConcurrentSounds', '', 1],
  ])('%s typed %s commits %s', async (name, key, typed, expected) => {
    vi.useFakeTimers();
    const commitSetting = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab activeDoc={doc()} commitSetting={commitSetting} />);
    await typeAndSettle(name as RegExp, typed as string);
    expect(commitSetting).toHaveBeenCalledWith(key, expected);
  });
});
