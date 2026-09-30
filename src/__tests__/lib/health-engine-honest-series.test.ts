/**
 * Health forecasts come from a dated completion ledger, never from a seeded RNG.
 *
 * Before this change `computeProjectHealth` spread `completedChecklistItems`
 * over eight invented weeks with `mulberry32` variance and a floor of one item
 * per week, then projected every milestone date from that invented velocity.
 * With no scans it also invented six "Scan N" quality points and a trend. A
 * project with zero completed items was told "1 item/week" and "Release
 * Candidate in 216 weeks".
 *
 * The contract pinned here: every time series is derived from recorded data —
 * dated completions (`CompletionLedger`) or recorded scans — and a forecast is
 * `null`, with its sample disclosed, when no sample supports it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { computeProjectHealth } from '@/lib/health-engine';
import { SLICE_UNMEASURED_NOTE } from '@/lib/roadmap/milestone-progress';
import { ALL_CHECKLIST_TOTAL, ALL_MODULE_DEFS } from '@/lib/module-registry';
import type { CompletionLedger } from '@/lib/roadmap/completion-ledger';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

const round1 = (n: number) => Math.round(n * 10) / 10;

afterEach(() => {
  vi.useRealTimers();
});

describe('health-engine — no sample, no forecast', () => {
  it('case 1: an empty project reports null velocity, empty series and no predicted milestone', () => {
    const h = computeProjectHealth({}, [], null, null, null, {}, NOW);
    expect(h.avgVelocity).toBeNull();
    expect(h.velocityHistory).toEqual([]);
    expect(h.burnChart).toEqual([]);
    expect(h.velocitySample).toEqual({ datedCompletions: 0, undated: 0, weeks: 0 });
    expect(h.milestones).toHaveLength(4);
    for (const ms of h.milestones) {
      expect(ms.predictedWeeks).toBeNull();
      expect(ms.predictedDate).toBeNull();
    }
  });

  it('case 2: no recorded scans means no quality series and an unknown trend', () => {
    const progress = { 'arpg-combat': { a: true, b: true } };
    const h = computeProjectHealth(progress, [], null, null, null, {}, NOW);
    expect(h.qualityHistory).toEqual([]);
    expect(h.qualityTrend).toBe('unknown');
  });
});

describe('health-engine — velocity is bucketed from dated completions', () => {
  it('case 3: six dated completions bucket into weeks and drive the forecast', () => {
    const progress = { 'arpg-combat': { a: true, b: true, c: true, d: true, e: true, f: true } };
    const ledger: CompletionLedger = {
      'arpg-combat': {
        a: NOW - WEEK, b: NOW - WEEK, c: NOW - WEEK,
        d: NOW - 2 * WEEK, e: NOW - 2 * WEEK,
        f: NOW - 3 * WEEK,
      },
    };
    const h = computeProjectHealth(progress, [], null, null, null, ledger, NOW);

    expect(h.velocityHistory.slice(-3).map((v) => v.itemsCompleted)).toEqual([1, 2, 3]);
    expect(h.avgVelocity).toBe(2);
    expect(h.velocitySample.datedCompletions).toBe(6);
    expect(h.velocitySample.undated).toBe(0);

    const release = h.milestones.find((m) => m.id === 'release')!;
    expect(release.predictedWeeks).toBe(round1((ALL_CHECKLIST_TOTAL - 6) / 2));
    expect(release.predictedDate).not.toBeNull();
    // The predicted date is anchored on the injected NOW, not the wall clock.
    expect(Date.parse(release.predictedDate!)).toBeGreaterThan(NOW);
  });

  it('case 4: weekly bars and the burn-up never exceed the completed item count', () => {
    // Deterministic LCG so the "any input" sweep is reproducible.
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const modules = [...ALL_MODULE_DEFS.slice(0, 4).map((m) => m.id), 'not-a-module'];

    for (let trial = 0; trial < 60; trial++) {
      const progress: Record<string, Record<string, boolean>> = {};
      const ledger: CompletionLedger = {};
      for (const mod of modules) {
        progress[mod] = {};
        ledger[mod] = {};
        for (let i = 0; i < 8; i++) {
          const id = `i${i}`;
          const r = next();
          progress[mod][id] = r < 0.5;
          // Stamps on checked AND unchecked items, far past, recent and future.
          if (next() < 0.7) ledger[mod][id] = NOW + Math.round((next() - 0.8) * 40 * WEEK);
        }
      }
      // A stamp for an item that is not in the checklist at all.
      ledger['arpg-combat'] = { ...(ledger['arpg-combat'] ?? {}), ghost: NOW - DAY };

      const h = computeProjectHealth(progress, [], null, null, null, ledger, NOW);
      const bars = h.velocityHistory.reduce((s, v) => s + v.itemsCompleted, 0);
      expect(bars).toBeLessThanOrEqual(h.completedChecklistItems);
      if (h.burnChart.length > 0) {
        expect(h.burnChart[h.burnChart.length - 1].completed).toBeLessThanOrEqual(h.completedChecklistItems);
      }
      expect(h.velocitySample.datedCompletions + h.velocitySample.undated).toBe(h.completedChecklistItems);
    }
  });

  it('case 5: undated completions are counted and disclosed, never bucketed', () => {
    const progress = { 'arpg-combat': { a: true, b: true, c: true } };
    const ledger: CompletionLedger = { 'arpg-combat': { a: NOW - 2 * DAY } };
    const h = computeProjectHealth(progress, [], null, null, null, ledger, NOW);

    expect(h.completedChecklistItems).toBe(3);
    expect(h.velocitySample.datedCompletions).toBe(1);
    expect(h.velocitySample.undated).toBe(2);
    expect(h.velocityHistory.reduce((s, v) => s + v.itemsCompleted, 0)).toBe(1);
    expect(h.burnChart[h.burnChart.length - 1].completed).toBe(1);
  });
});

describe('health-engine — determinism [guard]', () => {
  it('case 8: same inputs + same NOW give deep-equal results regardless of the wall clock', () => {
    const progress = { 'arpg-combat': { a: true, b: true } };
    const ledger: CompletionLedger = { 'arpg-combat': { a: NOW - 3 * DAY } };

    vi.useFakeTimers();
    vi.setSystemTime(NOW + 13 * DAY);
    const first = computeProjectHealth(progress, [], null, null, null, ledger, NOW);
    vi.setSystemTime(NOW + 101 * DAY);
    const second = computeProjectHealth(progress, [], null, null, null, ledger, NOW);

    expect(second).toEqual(first);
    const slice = first.milestones.find((m) => m.id === 'vertical-slice')!;
    expect(slice.currentProgress).toBeNull();
    expect(slice.progressNote).toBe(SLICE_UNMEASURED_NOTE);
  });
});
