import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  ReverbDecayGlyph,
  reverbDecaySignature,
  reverbDecayGeometry,
} from '@/components/modules/content/audio/ReverbDecayGlyph';
import type { ReverbPreset } from '@/types/audio-scene';

const ALL_PRESETS: ReverbPreset[] = [
  'none', 'small-room', 'large-hall', 'cave', 'outdoor',
  'underwater', 'metal-corridor', 'stone-chamber', 'forest', 'custom',
];

afterEach(() => cleanup());

describe('reverbDecaySignature', () => {
  it('gives "none" the shortest tail and "cave"/"large-hall" the longest', () => {
    const none = reverbDecaySignature('none').decay;
    const small = reverbDecaySignature('small-room').decay;
    const hall = reverbDecaySignature('large-hall').decay;
    const cave = reverbDecaySignature('cave').decay;

    expect(none).toBeLessThan(small);
    expect(small).toBeLessThan(hall);
    expect(hall).toBeLessThanOrEqual(cave);
    expect(cave).toBeGreaterThan(0.85);
  });

  it('maps the custom preset onto the zone decay time (seconds)', () => {
    expect(reverbDecaySignature('custom', 8).decay).toBeCloseTo(1, 5);
    expect(reverbDecaySignature('custom', 0).decay).toBeCloseTo(0.05, 5);
    expect(reverbDecaySignature('custom', 4).decay).toBeCloseTo(0.5, 5);
  });

  it('exposes ripple for underwater/metal and jitter for forest', () => {
    expect(reverbDecaySignature('underwater').rippleAmp).toBeGreaterThan(0);
    expect(reverbDecaySignature('metal-corridor').rippleFreq).toBeGreaterThan(
      reverbDecaySignature('underwater').rippleFreq ?? 0,
    );
    expect(reverbDecaySignature('forest').jitter).toBeGreaterThan(0);
  });
});

describe('reverbDecayGeometry', () => {
  it('produces a stroked line (M…) and a closed filled area (…Z)', () => {
    const { line, area } = reverbDecayGeometry(reverbDecaySignature('cave'));
    expect(line.startsWith('M ')).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
    expect(area.startsWith(line)).toBe(true);
  });

  it('renders a distinct signature path for every preset', () => {
    const lines = ALL_PRESETS.map((p) => reverbDecayGeometry(reverbDecaySignature(p)).line);
    expect(new Set(lines).size).toBe(ALL_PRESETS.length);
  });

  it('is deterministic across calls (diffuse jitter is stable)', () => {
    const a = reverbDecayGeometry(reverbDecaySignature('forest')).line;
    const b = reverbDecayGeometry(reverbDecaySignature('forest')).line;
    expect(a).toBe(b);
  });
});

describe('<ReverbDecayGlyph />', () => {
  it('renders a 28×14 svg whose envelope is drawn in the supplied color', () => {
    const { container } = render(<ReverbDecayGlyph preset="cave" color="#abcdef" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('28');
    expect(svg?.getAttribute('height')).toBe('14');

    const envelope = container.querySelector('path.reverb-glyph-path');
    expect(envelope).toBeTruthy();
    expect(envelope?.getAttribute('stroke')).toBe('#abcdef');
    expect(envelope?.getAttribute('pathLength')).toBe('100');
  });

  it('sets a longer draw duration for longer tails', () => {
    const longTail = render(<ReverbDecayGlyph preset="cave" color="#fff" />);
    const longDur = longTail.container.querySelector('svg')?.style.getPropertyValue('--reverb-dur');
    cleanup();
    const shortTail = render(<ReverbDecayGlyph preset="small-room" color="#fff" />);
    const shortDur = shortTail.container.querySelector('svg')?.style.getPropertyValue('--reverb-dur');

    expect(parseFloat(longDur ?? '0')).toBeGreaterThan(parseFloat(shortDur ?? '0'));
  });
});
