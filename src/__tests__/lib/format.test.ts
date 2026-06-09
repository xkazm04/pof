import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, formatDurationBetween } from '@/lib/format';

describe('formatBytes (packaging style)', () => {
  it('formats raw bytes with a space and no decimals below 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes to one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes to one decimal', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(Math.round(1024 * 1024 * 1.5))).toBe('1.5 MB');
  });

  it('formats gigabytes to two decimals', () => {
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
    expect(formatBytes(1024 ** 3 * 2.5)).toBe('2.50 GB');
  });

  it('without the signed option, negative sizes stay in the bytes tier', () => {
    // Default (unsigned) variant: any negative value is < 1024, so it renders as bytes.
    expect(formatBytes(-1536)).toBe('-1536 B');
  });
});

describe('formatBytes (signed / size-budget variant)', () => {
  it('matches the unsigned variant for positive values', () => {
    expect(formatBytes(1536, { signed: true })).toBe('1.5 KB');
    expect(formatBytes(1024 ** 3 * 2.5, { signed: true })).toBe('2.50 GB');
  });

  it('selects the tier by magnitude so negative deltas keep their unit', () => {
    expect(formatBytes(-1536, { signed: true })).toBe('-1.5 KB');
    expect(formatBytes(-(1024 ** 3) * 2, { signed: true })).toBe('-2.00 GB');
  });
});

describe('formatDuration', () => {
  it('formats sub-second durations in milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats sub-minute durations in seconds to one decimal', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minute-plus (sub-hour) durations as "Xm Ys"', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(3_599_000)).toBe('59m 59s');
  });

  it('rolls up to "Xh Ym" once a duration reaches an hour', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m');
    expect(formatDuration(3_661_000)).toBe('1h 1m');
    expect(formatDuration(90_000_000)).toBe('25h 0m'); // 25h "time invested" total
  });
});

describe('formatDurationBetween', () => {
  it('renders the span between two ISO timestamps via formatDuration', () => {
    expect(formatDurationBetween('2026-01-01T00:00:00Z', '2026-01-01T00:00:05Z')).toBe('5.0s');
    expect(formatDurationBetween('2026-01-01T00:00:00Z', '2026-01-01T00:01:30Z')).toBe('1m 30s');
  });

  it('clamps a negative span (end before start) to zero', () => {
    expect(formatDurationBetween('2026-01-01T00:00:05Z', '2026-01-01T00:00:00Z')).toBe('0ms');
  });
});
