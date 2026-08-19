import { describe, it, expect } from 'vitest';
import {
  makeRunEvidence,
  summarizeRuns,
  describeRunEvidence,
  NO_RUN_EVIDENCE,
} from '@/lib/nba-run-evidence';

describe('makeRunEvidence', () => {
  it('reports a null rate when nothing has run — never a neutral constant', () => {
    expect(makeRunEvidence(0, 0)).toEqual(NO_RUN_EVIDENCE);
    expect(makeRunEvidence(0, 0).rate).toBeNull();
  });

  it('computes the real rate from the sample', () => {
    expect(makeRunEvidence(3, 2)).toEqual({ runs: 3, successes: 2, rate: 2 / 3 });
  });

  it('keeps a zero-success sample as 0, not as "unknown"', () => {
    // The real DB today: 86 recorded sessions, 0 successes. That is EVIDENCE,
    // and it must not degrade into the same state as "never run".
    const ev = makeRunEvidence(86, 0);
    expect(ev.rate).toBe(0);
    expect(ev.runs).toBe(86);
  });

  it('refuses impossible aggregates rather than reporting a rate above 1', () => {
    expect(makeRunEvidence(2, 5)).toEqual({ runs: 2, successes: 2, rate: 1 });
    expect(makeRunEvidence(Number.NaN, 1)).toEqual(NO_RUN_EVIDENCE);
    expect(makeRunEvidence(-4, -2)).toEqual(NO_RUN_EVIDENCE);
  });
});

describe('summarizeRuns', () => {
  it('counts successes across recorded rows', () => {
    expect(summarizeRuns([{ success: true }, { success: false }, { success: true }]))
      .toEqual({ runs: 3, successes: 2, rate: 2 / 3 });
  });

  it('treats an empty or missing list as no evidence', () => {
    expect(summarizeRuns([])).toEqual(NO_RUN_EVIDENCE);
    expect(summarizeRuns(null)).toEqual(NO_RUN_EVIDENCE);
  });
});

describe('describeRunEvidence', () => {
  it('names the sample size', () => {
    expect(describeRunEvidence(makeRunEvidence(3, 2))).toBe('2 of 3 past runs succeeded');
  });

  it('singularises a one-run sample', () => {
    expect(describeRunEvidence(makeRunEvidence(1, 1))).toBe('1 of 1 past run succeeded');
  });

  it('says there is no sample instead of printing a number', () => {
    const note = describeRunEvidence(NO_RUN_EVIDENCE);
    expect(note).toBe('No recorded runs for this module yet — success odds not scored');
    expect(note).not.toMatch(/\d+%/);
  });
});
