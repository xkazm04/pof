import { describe, it, expect } from 'vitest';
import { computeVelocityForecast } from '@/lib/ecw/forecast';

// A FIXED clock, not `Date.now()`. The old test built its history timestamps
// from its own wall-clock read while the function took a second one, so elapsed
// was `4 days + ε` and `ceil(50 / 4.9999…)` came back 11 instead of 10 whenever
// the two reads straddled a millisecond — a coin flip on scheduler timing, not a
// flaky assertion.
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const DAY = 86_400_000;

describe('computeVelocityForecast', () => {
  it('returns null when not enough data to forecast', () => {
    expect(computeVelocityForecast({ verified: 0, total: 100, history: [] }, NOW)).toBeNull();
  });

  it('forecasts days remaining at current velocity', () => {
    // 50 verified, 100 total → 50 remaining; velocity 5/day → 10 days.
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 30, at: NOW - 4 * DAY }],
    }, NOW);
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(10);
    expect(result!.velocityPerDay).toBe(5);
  });

  it('is deterministic across repeated evaluation with the same clock', () => {
    const input = {
      verified: 50,
      total: 100,
      history: [{ verified: 30, at: NOW - 4 * DAY }],
    };
    const runs = Array.from({ length: 20 }, () => computeVelocityForecast(input, NOW));
    expect(new Set(runs.map(r => JSON.stringify(r))).size).toBe(1);
    expect(runs[0]!.daysRemaining).toBe(10);
  });

  it('defaults `now` to the current clock when the caller omits it', () => {
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 30, at: Date.now() - 4 * DAY }],
    });
    expect(result).not.toBeNull();
    // Deliberately loose: this asserts the default is wired, NOT an exact
    // figure — an exact one here is precisely the flake that was removed.
    expect(result!.daysRemaining).toBeGreaterThan(0);
  });

  it('clamps confidence at 1.0 even when history is rich', () => {
    const result = computeVelocityForecast({
      verified: 90,
      total: 100,
      history: Array.from({ length: 20 }, (_, i) => ({
        verified: i * 5,
        at: NOW - (20 - i) * DAY,
      })),
    }, NOW);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.confidence).toBeGreaterThan(0.5);
  });

  it('returns null when 100% complete already', () => {
    const result = computeVelocityForecast({
      verified: 100,
      total: 100,
      history: [{ verified: 50, at: NOW - DAY }],
    }, NOW);
    expect(result).toBeNull();
  });

  it('returns null when velocity is zero (stalled)', () => {
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 50, at: NOW - DAY }],
    }, NOW);
    expect(result).toBeNull();
  });

  it('returns null when the history point is not in the past', () => {
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 30, at: NOW }],
    }, NOW);
    expect(result).toBeNull();
  });
});
