import { describe, it, expect } from 'vitest';
import { percentileFromBuckets, type CountBucket } from '@/lib/combat/histogram';

describe('percentileFromBuckets', () => {
  it('returns null for an empty / zero-count distribution', () => {
    expect(percentileFromBuckets([], 0.5)).toBeNull();
    expect(percentileFromBuckets([{ min: 0, max: 10, count: 0 }], 0.5)).toBeNull();
  });

  it('interpolates within a single bucket', () => {
    const buckets: CountBucket[] = [{ min: 0, max: 100, count: 10 }];
    expect(percentileFromBuckets(buckets, 0.5)).toBeCloseTo(50, 5);
    expect(percentileFromBuckets(buckets, 0.95)).toBeCloseTo(95, 5);
  });

  it('lands in the correct bucket across a multi-bucket spread', () => {
    // 100 observations, 25 per bucket across [0,40].
    const buckets: CountBucket[] = [
      { min: 0, max: 10, count: 25 },
      { min: 10, max: 20, count: 25 },
      { min: 20, max: 30, count: 25 },
      { min: 30, max: 40, count: 25 },
    ];
    // p50 → rank 50 → end of bucket 2 boundary (20).
    expect(percentileFromBuckets(buckets, 0.5)).toBeCloseTo(20, 5);
    // p95 → rank 95 → 95% into the run, deep in the last bucket.
    const p95 = percentileFromBuckets(buckets, 0.95)!;
    expect(p95).toBeGreaterThan(30);
    expect(p95).toBeLessThanOrEqual(40);
  });

  it('skips empty buckets when accumulating', () => {
    const buckets: CountBucket[] = [
      { min: 0, max: 10, count: 0 },
      { min: 10, max: 20, count: 4 },
      { min: 20, max: 30, count: 0 },
      { min: 30, max: 40, count: 4 },
    ];
    // p50 → rank 4 → still within the first non-empty bucket [10,20].
    const p50 = percentileFromBuckets(buckets, 0.5)!;
    expect(p50).toBeGreaterThanOrEqual(10);
    expect(p50).toBeLessThanOrEqual(20);
  });

  it('clamps out-of-range percentiles', () => {
    const buckets: CountBucket[] = [{ min: 0, max: 100, count: 10 }];
    expect(percentileFromBuckets(buckets, -1)).toBeCloseTo(0, 5);
    expect(percentileFromBuckets(buckets, 2)).toBeCloseTo(100, 5);
  });
});
