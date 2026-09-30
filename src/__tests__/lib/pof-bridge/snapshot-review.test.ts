/**
 * snapshot-review — the pure half of the Snapshots tab's regression loop:
 * read the plugin's capture reply for what it is (an async ack, not a report),
 * decide which rows may be re-baselined, and say exactly what an accept
 * overwrites before the user confirms it.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeCaptureReply,
  reviewRows,
  planAccept,
  describeAccept,
  isReadbackFresh,
} from '@/lib/pof-bridge/snapshot-review';
import type { PofSnapshotDiffReport, PofSnapshotDiffResult } from '@/types/pof-bridge';

type Status = PofSnapshotDiffResult['status'];

function row(presetId: string, status: Status, diffPercentage = 0): PofSnapshotDiffResult {
  return {
    presetId,
    presetName: `Preset ${presetId.toUpperCase()}`,
    status,
    diffPercentage,
    maxPixelDiff: status === 'passed' ? 2 : 90,
    diffPixelCount: status === 'failed' ? 4096 : 0,
    totalPixelCount: 1920 * 1080,
  };
}

function report(results: PofSnapshotDiffResult[], generatedAt = '2026-09-30T12:00:00.000Z'): PofSnapshotDiffReport {
  const count = (s: Status) => results.filter((r) => r.status === s).length;
  return {
    generatedAt,
    diffThreshold: 0.5,
    overallStatus: results.every((r) => r.status === 'passed') ? 'passed' : 'failed',
    results,
    summary: {
      totalPresets: results.length,
      passed: count('passed'),
      failed: count('failed'),
      noBaseline: count('no-baseline'),
      skipped: 0,
    },
  };
}

const MIXED = report([
  row('a', 'failed', 3.1),
  row('b', 'no-baseline'),
  row('c', 'passed'),
  row('d', 'resolution-mismatch'),
]);

describe('normalizeCaptureReply', () => {
  it('reads the plugin ack, a full report, and anything else as invalid-with-reason (case 1)', () => {
    expect(normalizeCaptureReply({ accepted: true, presetIds: ['a'] })).toEqual({ kind: 'accepted', presetIds: ['a'] });
    expect(normalizeCaptureReply(MIXED)).toEqual({ kind: 'report', report: MIXED });

    const invalid = normalizeCaptureReply({});
    expect(invalid.kind).toBe('invalid');
    expect(invalid.kind === 'invalid' && invalid.reason.length > 0).toBe(true);
  });
});

describe('reviewRows', () => {
  it('offers accept only on rows that did not pass, with a bulk label (case 2)', () => {
    const review = reviewRows(MIXED);
    expect(review.acceptable).toEqual(['a', 'b', 'd']);
    expect(review.rows.find((r) => r.presetId === 'c')?.acceptable).toBe(false);
    expect(review.rows.filter((r) => r.acceptable).map((r) => r.presetId)).toEqual(['a', 'b', 'd']);
    expect(review.bulkLabel).toBe('Accept 3 as baseline');
  });

  it('an all-passed report offers nothing', () => {
    const review = reviewRows(report([row('a', 'passed'), row('c', 'passed')]));
    expect(review.acceptable).toEqual([]);
    expect(review.bulkLabel).toBeNull();
  });
});

describe('planAccept', () => {
  it('drops passed and unknown preset ids (case 3)', () => {
    expect(planAccept(MIXED, ['a', 'c', 'zzz'])).toEqual(['a']);
  });
});

describe('describeAccept', () => {
  it('names what an accept overwrites (irreversibly) and what it creates', () => {
    const abc = report([row('a', 'failed', 3.1), row('b', 'no-baseline'), row('c', 'passed')]);
    expect(describeAccept(abc, ['a', 'b'])).toBe(
      'Overwrites 1 existing baseline (a) - cannot be undone from PoF; creates 1 (b)',
    );
    expect(describeAccept(MIXED, ['a', 'd'])).toBe(
      'Overwrites 2 existing baselines (a, d) - cannot be undone from PoF',
    );
    expect(describeAccept(MIXED, ['b'])).toBe('Creates 1 baseline (b)');
  });
});

describe('isReadbackFresh', () => {
  it('needs a report newer than the pre-capture one that covers every requested preset', () => {
    const older = report([row('a', 'failed', 3.1)], '2026-09-30T11:00:00.000Z');
    const newer = report([row('a', 'passed')], '2026-09-30T12:00:00.000Z');
    const since = older.generatedAt;
    expect(isReadbackFresh(older, { since, presetIds: ['a'] })).toBe(false);
    expect(isReadbackFresh(newer, { since, presetIds: ['a'] })).toBe(true);
    expect(isReadbackFresh(newer, { since, presetIds: ['a', 'b'] })).toBe(false);
    expect(isReadbackFresh(older, { since: null, presetIds: ['a'] })).toBe(true);
  });
});
