import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AudioScenePainter } from '@/components/modules/content/audio/AudioScenePainter';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

function rectZone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
    soundscapeDescription: '', reverbPreset: 'cave', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '', linkedFiles: [],
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

function renderPainter() {
  const props = {
    zones: [rectZone(), rectZone({ id: 'z2', name: 'Hall', x: 400, y: 300 })],
    emitters: [emitter()],
    onUpdateZones: vi.fn(),
    onUpdateEmitters: vi.fn(),
    onSelectZone: vi.fn(),
    onSelectEmitter: vi.fn(),
    selectedZoneId: null,
    selectedEmitterId: null,
    accentColor: ACCENT_CYAN_LIGHT,
  };
  return { props, ...render(<AudioScenePainter {...props} />) };
}

afterEach(cleanup);

describe('AudioScenePainter — zoom cluster', () => {
  it('renders the zoom% | − | + | fit | 1:1 cluster at 100%', () => {
    renderPainter();
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fit to content' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset zoom to 100%' })).toBeTruthy();
  });

  it('zoom in raises the percentage and 1:1 resets it', () => {
    renderPainter();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('120%')).toBeTruthy(); // 100% × ZOOM_STEP (1.2)
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('zoom out lowers the percentage', () => {
    renderPainter();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('83%')).toBeTruthy(); // round(100 / 1.2)
  });

  it('fit-to-content keeps the cluster mounted and changes zoom', () => {
    renderPainter();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to content' }));
    // Still shows a percentage (no crash); the value is no longer the default 100%.
    expect(screen.queryByText('100%')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fit to content' })).toBeTruthy();
  });
});

describe('AudioScenePainter — keyboard shortcuts', () => {
  it('+ / 0 keys zoom and reset via the focusable canvas', () => {
    renderPainter();
    const app = screen.getByRole('application');
    fireEvent.keyDown(app, { key: '+' });
    expect(screen.getByText('120%')).toBeTruthy();
    fireEvent.keyDown(app, { key: '0' });
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

describe('AudioScenePainter — minimap', () => {
  function minimapSvg(container: HTMLElement): SVGSVGElement | null {
    return container.querySelector('svg[aria-label="Scene minimap — drag to navigate"]');
  }

  it('renders a minimap with a dot per emitter', () => {
    const { container } = renderPainter();
    const map = minimapSvg(container);
    expect(map).toBeTruthy();
    // 1 emitter → 1 dot. Rect zones contribute rects, not circles, so the only
    // circle in the minimap is the emitter.
    expect(map!.querySelectorAll('circle').length).toBe(1);
    // 2 zones + the viewport indicator → at least 3 rects.
    expect(map!.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3);
  });

  it('can be hidden and restored', () => {
    const { container } = renderPainter();
    expect(minimapSvg(container)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide minimap' }));
    expect(minimapSvg(container)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show minimap' }));
    expect(minimapSvg(container)).toBeTruthy();
  });
});
