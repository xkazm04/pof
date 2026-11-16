import { describe, it, expect } from 'vitest';
import {
  computeReadability, createReadabilityRun, foldReadability, textBoxesOverlap,
} from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/simulation';
import { DEFAULT_PHYSICS } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/constants';
import type { DmgParticle, ReadabilityMetrics } from '@/components/modules/content/ui-hud/DamageNumberPhysicsSimulator/types';

function particle(over: Partial<DmgParticle>): DmgParticle {
  return {
    id: 0, amount: 100, isCrit: false, isHeal: false, element: 'physical', x: 0, y: 0, vx: 0, vy: 0,
    startX: 0, startY: 0, elapsed: 0, opacity: 1, scale: 1, fontSize: 18, displayText: '100',
    color: 'white', stackCount: 1, trail: [], mobIndex: 0, ...over,
  };
}

function frame(simultaneous: number, overlaps = 0): ReadabilityMetrics {
  return { avgOverlaps: overlaps, maxSimultaneous: simultaneous, avgReadTime: 1, clutterScore: 0 };
}

describe('readability run summary', () => {
  it('reports the run peak and windowed mean for a 4,7,5 sequence', () => {
    let run = createReadabilityRun();
    let metrics = frame(0);
    for (const n of [4, 7, 5]) {
      const folded = foldReadability(run, frame(n, n));
      run = folded.run;
      metrics = folded.metrics;
    }
    expect(metrics.maxSimultaneous).toBe(7);
    expect(metrics.avgSimultaneous).toBe(5.3);
    expect(metrics.avgOverlaps).toBe(5.3);
  });
});

describe('overlap test uses the text box', () => {
  it('two 26px crit numbers 40px apart overlap; two 12px ones do not', () => {
    const big = (x: number) => particle({ x, fontSize: 26, displayText: 'CRIT! 1234' });
    expect(textBoxesOverlap(big(0), big(40))).toBe(true);
    const small = (x: number) => particle({ x, fontSize: 12, displayText: '1' });
    expect(textBoxesOverlap(small(0), small(40))).toBe(false);
  });

  it('computeReadability counts the wide pair as an overlap', () => {
    const a = particle({ id: 1, x: 0, fontSize: 26, displayText: 'CRIT! 1234' });
    const b = particle({ id: 2, x: 40, fontSize: 26, displayText: 'CRIT! 1234' });
    expect(computeReadability([a, b], DEFAULT_PHYSICS).avgOverlaps).toBe(1);
  });
});
