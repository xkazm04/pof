/**
 * scan-sweep night 2026-11-08 (core-engine-planning-shell, visual-craft):
 * GenreDnaTimeline printed each strand's end label at its latest y with no
 * collision avoidance, so strands ending 2 confidence points apart (4px) or
 * both at 0% drew their labels on top of each other.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { GameplayPattern, TelemetrySnapshot } from '@/types/telemetry';
import { GenreDnaTimeline, layoutEndLabels } from '@/components/modules/core-engine/GenreDnaTimeline';

afterEach(cleanup);

const MIN_GAP = 11;

function snap(id: string, at: string, conf: Partial<Record<GameplayPattern, number>>): TelemetrySnapshot {
  return {
    id, scannedAt: at, projectPath: 'p',
    detectedPatterns: Object.entries(conf).map(([pattern, confidence]) => ({
      pattern: pattern as GameplayPattern, confidence: confidence as number, evidence: [], detectedAt: at,
    })),
  } as unknown as TelemetrySnapshot;
}

function labelYs(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll('svg text'))
    .filter((t) => /^[A-Z][a-z]+( [A-Z][a-z]+)+$/.test(t.textContent ?? '') && t.getAttribute('x') !== null)
    .filter((t) => Number(t.getAttribute('x')) > 600)
    .map((t) => Number(t.getAttribute('y')))
    .sort((a, b) => a - b);
}
const minGap = (ys: number[]) => Math.min(...ys.slice(1).map((y, i) => y - ys[i]));

describe('GenreDnaTimeline end labels', () => {
  it('keeps labels of strands ending at 40% and 42% (and two at 0%) apart', () => {
    // history is newest-first
    const history = [
      snap('b', '2026-06-02T00:00:00Z', { 'loot-driven': 40, 'gas-combo-chains': 42, 'stealth-mechanics': 0, 'multiplayer-sync': 0 }),
      snap('a', '2026-06-01T00:00:00Z', { 'loot-driven': 30, 'gas-combo-chains': 35, 'stealth-mechanics': 5, 'multiplayer-sync': 5 }),
    ];
    const { container } = render(<GenreDnaTimeline history={history} />);
    const ys = labelYs(container);
    expect(ys).toHaveLength(4);
    expect(minGap(ys)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('holds the gap for every one of the 13 patterns at the same confidence', () => {
    const all = ['dodge-roll-heavy', 'gas-combo-chains', 'projectile-dominant', 'ai-squad-tactics', 'inventory-crafting',
      'loot-driven', 'exploration-heavy', 'dialogue-branching', 'permadeath-rogue', 'performance-intensive',
      'multiplayer-sync', 'stealth-mechanics', 'procedural-generation'] as GameplayPattern[];
    const flat = Object.fromEntries(all.map((p) => [p, 0]));
    const history = [snap('b', '2026-06-02T00:00:00Z', flat), snap('a', '2026-06-01T00:00:00Z', flat)];
    const { container } = render(<GenreDnaTimeline history={history} />);
    const ys = labelYs(container);
    expect(ys).toHaveLength(13);
    expect(minGap(ys)).toBeGreaterThanOrEqual(MIN_GAP);
  });
});

describe('layoutEndLabels', () => {
  it('keeps order, the min gap and the bounds for generated inputs', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let n = 1; n <= 13; n++) {
      for (let trial = 0; trial < 20; trial++) {
        const ys = Array.from({ length: n }, () => 18 + rnd() * 194);
        const out = layoutEndLabels(ys, MIN_GAP, 18, 212);
        const sorted = [...out].sort((a, b) => a - b);
        for (let i = 1; i < n; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(MIN_GAP - 1e-9);
        expect(sorted[0]).toBeGreaterThanOrEqual(18 - 1e-9);
        expect(sorted[n - 1]).toBeLessThanOrEqual(212 + 1e-9);
        // never reorders strands
        const idx = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b] || a - b);
        for (let i = 1; i < n; i++) expect(out[idx[i]]).toBeGreaterThanOrEqual(out[idx[i - 1]]);
      }
    }
  });

  it('leaves already-separated labels where they are', () => {
    expect(layoutEndLabels([20, 60, 120], MIN_GAP, 18, 212)).toEqual([20, 60, 120]);
  });
});
