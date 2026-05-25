import { describe, it, expect } from 'vitest';
import { computeVelocityForecast } from '@/lib/ecw/forecast';

describe('computeVelocityForecast', () => {
  it('returns null when not enough data to forecast', () => {
    expect(computeVelocityForecast({ verified: 0, total: 100, history: [] })).toBeNull();
  });

  it('forecasts days remaining at current velocity', () => {
    // 50 verified, 100 total → 50 remaining; velocity 5/day → 10 days.
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 30, at: Date.now() - 4 * 86_400_000 }],
    });
    expect(result).not.toBeNull();
    expect(result!.daysRemaining).toBe(10);
    expect(result!.velocityPerDay).toBe(5);
  });

  it('clamps confidence at 1.0 even when history is rich', () => {
    const result = computeVelocityForecast({
      verified: 90,
      total: 100,
      history: Array.from({ length: 20 }, (_, i) => ({
        verified: i * 5,
        at: Date.now() - (20 - i) * 86_400_000,
      })),
    });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThanOrEqual(1);
    expect(result!.confidence).toBeGreaterThan(0.5);
  });

  it('returns null when 100% complete already', () => {
    const result = computeVelocityForecast({
      verified: 100,
      total: 100,
      history: [{ verified: 50, at: Date.now() - 86_400_000 }],
    });
    expect(result).toBeNull();
  });

  it('returns null when velocity is zero (stalled)', () => {
    const result = computeVelocityForecast({
      verified: 50,
      total: 100,
      history: [{ verified: 50, at: Date.now() - 86_400_000 }],
    });
    expect(result).toBeNull();
  });
});
