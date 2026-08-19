import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { PainterTab } from '@/components/modules/content/audio/AudioView/PainterTab';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioSceneDocument, AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * The property panel used to call `onUpdate({ ...zone, [key]: value })` on every
 * keystroke and every slider frame, and the consumer routed that to `updateDoc`
 * — a PUT of the whole scene plus a refetch of EVERY scene per character, with
 * the failure swallowed into `null`.
 *
 * These tests pin the replacement contract: local edit now, ONE write per commit
 * boundary through the throwing path, a failure that is visible and retryable,
 * and a draft that outlives a round-trip-stale server copy.
 */

function zone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '',
    ...over,
  };
}

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
    ...over,
  };
}

function doc(over: Partial<AudioSceneDocument> = {}): AudioSceneDocument {
  return {
    id: 1, name: 'Scene', description: '', zones: [zone()], emitters: [emitter()],
    soundPoolSize: 32, maxConcurrentSounds: 16, globalReverbPreset: 'none',
    lastGeneratedAt: null, createdAt: '', updatedAt: '',
    ...over,
  } as AudioSceneDocument;
}

/** Type a word one character at a time, as a user does. */
function typeInto(el: HTMLElement, text: string) {
  for (let i = 1; i <= text.length; i++) {
    fireEvent.change(el, { target: { value: text.slice(0, i) } });
  }
}

const settle = async (ms = UI_TIMEOUTS.textEditDebounce + 50) => {
  await act(async () => { vi.advanceTimersByTime(ms); });
};

const noopCli = { isRunning: false, sendPrompt: vi.fn() } as unknown as never;

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); cleanup(); });

function renderZonePanel(onCommit: (patch: Partial<AudioZone>) => Promise<unknown>, z = zone()) {
  return render(
    <ZonePropertyPanel
      zone={z}
      onCommit={onCommit}
      onGenerateCode={vi.fn()}
      onGenerateSoundscape={vi.fn()}
      accentColor={ACCENT_CYAN_LIGHT}
      isGenerating={false}
    />,
  );
}

describe('ZonePropertyPanel — commits, not keystrokes', () => {
  it('writes zero times while typing a name and once after the pause', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderZonePanel(onCommit);

    const name = screen.getByLabelText('Zone name') as HTMLInputElement;
    typeInto(name, 'Cavern Hall');
    // Measured against HEAD's panel: 10 writes for these 11 keystrokes (one
    // prefix matched the never-advancing controlled value, so React elided it).
    expect(onCommit).toHaveBeenCalledTimes(0);
    expect(name.value).toBe('Cavern Hall');

    await settle();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ name: 'Cavern Hall' });
  });

  it('collapses a whole slider drag into one write, on release', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderZonePanel(onCommit);

    const slider = screen.getByLabelText('Attenuation Radius') as HTMLInputElement;
    for (const v of ['210', '220', '230', '240']) {
      fireEvent.change(slider, { target: { value: v } });
    }
    expect(onCommit).toHaveBeenCalledTimes(0); // ← was 4
    expect(slider.value).toBe('240');

    await act(async () => { fireEvent.pointerUp(slider); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ attenuationRadius: 240 });

    // The release consumed the pending debounce — no second write follows it.
    await settle();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('commits a discrete chip click immediately', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    renderZonePanel(onCommit);

    await act(async () => { fireEvent.click(screen.getByLabelText('Reverb preset forest')); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ reverbPreset: 'forest' });
  });

  it('keeps the typed value and offers a retry when the write fails', async () => {
    const onCommit = vi.fn()
      .mockRejectedValueOnce(new Error('Scene write rejected by the server'))
      .mockResolvedValue(undefined);
    renderZonePanel(onCommit);

    const name = screen.getByLabelText('Zone name') as HTMLInputElement;
    typeInto(name, 'Deep Cavern');
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Scene write rejected by the server');
    expect(name.value).toBe('Deep Cavern'); // the buffer survived the failure

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Retry/i })); });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith({ name: 'Deep Cavern' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not let a round-trip-stale server value clobber a newer edit', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderZonePanel(onCommit);

    const name = screen.getByLabelText('Zone name') as HTMLInputElement;
    typeInto(name, 'Newer');

    // A refetch triggered by some other write lands with the OLD server value.
    rerender(
      <ZonePropertyPanel
        zone={zone({ name: 'Cavern' })}
        onCommit={onCommit}
        onGenerateCode={vi.fn()}
        onGenerateSoundscape={vi.fn()}
        accentColor={ACCENT_CYAN_LIGHT}
        isGenerating={false}
      />,
    );
    expect((screen.getByLabelText('Zone name') as HTMLInputElement).value).toBe('Newer');
  });

  it('flushes a pending edit when the panel is unmounted (deselect)', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderZonePanel(onCommit);

    typeInto(screen.getByLabelText('Zone name'), 'Half typed');
    expect(onCommit).toHaveBeenCalledTimes(0);

    await act(async () => { unmount(); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ name: 'Half typed' });
  });
});

describe('EmitterPropertyPanel — commits, not keystrokes', () => {
  it('debounces the sound cue path into one write', async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(
      <EmitterPropertyPanel emitter={emitter()} onCommit={onCommit} accentColor={ACCENT_CYAN_LIGHT} />,
    );

    const cue = screen.getByLabelText('Sound cue path') as HTMLInputElement;
    typeInto(cue, '/Game/Audio/SC_Drip');
    expect(onCommit).toHaveBeenCalledTimes(0); // ← was 19

    await settle();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ soundCueRef: '/Game/Audio/SC_Drip' });
  });

  it('surfaces a failed emitter write without discarding the value', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('DB is locked'));
    render(
      <EmitterPropertyPanel emitter={emitter()} onCommit={onCommit} accentColor={ACCENT_CYAN_LIGHT} />,
    );

    const name = screen.getByLabelText('Emitter name') as HTMLInputElement;
    typeInto(name, 'Water');
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('DB is locked');
    expect(name.value).toBe('Water');
  });
});

describe('PainterTab — routes panel patches to the throwing commit path', () => {
  it('hands the zone id + patch to commitZonePatch, not a whole-zone updateDoc', async () => {
    const commitZonePatch = vi.fn().mockResolvedValue(undefined);
    const commitEmitterPatch = vi.fn().mockResolvedValue(undefined);
    const d = doc();
    render(
      <PainterTab
        activeDoc={d}
        commitScene={vi.fn().mockResolvedValue(undefined)}
        commitZones={vi.fn().mockResolvedValue(undefined)}
        commitEmitters={vi.fn().mockResolvedValue(undefined)}
        setSelectedZoneId={vi.fn()}
        setSelectedEmitterId={vi.fn()}
        selectedZoneId="z1"
        selectedEmitterId={null}
        selectedZone={d.zones[0]}
        selectedEmitter={null}
        commitZonePatch={commitZonePatch}
        commitEmitterPatch={commitEmitterPatch}
        handleGenerateZoneCode={vi.fn()}
        handleGenerateSoundscape={vi.fn()}
        audioCli={noopCli}
      />,
    );

    typeInto(screen.getByLabelText('Zone name'), 'Sunken');
    expect(commitZonePatch).toHaveBeenCalledTimes(0);

    await settle();
    expect(commitZonePatch).toHaveBeenCalledTimes(1);
    expect(commitZonePatch).toHaveBeenCalledWith('z1', { name: 'Sunken' });
  });
});
