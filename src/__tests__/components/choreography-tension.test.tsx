import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TensionPanel } from '@/components/modules/core-engine/sub_combat/choreography/TensionPanel';
import { FEEDBACK_CHANNEL_COLORS } from '@/components/modules/core-engine/sub_combat/choreography/types';
import { simulateEncounter, type PlacedEnemy, type WaveDef } from '@/lib/combat/choreography-sim';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import type { TensionCurve } from '@/lib/combat/tension-curve';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(cleanup);

const CURVE: TensionCurve = {
  samples: [
    { timeSec: 0, tension: 0.1, intensity: 0.1, threat: 0, hpFrac: 1 },
    { timeSec: 5, tension: 0.9, intensity: 0.8, threat: 0.7, hpFrac: 0.3 },
  ],
  beats: [
    { type: 'climax', timeSec: 5, label: 'Climax', detail: 'Peak tension 90%', tone: 'peak' },
    { type: 'near-death', timeSec: 5, label: 'Near-death', detail: 'Player dropped to 30% HP', tone: 'peak' },
  ],
  peakTension: 0.9,
  climaxTimeSec: 5,
  dynamicRange: 0.8,
  summary: 'Builds to a 90% climax at 5s with a near-death spike.',
};

describe('TensionPanel', () => {
  it('renders the dramatic-arc summary and beat list', () => {
    render(<TensionPanel tensionCurve={CURVE} />);
    expect(screen.getByText(/Builds to a 90% climax at 5s/i)).toBeTruthy();
    // The beats render as clickable cards (a "Climax" stat label also exists,
    // so query the beat cards by their button role to stay unambiguous).
    expect(screen.getByRole('button', { name: /Climax/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Near-death/i })).toBeTruthy();
    expect(screen.getByText(/Player dropped to 30% HP/i)).toBeTruthy();
  });

  it('seeks to a beat time when its card is clicked', () => {
    const onSeek = vi.fn();
    render(<TensionPanel tensionCurve={CURVE} onSeek={onSeek} />);
    fireEvent.click(screen.getByRole('button', { name: /Climax/i }));
    expect(onSeek).toHaveBeenCalledWith(5);
  });

  it('shows an empty state when there are no beats', () => {
    const flat: TensionCurve = { ...CURVE, beats: [], summary: 'No combat activity to pace.' };
    render(<TensionPanel tensionCurve={flat} />);
    expect(screen.getByText(/No notable beats/i)).toBeTruthy();
  });
});

describe('simulateEncounter tension wiring', () => {
  const enemies: PlacedEnemy[] = [
    { id: 'e1', archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
    { id: 'e2', archetypeId: 'brute', gridX: 3, gridY: 2, waveIndex: 0, level: 6 },
  ];
  const waves: WaveDef[] = [{ spawnTimeSec: 0, label: 'Initial' }];

  it('attaches a populated tension curve to the sim result', () => {
    const res = simulateEncounter(enemies, waves, { ...DEFAULT_TUNING }, 5, FEEDBACK_CHANNEL_COLORS);
    expect(res.tensionCurve.samples.length).toBeGreaterThan(0);
    expect(res.tensionCurve.climaxTimeSec).toBeGreaterThanOrEqual(0);
    expect(res.tensionCurve.climaxTimeSec).toBeLessThanOrEqual(res.totalDurationSec + 1);
    for (const s of res.tensionCurve.samples) {
      expect(s.tension).toBeGreaterThanOrEqual(0);
      expect(s.tension).toBeLessThanOrEqual(1);
    }
  });
});
