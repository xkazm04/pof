import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * Hit-testing contract of the scene painter canvas: which presses reach the
 * canvas handler (pan / deselect / draw / place) and which belong to an item.
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

function renderPainter(over: { zones?: AudioZone[]; emitters?: SoundEmitter[]; selectedZoneId?: string | null; selectedEmitterId?: string | null } = {}) {
  const props = {
    zones: over.zones ?? [zone()],
    emitters: over.emitters ?? [emitter()],
    onUpdateZones: vi.fn(),
    onUpdateEmitters: vi.fn(),
    onSelectZone: vi.fn(),
    onSelectEmitter: vi.fn(),
    selectedZoneId: over.selectedZoneId ?? null,
    selectedEmitterId: over.selectedEmitterId ?? null,
    accentColor: ACCENT_CYAN_LIGHT,
  };
  const view = render(<AudioScenePainter {...props} />);
  return { ...view, props };
}

afterEach(cleanup);

describe('delete buttons own their press', () => {
  it('a press on the zone delete button does not deselect the zone (which would unmount the button before its click)', () => {
    const { container, props } = renderPainter({ selectedZoneId: 'z1' });
    const del = container.querySelector('[data-testid="zone-delete-z1"] rect') as SVGRectElement;
    expect(del).not.toBeNull();
    fireEvent.mouseDown(del, { clientX: 5, clientY: 5 });
    expect(props.onSelectZone).not.toHaveBeenCalledWith(null);
    fireEvent.mouseUp(del);
    fireEvent.click(del);
    expect(props.onUpdateZones).toHaveBeenCalledTimes(1);
    expect((props.onUpdateZones.mock.calls[0][0] as AudioZone[]).length).toBe(0);
  });

  it('a press on the emitter delete button does not deselect the emitter', () => {
    const { container, props } = renderPainter({ selectedEmitterId: 'e1' });
    const del = container.querySelector('[data-testid="emitter-delete-e1"] rect') as SVGRectElement;
    expect(del).not.toBeNull();
    fireEvent.mouseDown(del, { clientX: 5, clientY: 5 });
    expect(props.onSelectEmitter).not.toHaveBeenCalledWith(null);
  });
});
