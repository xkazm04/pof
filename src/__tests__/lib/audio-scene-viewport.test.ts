import { describe, it, expect } from 'vitest';
import {
  clampZoom,
  contentBounds,
  fitView,
  zoomAtPoint,
  zoomByFactor,
  screenToContent,
  panToCenter,
  viewportRectInContent,
  unionBounds,
  minimapProjection,
  minimapToContent,
  IDENTITY_VIEW,
  MIN_ZOOM,
  MAX_ZOOM,
  type Viewport,
} from '@/lib/audio-scene-viewport';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

function rectZone(over: Partial<AudioZone> = {}): AudioZone {
  return {
    id: 'z', name: 'Z', shape: 'rect', x: 100, y: 100, width: 50, height: 40,
    soundscapeDescription: '', reverbPreset: 'none', reverbDecayTime: 1.5,
    reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
    occlusionMode: 'medium', priority: 5, color: '', linkedFiles: [],
    ...over,
  };
}

function circleZone(over: Partial<AudioZone> = {}): AudioZone {
  return rectZone({ shape: 'circle', x: 200, y: 200, width: 80, height: 80, ...over });
}

function emitter(over: Partial<SoundEmitter> = {}): SoundEmitter {
  return {
    id: 'e', name: 'E', type: 'ambient', x: 300, y: 300, soundCueRef: '',
    attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
    spawnChance: 1, cooldownSeconds: 0, zoneId: null,
    ...over,
  };
}

describe('clampZoom', () => {
  it('clamps below the floor and above the ceiling', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('falls back to 1 for non-finite input', () => {
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(1);
    expect(clampZoom(-Infinity)).toBe(1);
  });
});

describe('contentBounds', () => {
  it('returns null for an empty scene', () => {
    expect(contentBounds([], [])).toBeNull();
  });

  it('bounds a rect zone by its extent', () => {
    expect(contentBounds([rectZone()], [])).toEqual({ minX: 100, minY: 100, maxX: 150, maxY: 140 });
  });

  it('bounds a circle zone by its radius', () => {
    expect(contentBounds([circleZone()], [])).toEqual({ minX: 160, minY: 160, maxX: 240, maxY: 240 });
  });

  it('includes emitters with a glyph margin', () => {
    expect(contentBounds([], [emitter()])).toEqual({ minX: 290, minY: 290, maxX: 310, maxY: 310 });
  });

  it('unions zones and emitters', () => {
    const b = contentBounds([rectZone()], [emitter()])!;
    expect(b).toEqual({ minX: 100, minY: 100, maxX: 310, maxY: 310 });
  });
});

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor anchored', () => {
    const view: Viewport = { zoom: 1, panX: 0, panY: 0 };
    const sx = 400, sy = 250;
    const before = screenToContent(view, sx, sy);
    const after = zoomAtPoint(view, 2, sx, sy);
    const afterContent = screenToContent(after, sx, sy);
    expect(afterContent.x).toBeCloseTo(before.x, 6);
    expect(afterContent.y).toBeCloseTo(before.y, 6);
    expect(after.zoom).toBe(2);
  });

  it('respects the zoom clamp', () => {
    const view: Viewport = { zoom: 1, panX: 10, panY: 10 };
    expect(zoomAtPoint(view, 100, 0, 0).zoom).toBe(MAX_ZOOM);
    expect(zoomAtPoint(view, 0, 0, 0).zoom).toBe(MIN_ZOOM);
  });
});

describe('zoomByFactor', () => {
  it('multiplies the current zoom about the anchor', () => {
    const view: Viewport = { zoom: 1.5, panX: 0, panY: 0 };
    expect(zoomByFactor(view, 2, 0, 0).zoom).toBe(3);
  });
});

describe('panToCenter', () => {
  it('places a content point at the viewport centre', () => {
    const { panX, panY } = panToCenter(2, 800, 600, 100, 50);
    // content point should map to screen centre: pan + zoom*c == viewport/2
    expect(panX + 2 * 100).toBe(400);
    expect(panY + 2 * 50).toBe(300);
  });
});

describe('fitView', () => {
  it('returns identity when there is nothing to fit', () => {
    expect(fitView(null, 800, 600)).toEqual(IDENTITY_VIEW);
    expect(fitView({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 0, 600)).toEqual(IDENTITY_VIEW);
  });

  it('centres and fits the bounds within the padded canvas', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const vp = fitView(bounds, 800, 600, 50);
    // the bounds centre (50,50) should land at the viewport centre (400,300)
    expect(vp.panX + vp.zoom * 50).toBeCloseTo(400, 6);
    expect(vp.panY + vp.zoom * 50).toBeCloseTo(300, 6);
    // and it should fit inside the padded area
    expect(vp.zoom * 100).toBeLessThanOrEqual(600 - 2 * 50 + 1e-6);
  });

  it('never exceeds the zoom ceiling for a tiny scene', () => {
    const bounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    expect(fitView(bounds, 800, 600).zoom).toBe(MAX_ZOOM);
  });
});

describe('viewportRectInContent', () => {
  it('describes the visible region in content space', () => {
    const view: Viewport = { zoom: 2, panX: -100, panY: -50 };
    const rect = viewportRectInContent(view, 800, 600);
    expect(rect.minX).toBe(50);   // (0 - -100)/2
    expect(rect.minY).toBe(25);   // (0 - -50)/2
    expect(rect.maxX).toBe(450);  // 50 + 800/2
    expect(rect.maxY).toBe(325);  // 25 + 600/2
  });
});

describe('unionBounds', () => {
  it('passes through a null side', () => {
    const b = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    expect(unionBounds(null, b)).toBe(b);
    expect(unionBounds(b, null)).toBe(b);
  });

  it('expands to contain both', () => {
    expect(unionBounds(
      { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      { minX: -5, minY: 2, maxX: 8, maxY: 20 },
    )).toEqual({ minX: -5, minY: 0, maxX: 10, maxY: 20 });
  });
});

describe('minimapProjection', () => {
  it('round-trips content↔minimap coordinates', () => {
    const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const proj = minimapProjection(bounds, 120, 90, 6);
    const back = minimapToContent(proj, proj.offsetX + 200 * proj.scale, proj.offsetY + 100 * proj.scale);
    expect(back.x).toBeCloseTo(200, 6);
    expect(back.y).toBeCloseTo(100, 6);
  });

  it('keeps the projection inside the padded minimap', () => {
    const bounds = { minX: -50, minY: -50, maxX: 50, maxY: 50 };
    const proj = minimapProjection(bounds, 120, 90, 6);
    const min = { x: proj.offsetX + bounds.minX * proj.scale, y: proj.offsetY + bounds.minY * proj.scale };
    const max = { x: proj.offsetX + bounds.maxX * proj.scale, y: proj.offsetY + bounds.maxY * proj.scale };
    expect(min.x).toBeGreaterThanOrEqual(6 - 1e-6);
    expect(min.y).toBeGreaterThanOrEqual(6 - 1e-6);
    expect(max.x).toBeLessThanOrEqual(120 - 6 + 1e-6);
    expect(max.y).toBeLessThanOrEqual(90 - 6 + 1e-6);
  });
});
