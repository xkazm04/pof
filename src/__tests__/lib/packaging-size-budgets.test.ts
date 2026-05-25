import { describe, it, expect } from 'vitest';
import {
  evaluateBuildSize,
  hasSizeRegressionNote,
  extractRegressionNote,
  SIZE_REGRESSION_NOTE_PREFIX,
  type SizeBudgetConfig,
} from '@/lib/packaging/size-budgets';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const config: SizeBudgetConfig = {
  failOnRegression: false,
  budgets: {
    Windows: { budgetBytes: 4 * GB, growthPercent: 10 },
    Android: { budgetBytes: 2 * GB, growthPercent: 5 },
    NoLimit: { budgetBytes: 0, growthPercent: 0 },
  },
};

describe('evaluateBuildSize', () => {
  it('returns null when size is below budget and growth is within threshold', () => {
    const r = evaluateBuildSize('Windows', 3 * GB, 2.9 * GB, config);
    expect(r).toBeNull();
  });

  it('returns null when there is no prior green build and size is under budget', () => {
    const r = evaluateBuildSize('Windows', 3 * GB, null, config);
    expect(r).toBeNull();
  });

  it('flags a build that exceeds the absolute budget', () => {
    const r = evaluateBuildSize('Windows', 5 * GB, 4.1 * GB, config);
    expect(r).not.toBeNull();
    expect(r!.exceedsBudget).toBe(true);
    expect(r!.note).toContain(SIZE_REGRESSION_NOTE_PREFIX);
    expect(r!.note).toContain('Windows');
    expect(r!.note).toContain('budget');
  });

  it('flags a build that grows beyond the percent threshold even when below budget', () => {
    // 1 GB -> 1.2 GB is +20%, threshold 10% on Windows
    const r = evaluateBuildSize('Windows', 1.2 * GB, 1 * GB, config);
    expect(r).not.toBeNull();
    expect(r!.exceedsBudget).toBe(false);
    expect(r!.exceedsGrowth).toBe(true);
    expect(r!.actualGrowthPercent).toBeCloseTo(20, 1);
    expect(r!.note).toContain('grew');
  });

  it('does not flag growth when prior build is missing', () => {
    // No prior data, well under budget
    const r = evaluateBuildSize('Windows', 1 * GB, null, config);
    expect(r).toBeNull();
  });

  it('does not flag when growth threshold is 0 (disabled) even with bloat', () => {
    const r = evaluateBuildSize('NoLimit', 100 * GB, 1 * MB, config);
    expect(r).toBeNull();
  });

  it('treats unknown platforms as having no budget (passes everything)', () => {
    const r = evaluateBuildSize('FakePlatform', 999 * GB, 1 * GB, config);
    expect(r).toBeNull();
  });

  it('returns null for zero or missing size', () => {
    expect(evaluateBuildSize('Windows', null, 1 * GB, config)).toBeNull();
    expect(evaluateBuildSize('Windows', 0, 1 * GB, config)).toBeNull();
    expect(evaluateBuildSize('Windows', undefined, 1 * GB, config)).toBeNull();
  });

  it('produces a note with both budget and growth callouts when both fail', () => {
    // Android: 2 GB budget, 5% growth. 3 GB build vs 2.5 GB prior.
    const r = evaluateBuildSize('Android', 3 * GB, 2.5 * GB, config);
    expect(r).not.toBeNull();
    expect(r!.exceedsBudget).toBe(true);
    expect(r!.exceedsGrowth).toBe(true);
    expect(r!.note).toContain('budget');
    expect(r!.note).toContain('grew');
  });
});

describe('hasSizeRegressionNote / extractRegressionNote', () => {
  it('detects the prefix in build notes', () => {
    expect(hasSizeRegressionNote(null)).toBe(false);
    expect(hasSizeRegressionNote('')).toBe(false);
    expect(hasSizeRegressionNote('all good')).toBe(false);
    expect(hasSizeRegressionNote('previous note\n[SIZE_BUDGET] Windows 5 GB - exceeds 4 GB budget')).toBe(true);
  });

  it('extracts the regression line out of a multi-line notes blob', () => {
    const notes = 'smoke: passed\n[SIZE_BUDGET] Windows 5 GB — exceeds budget\nanother line';
    expect(extractRegressionNote(notes)).toContain('[SIZE_BUDGET]');
  });

  it('returns null when no regression line is present', () => {
    expect(extractRegressionNote('smoke: passed')).toBeNull();
    expect(extractRegressionNote(null)).toBeNull();
  });
});
