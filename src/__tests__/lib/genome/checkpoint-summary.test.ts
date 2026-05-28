import { describe, it, expect } from 'vitest';
import {
  summarizeCheckpoint, summarizeSnapshotSeries,
} from '@/lib/genome/checkpoint-summary';
import type { DiffFieldSpec } from '@/lib/genome/genome-diff';

interface Toy {
  walkSpeed: number;
  critChance: number;
  cooldown: number;
}

const specs: DiffFieldSpec<Toy>[] = [
  { group: 'Movement', label: 'Walk Speed', get: (g) => g.walkSpeed, unit: 'cm/s' },
  { group: 'Combat', label: 'Crit Chance', get: (g) => g.critChance, percent: true },
  { group: 'Combat', label: 'Cooldown', get: (g) => g.cooldown, unit: 's' },
];

const base: Toy = { walkSpeed: 400, critChance: 0.05, cooldown: 0.8 };

describe('summarizeCheckpoint', () => {
  it('returns the initial-checkpoint marker when no previous snapshot exists', () => {
    const s = summarizeCheckpoint(base, undefined, specs);
    expect(s.isInitial).toBe(true);
    expect(s.headline).toBe('Initial checkpoint');
    expect(s.deltas).toHaveLength(0);
  });

  it('formats a numeric delta into a percent-suffixed headline', () => {
    const s = summarizeCheckpoint({ ...base, critChance: 0.12 }, base, specs);
    expect(s.isInitial).toBe(false);
    expect(s.headline).toBe('Crit Chance +7%');
    expect(s.deltas).toHaveLength(1);
  });

  it('joins up to three deltas and counts overflow', () => {
    const s = summarizeCheckpoint(
      { walkSpeed: 600, critChance: 0.12, cooldown: 0.4 },
      base,
      specs,
    );
    expect(s.headline).toBe('Walk Speed +200 cm/s, Crit Chance +7%, Cooldown -0.4 s');
    expect(s.deltas).toHaveLength(3);
  });

  it('appends "+N more" past the 3-headline budget', () => {
    const fourSpecs: DiffFieldSpec<Toy & { stam: number }>[] = [
      ...(specs as DiffFieldSpec<Toy & { stam: number }>[]),
      { group: 'Misc', label: 'Stamina', get: (g) => g.stam, unit: '' },
    ];
    const s = summarizeCheckpoint(
      { walkSpeed: 600, critChance: 0.12, cooldown: 0.4, stam: 99 },
      { ...base, stam: 50 },
      fourSpecs,
    );
    expect(s.headline.endsWith('+1 more')).toBe(true);
    expect(s.deltas).toHaveLength(4);
  });

  it('reports "No stat changes" for an identical snapshot', () => {
    const s = summarizeCheckpoint({ ...base }, base, specs);
    expect(s.headline).toBe('No stat changes');
    expect(s.deltas).toHaveLength(0);
    expect(s.isInitial).toBe(false);
  });
});

describe('summarizeSnapshotSeries', () => {
  it('first entry is initial, every later entry diffs against its predecessor', () => {
    const series = [
      base,
      { ...base, critChance: 0.12 },
      { ...base, critChance: 0.12, walkSpeed: 600 },
    ];
    const summaries = summarizeSnapshotSeries(series, specs);
    expect(summaries[0].isInitial).toBe(true);
    expect(summaries[1].headline).toBe('Crit Chance +7%');
    // Third diffs against second, not against base, so only Walk Speed moved.
    expect(summaries[2].headline).toBe('Walk Speed +200 cm/s');
  });
});
