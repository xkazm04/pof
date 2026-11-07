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

describe('decorative attenuation shapes take no pointer events', () => {
  it('zone attenuation glows (rect and circle) are pointer-transparent, like the emitter attenuation circle', () => {
    const { container } = renderPainter({
      zones: [zone(), zone({ id: 'z2', shape: 'circle', x: 400, y: 300, width: 100, height: 100 })],
    });
    const glows = Array.from(container.querySelectorAll('[fill="url(#radar-glow)"]')) as SVGElement[];
    // 2 zone glows + 1 emitter attenuation circle
    expect(glows.length).toBe(3);
    const catching = glows.filter((g) => g.style.pointerEvents !== 'none');
    expect(catching.length).toBe(0);
  });
});

describe('placing and drawing over an existing zone works for both shapes', () => {
  const twoShapes = () => [zone(), zone({ id: 'z2', shape: 'circle', x: 400, y: 300, width: 100, height: 100 })];

  function pickTool(container: HTMLElement, label: string) {
    const btn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)!;
    fireEvent.click(btn);
  }

  it.each([
    ['rect', 'z1', 150, 140],
    ['circle', 'z2', 400, 300],
  ])('EMITTER tool: a press on a %s zone body places an emitter inside it', (_shape, zoneId, x, y) => {
    const { container, props } = renderPainter({ zones: twoShapes(), emitters: [] });
    pickTool(container, 'EMITTER');
    fireEvent.mouseDown(container.querySelector(`[data-zone-id="${zoneId}"]`)!, { clientX: x, clientY: y });
    expect(props.onUpdateEmitters).toHaveBeenCalledTimes(1);
    const placed = props.onUpdateEmitters.mock.calls[0][0] as SoundEmitter[];
    expect(placed).toHaveLength(1);
    expect(placed[0].zoneId).toBe(zoneId);
  });

  it.each([
    ['rect', 'z1', 150, 140],
    ['circle', 'z2', 400, 300],
  ])('VOL_RECT tool: a drag starting on a %s zone body draws a new zone', (_shape, zoneId, x, y) => {
    const { container, props } = renderPainter({ zones: twoShapes(), emitters: [] });
    pickTool(container, 'VOL_RECT');
    const svg = container.querySelector('[data-zone-id="z1"]')!.closest('svg')!;
    fireEvent.mouseDown(container.querySelector(`[data-zone-id="${zoneId}"]`)!, { clientX: x, clientY: y });
    fireEvent.mouseMove(svg, { clientX: x + 60, clientY: y + 60 });
    fireEvent.mouseUp(svg);
    expect(props.onUpdateZones).toHaveBeenCalledTimes(1);
    expect((props.onUpdateZones.mock.calls[0][0] as AudioZone[]).length).toBe(3);
  });
});

describe('click vs drag: a movement threshold in screen pixels', () => {
  function press(container: HTMLElement, selector: string, moves: Array<[number, number]>) {
    const el = container.querySelector(selector)!;
    const svg = el.closest('svg')!;
    fireEvent.mouseDown(el, { clientX: 140, clientY: 130 });
    for (const [x, y] of moves) fireEvent.mouseMove(svg, { clientX: x, clientY: y });
    fireEvent.mouseUp(svg);
  }

  it('a selection click with 1-2px of hand jitter on a zone writes nothing', () => {
    const { container, props } = renderPainter({ emitters: [] });
    press(container, '[data-zone-id="z1"]', [[141, 130], [142, 131]]);
    expect(props.onUpdateZones).not.toHaveBeenCalled();
    expect(props.onSelectZone).toHaveBeenCalledWith('z1');
  });

  it('a selection click with jitter on an emitter writes nothing', () => {
    const { container, props } = renderPainter();
    const body = Array.from(container.querySelectorAll('circle')).find((c) => c.getAttribute('r') === '10')!;
    body.setAttribute('data-test-emitter', 'e1');
    press(container, '[data-test-emitter="e1"]', [[141, 131]]);
    expect(props.onUpdateEmitters).not.toHaveBeenCalled();
  });

  it('a real drag past the threshold still commits exactly once, from the press origin', () => {
    const { container, props } = renderPainter({ emitters: [] });
    press(container, '[data-zone-id="z1"]', [[141, 130], [150, 140], [160, 150]]);
    expect(props.onUpdateZones).toHaveBeenCalledTimes(1);
    const moved = (props.onUpdateZones.mock.calls[0][0] as AudioZone[])[0];
    expect(moved.x).toBe(120);
    expect(moved.y).toBe(120);
  });
});
