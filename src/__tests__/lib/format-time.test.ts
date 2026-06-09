import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatTimeAgo } from '@/lib/format-time';

// Anchor "now" so the relative math is deterministic.
const NOW = new Date('2026-06-07T12:00:00.000Z').getTime();
const ago = (ms: number) => NOW - ms;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses the first minute into "just now"', () => {
    expect(formatTimeAgo(ago(0))).toBe('just now');
    expect(formatTimeAgo(ago(59 * SEC))).toBe('just now');
  });

  it('formats minutes, hours and days', () => {
    expect(formatTimeAgo(ago(5 * MIN))).toBe('5m ago');
    expect(formatTimeAgo(ago(3 * HOUR))).toBe('3h ago');
    expect(formatTimeAgo(ago(2 * DAY))).toBe('2d ago');
  });

  it('caps at days by default (no weeks/months)', () => {
    expect(formatTimeAgo(ago(20 * DAY))).toBe('20d ago');
    expect(formatTimeAgo(ago(400 * DAY))).toBe('400d ago');
  });

  it('adds weeks and months tiers when extended', () => {
    expect(formatTimeAgo(ago(6 * DAY), { extended: true })).toBe('6d ago');
    expect(formatTimeAgo(ago(10 * DAY), { extended: true })).toBe('1w ago');
    expect(formatTimeAgo(ago(34 * DAY), { extended: true })).toBe('4w ago');
    expect(formatTimeAgo(ago(60 * DAY), { extended: true })).toBe('2mo ago');
  });

  it('adds a seconds tier when requested', () => {
    expect(formatTimeAgo(ago(2 * SEC), { seconds: true })).toBe('just now');
    expect(formatTimeAgo(ago(30 * SEC), { seconds: true })).toBe('30s ago');
    expect(formatTimeAgo(ago(5 * MIN), { seconds: true })).toBe('5m ago');
  });

  it('honors a custom just-now label', () => {
    expect(formatTimeAgo(ago(10 * SEC), { justNow: 'Just now' })).toBe('Just now');
  });

  it('returns the invalid label for unparseable input, falling back to just-now', () => {
    expect(formatTimeAgo('not-a-date', { invalid: 'Unknown' })).toBe('Unknown');
    expect(formatTimeAgo('not-a-date')).toBe('just now');
  });

  it('accepts ISO strings, epoch numbers and Date objects', () => {
    expect(formatTimeAgo(new Date(ago(5 * MIN)).toISOString())).toBe('5m ago');
    expect(formatTimeAgo(ago(5 * MIN))).toBe('5m ago');
    expect(formatTimeAgo(new Date(ago(5 * MIN)))).toBe('5m ago');
  });
});
