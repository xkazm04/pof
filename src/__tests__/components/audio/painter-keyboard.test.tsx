import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import type { SceneDraft } from '@/components/modules/content/audio/AudioScenePainter/types';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/** Keyboard parity with pointer editing: focus, select, nudge and delete zones/emitters. */

const zone: AudioZone = {
  id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
  soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
  reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
  occlusionMode: 'medium', priority: 5, color: '',
};
const emitter: SoundEmitter = {
  id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
  attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
  spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
};

function setup(sel: { z?: string | null; e?: string | null } = {}) {
  const onCommit = vi.fn<(n: SceneDraft) => Promise<unknown>>().mockResolvedValue(undefined);
  const onSelectZone = vi.fn();
  const onSelectEmitter = vi.fn();
  const { container } = render(
    <AudioScenePainter
      zones={[zone]} emitters={[emitter]} onUpdateZones={vi.fn()} onUpdateEmitters={vi.fn()}
      onCommit={onCommit} onSelectZone={onSelectZone} onSelectEmitter={onSelectEmitter}
      selectedZoneId={sel.z ?? null} selectedEmitterId={sel.e ?? null} accentColor={ACCENT_CYAN_LIGHT}
    />,
  );
  return { container, onCommit, onSelectZone, onSelectEmitter };
}

const focusables = (c: HTMLElement) => ({
  zone: c.querySelector('[data-zone-id="z1"]') as SVGElement,
  emitter: c.querySelector('[data-emitter-id="e1"]') as SVGElement,
  zoneDel: c.querySelector('[data-testid="zone-delete-z1"]') as SVGElement | null,
  emitterDel: c.querySelector('[data-testid="emitter-delete-e1"]') as SVGElement | null,
});
const reachable = (el: Element | null) =>
  !!el && el.getAttribute('role') === 'button' && el.hasAttribute('tabindex') && !!el.getAttribute('aria-label');

afterEach(cleanup);

describe('AudioScenePainter - keyboard parity', () => {
  it('zone/emitter bodies and both delete controls are focusable buttons (4 of 4)', () => {
    const z = focusables(setup({ z: 'z1' }).container);
    const e = focusables(setup({ e: 'e1' }).container);
    const count = [z.zone, z.emitter, z.zoneDel, e.emitterDel].filter(reachable).length;
    expect(count).toBe(4);
  });

  it('Enter selects the focused item', () => {
    const { container, onSelectZone, onSelectEmitter } = setup();
    fireEvent.keyDown(focusables(container).zone, { key: 'Enter' });
    expect(onSelectZone).toHaveBeenCalledWith('z1');
    fireEvent.keyDown(focusables(container).emitter, { key: 'Enter' });
    expect(onSelectEmitter).toHaveBeenCalledWith('e1');
  });

  it('Delete on a focused zone commits deleteZone once', async () => {
    const { container, onCommit } = setup();
    await act(async () => { fireEvent.keyDown(focusables(container).zone, { key: 'Delete' }); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].zones).toHaveLength(0);
  });

  it('Delete on a focused emitter commits deleteEmitter once', async () => {
    const { container, onCommit } = setup();
    await act(async () => { fireEvent.keyDown(focusables(container).emitter, { key: 'Backspace' }); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].emitters).toHaveLength(0);
  });

  it('arrow keys nudge through the op buffer and commit once on key release', async () => {
    const { container, onCommit } = setup();
    const body = focusables(container).zone;
    fireEvent.keyDown(body, { key: 'ArrowRight' });
    fireEvent.keyDown(body, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(body, { key: 'ArrowDown' });
    expect(onCommit).not.toHaveBeenCalled();
    await act(async () => { fireEvent.keyUp(body, { key: 'ArrowDown' }); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].zones[0].x).toBe(111);
    expect(onCommit.mock.calls[0][0].zones[0].y).toBe(101);
  });

  it('the delete controls respond to Enter', async () => {
    const { container, onCommit } = setup({ z: 'z1' });
    await act(async () => { fireEvent.keyDown(focusables(container).zoneDel!, { key: 'Enter' }); });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].zones).toHaveLength(0);
  });
});
