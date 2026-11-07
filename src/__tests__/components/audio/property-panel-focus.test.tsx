import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * Every button in the audio property panels shows the shared keyboard focus
 * ring and is a non-submitting `type="button"`. The reverb chips already did;
 * this pins the rest of the panel to the same rule.
 */

const zone: AudioZone = {
  id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
  soundscapeDescription: 'drips', reverbPreset: 'cave', reverbDecayTime: 1.5,
  reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
  occlusionMode: 'medium', priority: 5, color: '',
};

const emitter: SoundEmitter = {
  id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
  attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
  spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
};

afterEach(cleanup);

function offenders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button'))
    .filter((b) => !/\bfocus-ring(-inset)?\b/.test(b.className) || b.getAttribute('type') !== 'button')
    .map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '?');
}

describe('audio property panels — focus ring + type=button on every button', () => {
  it('zone panel', () => {
    const { container } = render(
      <ZonePropertyPanel
        zone={zone}
        onCommit={vi.fn()}
        onGenerateCode={vi.fn()}
        onGenerateSoundscape={vi.fn()}
        accentColor={ACCENT_CYAN_LIGHT}
        isGenerating={false}
      />,
    );
    expect(container.querySelectorAll('button').length).toBeGreaterThan(10);
    expect(offenders(container)).toEqual([]);
  });

  it('emitter panel', () => {
    const { container } = render(
      <EmitterPropertyPanel emitter={emitter} onCommit={vi.fn()} accentColor={ACCENT_CYAN_LIGHT} />,
    );
    expect(container.querySelectorAll('button').length).toBeGreaterThan(5);
    expect(offenders(container)).toEqual([]);
  });
});
