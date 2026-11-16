import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ZonePropertyPanel, EmitterPropertyPanel } from '@/components/modules/content/audio/AudioPropertyPanel';
import { ACCENT_CYAN_LIGHT } from '@/lib/chart-colors';
import type { AudioZone, SoundEmitter } from '@/types/audio-scene';

/**
 * Every visible label in the property panels is bound to what it names: a
 * single-control Field/SliderField label points at its control (click focuses it),
 * and a chip-group label names its group instead of being an orphan <label>.
 */

const zone: AudioZone = {
  id: 'z1', name: 'Cavern', shape: 'rect', x: 100, y: 100, width: 120, height: 80,
  soundscapeDescription: 'drips', reverbPreset: 'custom', reverbDecayTime: 1.5,
  reverbDiffusion: 0.7, reverbWetDry: 0.5, attenuationRadius: 200,
  occlusionMode: 'medium', priority: 5, color: '',
};
const emitter: SoundEmitter = {
  id: 'e1', name: 'Drip', type: 'ambient', x: 140, y: 130, soundCueRef: '',
  attenuationRadius: 60, volumeMultiplier: 1, pitchMin: 0.9, pitchMax: 1.1,
  spawnChance: 1, cooldownSeconds: 0, zoneId: 'z1',
};

afterEach(cleanup);

function panels() {
  const z = render(
    <ZonePropertyPanel zone={zone} onCommit={vi.fn()} onGenerateCode={vi.fn()}
      onGenerateSoundscape={vi.fn()} accentColor={ACCENT_CYAN_LIGHT} isGenerating={false} />,
  );
  const e = render(<EmitterPropertyPanel emitter={emitter} onCommit={vi.fn()} accentColor={ACCENT_CYAN_LIGHT} />);
  return [z.container, e.container];
}

describe('audio property panels - labels bound to controls', () => {
  it('no <label> is left without a control that resolves', () => {
    const orphans = panels().flatMap((c) => Array.from(c.querySelectorAll('label'))
      .filter((l) => !l.control).map((l) => l.textContent));
    expect(orphans).toEqual([]);
  });

  it('every single-control field and all 11 sliders have an associated <label> (15 of 15)', () => {
    const controls = panels().flatMap((c) => Array.from(c.querySelectorAll<HTMLInputElement>('input, textarea'))
      // the Library Asset Set picker's search box only exists while browsing
      .filter((i) => i.type !== 'hidden'));
    expect(controls).toHaveLength(15);
    expect(controls.filter((i) => (i.labels?.length ?? 0) > 0)).toHaveLength(15);
  });

  it('clicking the Name label focuses the name input', () => {
    const [zoneC] = panels();
    const label = Array.from(zoneC.querySelectorAll('label')).find((l) => l.textContent === 'Name')!;
    expect((label.control as HTMLElement).getAttribute('aria-label')).toBe('Zone name');
  });

  it('chip-group and picker labels name a group that resolves', () => {
    const groups = panels().flatMap((c) => Array.from(c.querySelectorAll('[role="group"][aria-labelledby]')));
    const names = groups.map((g) => document.getElementById(g.getAttribute('aria-labelledby')!)?.textContent);
    expect(names.sort()).toEqual(['Library Asset Set', 'Occlusion', 'Reverb Preset', 'Type']);
  });
});
